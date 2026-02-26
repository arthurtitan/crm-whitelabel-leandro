/**
 * Backend Auth Provider
 * 
 * JWT-based authentication using Express backend.
 * Used when VITE_USE_BACKEND=true (VPS deployment).
 * 
 * IMPORTANT: This exports BackendAuthProvider only.
 * useAuth and useRoleAccess are imported from AuthContext.tsx
 * since both providers share the same React context.
 */

import React, { useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { apiClient, tokenManager } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import { toast } from 'sonner';

// Import the shared context from the main AuthContext file
// This is a module-level import for the React context object only
import { AuthContext } from '@/contexts/AuthContext';

// Types (same as AuthContext.tsx)
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
  chatwoot_api_key?: string;
}

interface AuthState {
  user: User | null;
  account: Account | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
}

export function BackendAuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    account: null,
    isAuthenticated: false,
    isLoading: true,
    authError: null,
  });
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const mountedRef = useRef(true);

  const clearAuthError = useCallback(() => {
    setAuthState(prev => ({ ...prev, authError: null }));
  }, []);

  // Hydrate user from /api/auth/me
  const hydrateFromToken = useCallback(async () => {
    const token = tokenManager.getToken();
    if (!token) {
      setAuthState({
        user: null, account: null, isAuthenticated: false, isLoading: false, authError: null,
      });
      return;
    }

    try {
      const raw = await apiClient.get<any>(API_ENDPOINTS.AUTH.ME);
      // Support both { data: { user, account } } and { user, account }
      const response = raw?.data ?? raw;

      if (!mountedRef.current) return;

      setAuthState({
        user: {
          id: response.user.id,
          email: response.user.email,
          nome: response.user.nome,
          role: response.user.role,
          account_id: response.user.account_id || response.user.accountId,
          permissions: response.user.permissions || ['dashboard'],
          status: response.user.status,
          chatwoot_agent_id: response.user.chatwoot_agent_id || response.user.chatwootAgentId,
        },
        account: response.account ? {
          id: response.account.id,
          nome: response.account.nome,
          status: response.account.status,
          chatwoot_base_url: response.account.chatwoot_base_url || response.account.chatwootBaseUrl,
          chatwoot_account_id: response.account.chatwoot_account_id || response.account.chatwootAccountId,
          chatwoot_api_key: response.account.chatwoot_api_key || response.account.chatwootApiKey,
        } : null,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });
    } catch (error: any) {
      console.error('[BackendAuth] Failed to hydrate:', error);
      tokenManager.clearTokens();
      if (mountedRef.current) {
        setAuthState({
          user: null, account: null, isAuthenticated: false, isLoading: false, authError: null,
        });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    hydrateFromToken();

    const handleUnauthorized = () => {
      if (!mountedRef.current) return;
      tokenManager.clearTokens();
      setAuthState({
        user: null, account: null, isAuthenticated: false, isLoading: false, authError: null,
      });
      setOriginalUser(null);
      setIsImpersonating(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [hydrateFromToken]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, authError: null, isLoading: true }));

    try {
      const raw = await apiClient.post<any>(
        API_ENDPOINTS.AUTH.LOGIN, { email, password }, { skipAuth: true }
      );
      // Support both { data: { user, token, ... } } and flat response
      const response = raw?.data ?? raw;

      tokenManager.setToken(response.token);
      tokenManager.setRefreshToken(response.refreshToken);

      setAuthState({
        user: {
          id: response.user.id,
          email: response.user.email,
          nome: response.user.nome,
          role: response.user.role,
          account_id: response.user.account_id || response.user.accountId,
          permissions: response.user.permissions || ['dashboard'],
          status: response.user.status || 'active',
          chatwoot_agent_id: response.user.chatwoot_agent_id,
        },
        account: response.account ? {
          id: response.account.id,
          nome: response.account.nome,
          status: response.account.status,
          chatwoot_base_url: response.account.chatwoot_base_url,
          chatwoot_account_id: response.account.chatwoot_account_id,
          chatwoot_api_key: response.account.chatwoot_api_key,
        } : null,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      return { success: true };
    } catch (error: any) {
      const errorMessage = error?.message || error?.error?.message || 'Erro ao fazer login';
      setAuthState(prev => ({ ...prev, isLoading: false, authError: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const signUp = useCallback(async (_email: string, _password: string, _nome: string): Promise<{ success: boolean; error?: string }> => {
    return { success: false, error: 'Cadastro disponível apenas via administrador' };
  }, []);

  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('[BackendAuth] Logout error:', error);
    } finally {
      tokenManager.clearTokens();
      setAuthState({
        user: null, account: null, isAuthenticated: false, isLoading: false, authError: null,
      });
      setOriginalUser(null);
      setIsImpersonating(false);
    }
  }, []);

  const impersonate = useCallback(async (userId: string) => {
    if (authState.user?.role !== 'super_admin') return;

    try {
      const raw = await apiClient.post<any>(
        API_ENDPOINTS.AUTH.IMPERSONATE(userId)
      );
      // Support envelope { data: { user, account } }
      const response = raw?.data ?? raw;

      const targetUser: User = {
        id: response.user.id,
        email: response.user.email,
        nome: response.user.nome,
        role: response.user.role,
        account_id: response.user.account_id || response.user.accountId,
        permissions: response.user.permissions || ['dashboard'],
        status: response.user.status,
        chatwoot_agent_id: response.user.chatwoot_agent_id || response.user.chatwootAgentId,
      };

      setOriginalUser(authState.user);
      setIsImpersonating(true);
      setAuthState(prev => ({ ...prev, user: targetUser, account: response.account || null }));
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
