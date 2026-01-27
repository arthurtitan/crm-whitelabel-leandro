import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Types
interface User {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'admin' | 'agent';
  account_id?: string;
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended';
  chatwoot_agent_id?: number;
}

interface Account {
  id: string;
  nome: string;
  status: 'active' | 'paused' | 'cancelled';
  chatwoot_base_url?: string;
  chatwoot_account_id?: string;
}

interface AuthState {
  user: User | null;
  account: Account | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  impersonate: (userId: string) => void;
  exitImpersonation: () => void;
  isImpersonating: boolean;
  originalUser: User | null;
  signUp: (email: string, password: string, nome: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    account: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Fetch user profile and role from database
  const fetchUserData = useCallback(async (supabaseUser: SupabaseUser): Promise<{ user: User | null; account: Account | null }> => {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return { user: null, account: null };
      }

      if (!profile) {
        console.error('No profile found for user');
        return { user: null, account: null };
      }

      // Get user role
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      const role = (userRole?.role as 'super_admin' | 'admin' | 'agent') || 'agent';

      // Check user status
      if (profile.status !== 'active') {
        return { user: null, account: null };
      }

      // Get account if user has one
      let account: Account | null = null;
      if (profile.account_id) {
        const { data: accountData, error: accountError } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', profile.account_id)
          .maybeSingle();

        if (!accountError && accountData) {
          account = {
            id: accountData.id,
            nome: accountData.nome,
            status: accountData.status as 'active' | 'paused' | 'cancelled',
            chatwoot_base_url: accountData.chatwoot_base_url || undefined,
            chatwoot_account_id: accountData.chatwoot_account_id || undefined,
          };

          // Check account status (except super_admin)
          if (role !== 'super_admin' && accountData.status === 'paused') {
            return { user: null, account: null };
          }
        }
      }

      const user: User = {
        id: supabaseUser.id,
        email: profile.email,
        nome: profile.nome,
        role,
        account_id: profile.account_id || undefined,
        permissions: profile.permissions || ['dashboard'],
        status: profile.status as 'active' | 'inactive' | 'suspended',
        chatwoot_agent_id: profile.chatwoot_agent_id || undefined,
      };

      return { user, account };
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      return { user: null, account: null };
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          const { user, account } = await fetchUserData(session.user);
          
          if (mounted) {
            setAuthState({
              user,
              account,
              isAuthenticated: !!user,
              isLoading: false,
            });
          }
        } else if (mounted) {
          setAuthState({
            user: null,
            account: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setAuthState({
            user: null,
            account: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { user, account } = await fetchUserData(session.user);
          
          if (mounted) {
            setAuthState({
              user,
              account,
              isAuthenticated: !!user,
              isLoading: false,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setAuthState({
              user: null,
              account: null,
              isAuthenticated: false,
              isLoading: false,
            });
            setOriginalUser(null);
            setIsImpersonating(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const login = useCallback(async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Credenciais inválidas' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: 'Erro ao fazer login' };
      }

      const { user, account } = await fetchUserData(data.user);

      if (!user) {
        await supabase.auth.signOut();
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: 'Usuário suspenso ou conta pausada' };
      }

      setAuthState({
        user,
        account,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: error.message || 'Erro desconhecido' };
    }
  }, [fetchUserData]);

  const signUp = useCallback(async (email: string, password: string, nome: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: error.message };
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: error.message || 'Erro desconhecido' };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthState({
      user: null,
      account: null,
      isAuthenticated: false,
      isLoading: false,
    });
    setOriginalUser(null);
    setIsImpersonating(false);
  }, []);

  const impersonate = useCallback(async (userId: string) => {
    if (authState.user?.role !== 'super_admin') return;

    try {
      // Get the target user's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        toast.error('Usuário não encontrado');
        return;
      }

      // Get target user's role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const role = (userRole?.role as 'super_admin' | 'admin' | 'agent') || 'agent';

      // Get account if user has one
      let account: Account | null = null;
      if (profile.account_id) {
        const { data: accountData } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', profile.account_id)
          .maybeSingle();

        if (accountData) {
          account = {
            id: accountData.id,
            nome: accountData.nome,
            status: accountData.status as 'active' | 'paused' | 'cancelled',
            chatwoot_base_url: accountData.chatwoot_base_url || undefined,
            chatwoot_account_id: accountData.chatwoot_account_id || undefined,
          };
        }
      }

      const targetUser: User = {
        id: userId,
        email: profile.email,
        nome: profile.nome,
        role,
        account_id: profile.account_id || undefined,
        permissions: profile.permissions || ['dashboard'],
        status: profile.status as 'active' | 'inactive' | 'suspended',
        chatwoot_agent_id: profile.chatwoot_agent_id || undefined,
      };

      setOriginalUser(authState.user);
      setIsImpersonating(true);
      setAuthState(prev => ({
        ...prev,
        user: targetUser,
        account,
      }));

      toast.success(`Assumindo identidade de ${targetUser.nome}`);
    } catch (error) {
      console.error('Error impersonating:', error);
      toast.error('Erro ao assumir identidade');
    }
  }, [authState.user]);

  const exitImpersonation = useCallback(() => {
    if (!originalUser) return;

    setAuthState(prev => ({
      ...prev,
      user: originalUser,
      account: null,
    }));
    setOriginalUser(null);
    setIsImpersonating(false);
    toast.success('Voltou para sua conta original');
  }, [originalUser]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        signUp,
        impersonate,
        exitImpersonation,
        isImpersonating,
        originalUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Role-based access helpers
export function useRoleAccess() {
  const { user } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'agent';

  const canAccessSuperAdminPanel = isSuperAdmin;
  const canManageUsers = isSuperAdmin || isAdmin;
  const canManageFunnel = isSuperAdmin || isAdmin;
  const canMoveLeads = isSuperAdmin || isAdmin || isAgent;
  const canExecuteRefunds = isSuperAdmin || isAdmin;
  const canViewDashboards = isSuperAdmin || isAdmin;
  const canAccessSettings = isSuperAdmin || isAdmin;

  return {
    isSuperAdmin,
    isAdmin,
    isAgent,
    canAccessSuperAdminPanel,
    canManageUsers,
    canManageFunnel,
    canMoveLeads,
    canExecuteRefunds,
    canViewDashboards,
    canAccessSettings,
  };
}
