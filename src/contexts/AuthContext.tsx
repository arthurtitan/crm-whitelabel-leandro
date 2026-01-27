import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
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
  const fetchUserData = useCallback(async (supabaseUser: SupabaseUser): Promise<{ user: User | null; account: Account | null; error?: string }> => {
    console.log('[AuthContext] Fetching user data for:', supabaseUser.id);
    
    try {
      // Get user profile
      console.log('[AuthContext] Fetching profile...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('[AuthContext] Error fetching profile:', profileError);
        return { user: null, account: null, error: 'Erro ao carregar perfil do usuário' };
      }

      if (!profile) {
        console.error('[AuthContext] No profile found for user:', supabaseUser.id);
        return { user: null, account: null, error: 'Perfil não encontrado. Contate o administrador.' };
      }

      console.log('[AuthContext] Profile found:', profile.email);

      // Get user role
      console.log('[AuthContext] Fetching user role...');
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (roleError) {
        console.error('[AuthContext] Error fetching role:', roleError);
      }

      const role = (userRole?.role as 'super_admin' | 'admin' | 'agent') || 'agent';
      console.log('[AuthContext] User role:', role);

      // Check user status
      if (profile.status !== 'active') {
        console.warn('[AuthContext] User is not active:', profile.status);
        return { user: null, account: null, error: 'Usuário suspenso ou inativo' };
      }

      // Get account if user has one
      let account: Account | null = null;
      if (profile.account_id) {
        console.log('[AuthContext] Fetching account:', profile.account_id);
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
            console.warn('[AuthContext] Account is paused');
            return { user: null, account: null, error: 'Conta pausada. Contate o administrador.' };
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

      console.log('[AuthContext] User data complete:', { email: user.email, role: user.role });
      return { user, account };
    } catch (error) {
      console.error('[AuthContext] Unexpected error in fetchUserData:', error);
      return { user: null, account: null, error: 'Erro inesperado ao carregar dados do usuário' };
    }
  }, []);

  // Initialize auth state - register listener BEFORE getSession (recommended pattern)
  useEffect(() => {
    let mounted = true;
    console.log('[AuthContext] Initializing auth...');

    // First, set up the auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AuthContext] SIGNED_IN event, fetching user data...');
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
          console.log('[AuthContext] SIGNED_OUT event');
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
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('[AuthContext] TOKEN_REFRESHED event');
          // Token refreshed, user data should already be loaded
        }
      }
    );

    // Then check for existing session
    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          console.log('[AuthContext] Existing session found, fetching user data...');
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
          console.log('[AuthContext] No existing session');
          setAuthState({
            user: null,
            account: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing auth:', error);
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

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] Login attempt for:', email);
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Supabase auth error:', error.message);
        setAuthState(prev => ({ ...prev, isLoading: false }));
        
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Credenciais inválidas' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        console.error('[AuthContext] No user returned from login');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: 'Erro ao fazer login' };
      }

      console.log('[AuthContext] Supabase auth successful, fetching user data...');
      const { user, account, error: fetchError } = await fetchUserData(data.user);

      if (!user) {
        console.error('[AuthContext] Failed to fetch user data after login');
        await supabase.auth.signOut();
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: fetchError || 'Usuário suspenso ou conta pausada' };
      }

      console.log('[AuthContext] Login complete, setting auth state');
      setAuthState({
        user,
        account,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[AuthContext] Unexpected error during login:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Erro inesperado ao fazer login' };
    }
  }, [fetchUserData]);

  const signUp = useCallback(async (email: string, password: string, nome: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] SignUp attempt for:', email);
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
        console.error('[AuthContext] SignUp error:', error.message);
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: error.message };
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (error: any) {
      console.error('[AuthContext] Unexpected error during signup:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Erro inesperado ao criar conta' };
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthContext] Logging out...');
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
    if (authState.user?.role !== 'super_admin') {
      console.warn('[AuthContext] Non-super_admin attempted to impersonate');
      return;
    }

    console.log('[AuthContext] Impersonating user:', userId);

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
      console.error('[AuthContext] Error impersonating:', error);
      toast.error('Erro ao assumir identidade');
    }
  }, [authState.user]);

  const exitImpersonation = useCallback(() => {
    if (!originalUser) return;

    console.log('[AuthContext] Exiting impersonation');
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
