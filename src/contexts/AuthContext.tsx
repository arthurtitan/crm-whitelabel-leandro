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
  authError: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  impersonate: (userId: string) => void;
  exitImpersonation: () => void;
  isImpersonating: boolean;
  originalUser: User | null;
  signUp: (email: string, password: string, nome: string) => Promise<{ success: boolean; error?: string }>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simplified timeout - 5 seconds is enough for normal connections
const HYDRATION_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    account: null,
    isAuthenticated: false,
    isLoading: true,
    authError: null,
  });
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const clearAuthError = useCallback(() => {
    setAuthState(prev => ({ ...prev, authError: null }));
  }, []);

  // Simple fetch with timeout using Promise.race
  const fetchWithTimeout = useCallback(async <T,>(
    promiseOrBuilder: Promise<T> | PromiseLike<T>,
    timeoutMs: number
  ): Promise<T> => {
    const promise = Promise.resolve(promiseOrBuilder);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  }, []);

  // Hydrate user data - simplified linear flow
  const hydrateUser = useCallback(async (supabaseUser: SupabaseUser): Promise<boolean> => {
    console.log('[Auth] Hydrating user:', supabaseUser.id);

    try {
      // Fetch profile and role in parallel
      const [profileResult, roleResult] = await fetchWithTimeout(
        Promise.all([
          supabase
            .from('profiles')
            .select('user_id, email, nome, status, permissions, account_id, chatwoot_agent_id')
            .eq('user_id', supabaseUser.id)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', supabaseUser.id)
            .maybeSingle(),
        ]),
        HYDRATION_TIMEOUT_MS
      );

      const { data: profile, error: profileError } = profileResult;
      const { data: userRole, error: roleError } = roleResult;

      if (profileError) {
        throw new Error('Erro ao carregar perfil');
      }

      if (!profile) {
        throw new Error('Perfil não encontrado');
      }

      if (roleError) {
        console.warn('[Auth] Role fetch warning:', roleError);
      }

      const role = (userRole?.role as 'super_admin' | 'admin' | 'agent') || 'agent';

      if (profile.status !== 'active') {
        throw new Error('Usuário inativo');
      }

      // Fetch account only for non-super_admin users
      let account: Account | null = null;
      if (role !== 'super_admin' && profile.account_id) {
        const accountQuery = supabase
          .from('accounts')
          .select('id, nome, status, chatwoot_base_url, chatwoot_account_id')
          .eq('id', profile.account_id)
          .maybeSingle();

        const { data: accountData, error: accountError } = await fetchWithTimeout(
          accountQuery,
          HYDRATION_TIMEOUT_MS
        );

        if (!accountError && accountData) {
          account = {
            id: accountData.id,
            nome: accountData.nome,
            status: accountData.status as 'active' | 'paused' | 'cancelled',
            chatwoot_base_url: accountData.chatwoot_base_url || undefined,
            chatwoot_account_id: accountData.chatwoot_account_id || undefined,
          };

          if (accountData.status === 'paused') {
            throw new Error('Conta pausada');
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

      console.log('[Auth] Hydration complete:', user.email, user.role);

      setAuthState({
        user,
        account,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      return true;
    } catch (error: any) {
      console.error('[Auth] Hydration failed:', error.message);
      
      // Sign out to prevent half-logged state
      await supabase.auth.signOut();
      
      setAuthState({
        user: null,
        account: null,
        isAuthenticated: false,
        isLoading: false,
        authError: error.message || 'Erro ao carregar dados',
      });
      
      return false;
    }
  }, [fetchWithTimeout]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let isHydrating = false;

    const handleAuthChange = async (event: string, session: any) => {
      if (!mounted) return;
      console.log('[Auth] Event:', event);

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        if (isHydrating) return;
        isHydrating = true;
        setAuthState(prev => ({ ...prev, isLoading: true, authError: null }));
        await hydrateUser(session.user);
        isHydrating = false;
      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          account: null,
          isAuthenticated: false,
          isLoading: false,
          authError: null,
        });
        setOriginalUser(null);
        setIsImpersonating(false);
      } else if (event === 'INITIAL_SESSION' && !session) {
        setAuthState({
          user: null,
          account: null,
          isAuthenticated: false,
          isLoading: false,
          authError: null,
        });
      }
    };

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Fallback: check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && mounted && !isHydrating) {
        isHydrating = true;
        hydrateUser(session.user).then(() => {
          isHydrating = false;
        });
      } else if (!session && mounted) {
        setAuthState(prev => prev.isLoading ? {
          user: null,
          account: null,
          isAuthenticated: false,
          isLoading: false,
          authError: null,
        } : prev);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser]);

  // Login - just authenticates, hydration follows via listener
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[Auth] Login:', email);
    setAuthState(prev => ({ ...prev, authError: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Credenciais inválidas' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Erro ao fazer login' };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: 'Erro inesperado' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, nome: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase.auth.signUp({
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
      return { success: false, error: 'Erro ao criar conta' };
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('[Auth] Logout');
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await supabase.auth.signOut();
    } finally {
      setAuthState({
        user: null,
        account: null,
        isAuthenticated: false,
        isLoading: false,
        authError: null,
      });
      setOriginalUser(null);
      setIsImpersonating(false);
    }
  }, []);

  const impersonate = useCallback(async (userId: string) => {
    if (authState.user?.role !== 'super_admin') return;

    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, email, nome, status, permissions, account_id, chatwoot_agent_id')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const { data: profile } = profileResult;
      const { data: userRole } = roleResult;

      if (!profile) {
        toast.error('Usuário não encontrado');
        return;
      }

      const role = (userRole?.role as 'super_admin' | 'admin' | 'agent') || 'agent';

      let account: Account | null = null;
      if (profile.account_id) {
        const { data: accountData } = await supabase
          .from('accounts')
          .select('id, nome, status, chatwoot_base_url, chatwoot_account_id')
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
      setAuthState(prev => ({ ...prev, user: targetUser, account }));

      toast.success(`Assumindo identidade de ${targetUser.nome}`);
    } catch {
      toast.error('Erro ao assumir identidade');
    }
  }, [authState.user]);

  const exitImpersonation = useCallback(() => {
    if (!originalUser) return;

    setAuthState(prev => ({ ...prev, user: originalUser, account: null }));
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
        clearAuthError,
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

  return {
    isSuperAdmin,
    isAdmin,
    isAgent,
    canAccessSuperAdminPanel: isSuperAdmin,
    canManageUsers: isSuperAdmin || isAdmin,
    canManageFunnel: isSuperAdmin || isAdmin,
    canMoveLeads: isSuperAdmin || isAdmin || isAgent,
    canExecuteRefunds: isSuperAdmin || isAdmin,
    canViewDashboards: isSuperAdmin || isAdmin,
    canAccessSettings: isSuperAdmin || isAdmin,
  };
}
