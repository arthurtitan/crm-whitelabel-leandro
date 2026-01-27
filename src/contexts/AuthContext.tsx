import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
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

// Hydration timeout (15 seconds - increased for slow connections)
const HYDRATION_TIMEOUT_MS = 15000;

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
  
  // Concurrency control for hydration
  const hydrationIdRef = useRef<number>(0);
  const isHydratingRef = useRef<boolean>(false);

  // Clear auth error
  const clearAuthError = useCallback(() => {
    setAuthState(prev => ({ ...prev, authError: null }));
  }, []);

  // Hydrate user data with timeout and retry
  const hydrateUser = useCallback(async (supabaseUser: SupabaseUser, hydrationId: number): Promise<boolean> => {
    const startTime = performance.now();
    console.log(`[AuthContext] Hydration #${hydrationId} started for:`, supabaseUser.id);

    // Check if this hydration is still current
    if (hydrationIdRef.current !== hydrationId) {
      console.log(`[AuthContext] Hydration #${hydrationId} cancelled (superseded by #${hydrationIdRef.current})`);
      return false;
    }

    try {
      // Fetch profile and role in parallel with timeout
      const fetchWithTimeout = async <T,>(
        promiseFn: () => Promise<T>,
        timeoutMs: number,
        label: string,
        retries: number = 1
      ): Promise<T> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)
            );
            return await Promise.race([promiseFn(), timeout]);
          } catch (error) {
            if (attempt === retries) throw error;
            console.log(`[AuthContext] ${label} attempt ${attempt + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before retry
          }
        }
        throw new Error(`${label} failed after retries`);
      };

      const profileStart = performance.now();
      
      // Fetch profile and role with retry logic
      const fetchProfileAndRole = async () => {
        const results = await Promise.all([
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
        ]);
        return results;
      };
      
      const [profileResult, roleResult] = await fetchWithTimeout(
        fetchProfileAndRole,
        HYDRATION_TIMEOUT_MS,
        'Profile/Role fetch',
        2 // Retry up to 2 times
      );
      console.log(`[AuthContext] Profile/Role fetch took ${Math.round(performance.now() - profileStart)}ms`);

      // Check again if this hydration is still current
      if (hydrationIdRef.current !== hydrationId) {
        console.log(`[AuthContext] Hydration #${hydrationId} cancelled after fetch`);
        return false;
      }

      const { data: profile, error: profileError } = profileResult;
      const { data: userRole, error: roleError } = roleResult;

      if (profileError) {
        console.error('[AuthContext] Error fetching profile:', profileError);
        throw new Error('Erro ao carregar perfil do usuário');
      }

      if (!profile) {
        console.error('[AuthContext] No profile found for user:', supabaseUser.id);
        throw new Error('Perfil não encontrado. Contate o administrador.');
      }

      if (roleError) {
        console.warn('[AuthContext] Error fetching role (non-fatal):', roleError);
      }

      const role = (userRole?.role as 'super_admin' | 'admin' | 'agent') || 'agent';
      console.log(`[AuthContext] User role: ${role}`);

      // Check user status
      if (profile.status !== 'active') {
        console.warn('[AuthContext] User is not active:', profile.status);
        throw new Error('Usuário suspenso ou inativo');
      }

      // For super_admin, skip account fetch - they don't need it
      let account: Account | null = null;
      if (role !== 'super_admin' && profile.account_id) {
        const accountStart = performance.now();
        
        // Wrap in a proper async function for the timeout race
        const fetchAccount = async () => {
          return await supabase
            .from('accounts')
            .select('id, nome, status, chatwoot_base_url, chatwoot_account_id')
            .eq('id', profile.account_id!)
            .maybeSingle();
        };
        
        const accountResult = await fetchWithTimeout(
          fetchAccount,
          HYDRATION_TIMEOUT_MS,
          'Account fetch',
          2 // Retry up to 2 times
        );
        console.log(`[AuthContext] Account fetch took ${Math.round(performance.now() - accountStart)}ms`);

        const { data: accountData, error: accountError } = accountResult;

        if (!accountError && accountData) {
          account = {
            id: accountData.id,
            nome: accountData.nome,
            status: accountData.status as 'active' | 'paused' | 'cancelled',
            chatwoot_base_url: accountData.chatwoot_base_url || undefined,
            chatwoot_account_id: accountData.chatwoot_account_id || undefined,
          };

          // Check account status
          if (accountData.status === 'paused') {
            console.warn('[AuthContext] Account is paused');
            throw new Error('Conta pausada. Contate o administrador.');
          }
        }
      }

      // Final check before setting state
      if (hydrationIdRef.current !== hydrationId) {
        console.log(`[AuthContext] Hydration #${hydrationId} cancelled before state update`);
        return false;
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

      const totalTime = Math.round(performance.now() - startTime);
      console.log(`[AuthContext] Hydration #${hydrationId} complete in ${totalTime}ms:`, { email: user.email, role: user.role });

      setAuthState({
        user,
        account,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      return true;
    } catch (error: any) {
      console.error(`[AuthContext] Hydration #${hydrationId} failed:`, error);
      
      // Only handle error if this hydration is still current
      if (hydrationIdRef.current === hydrationId) {
        // Sign out to avoid half-logged state
        console.log('[AuthContext] Signing out due to hydration failure');
        await supabase.auth.signOut();
        
        setAuthState({
          user: null,
          account: null,
          isAuthenticated: false,
          isLoading: false,
          authError: error.message || 'Erro ao carregar dados do usuário',
        });
      }
      
      return false;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    console.log('[AuthContext] Initializing auth...');

    // Start new hydration (increments ID to cancel any in-flight)
    const startHydration = async (supabaseUser: SupabaseUser) => {
      if (isHydratingRef.current) {
        console.log('[AuthContext] Another hydration in progress, cancelling it...');
      }
      
      isHydratingRef.current = true;
      const newHydrationId = ++hydrationIdRef.current;
      
      const success = await hydrateUser(supabaseUser, newHydrationId);
      
      // Only clear hydrating flag if this hydration is still current
      if (hydrationIdRef.current === newHydrationId) {
        isHydratingRef.current = false;
      }
      
      return success;
    };

    // Set up auth state change listener BEFORE getSession (recommended)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event);
        
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AuthContext] SIGNED_IN event, starting hydration...');
          setAuthState(prev => ({ ...prev, isLoading: true, authError: null }));
          await startHydration(session.user);
        } else if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] SIGNED_OUT event');
          hydrationIdRef.current++; // Cancel any in-flight hydration
          setAuthState({
            user: null,
            account: null,
            isAuthenticated: false,
            isLoading: false,
            authError: null,
          });
          setOriginalUser(null);
          setIsImpersonating(false);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[AuthContext] TOKEN_REFRESHED event (no re-hydration)');
          // Don't re-hydrate on token refresh to avoid unnecessary calls
        } else if (event === 'INITIAL_SESSION' && session?.user) {
          console.log('[AuthContext] INITIAL_SESSION with user, starting hydration...');
          await startHydration(session.user);
        } else if (event === 'INITIAL_SESSION' && !session) {
          console.log('[AuthContext] INITIAL_SESSION without session');
          setAuthState({
            user: null,
            account: null,
            isAuthenticated: false,
            isLoading: false,
            authError: null,
          });
        }
      }
    );

    // Check for existing session (fallback for browsers that don't fire INITIAL_SESSION)
    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          // Only hydrate if we haven't already started via INITIAL_SESSION
          if (!isHydratingRef.current && !authState.isAuthenticated) {
            console.log('[AuthContext] Existing session found, starting hydration...');
            await startHydration(session.user);
          }
        } else if (mounted && !isHydratingRef.current) {
          console.log('[AuthContext] No existing session');
          setAuthState(prev => {
            // Only update if still loading
            if (prev.isLoading) {
              return {
                user: null,
                account: null,
                isAuthenticated: false,
                isLoading: false,
                authError: null,
              };
            }
            return prev;
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
            authError: null,
          });
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser]);

  // Login - ONLY authenticates, hydration happens via onAuthStateChange
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const startTime = performance.now();
    console.log('[AuthContext] Login attempt for:', email);
    
    // Clear any previous auth error
    setAuthState(prev => ({ ...prev, authError: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      const signInTime = Math.round(performance.now() - startTime);
      console.log(`[AuthContext] signInWithPassword took ${signInTime}ms`);

      if (error) {
        console.error('[AuthContext] Supabase auth error:', error.message);
        
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Credenciais inválidas' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        console.error('[AuthContext] No user returned from login');
        return { success: false, error: 'Erro ao fazer login' };
      }

      // Success! Hydration will happen via onAuthStateChange SIGNED_IN event
      console.log('[AuthContext] Login successful, hydration will follow via onAuthStateChange');
      return { success: true };
    } catch (error: any) {
      console.error('[AuthContext] Unexpected error during login:', error);
      return { success: false, error: 'Erro inesperado ao fazer login' };
    }
  }, []);

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
    hydrationIdRef.current++; // Cancel any in-flight hydration
    await supabase.auth.signOut();
    setAuthState({
      user: null,
      account: null,
      isAuthenticated: false,
      isLoading: false,
      authError: null,
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
        .select('user_id, email, nome, status, permissions, account_id, chatwoot_agent_id')
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
