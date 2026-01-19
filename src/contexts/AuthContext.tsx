import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, Account, UserRole, AuthState } from '@/types/crm';
import { mockUsers, mockAccounts } from '@/data/mockData';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  impersonate: (userId: string) => void;
  exitImpersonation: () => void;
  isImpersonating: boolean;
  originalUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo credentials matching ARCHITECTURE.md
const DEMO_CREDENTIALS: Record<string, string> = {
  'superadmin@sistema.com': 'Admin@123',
  'carlos@clinicavidaplena.com': 'Admin@123',
  'ana@clinicavidaplena.com': 'Agent@123',
  'pedro@clinicavidaplena.com': 'Agent@123',
  'marina@techsolutions.com': 'Admin@123',
  'lucas@techsolutions.com': 'Agent@123',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    account: null,
    isAuthenticated: false,
    isLoading: false,
  });
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Validate credentials
    const validPassword = DEMO_CREDENTIALS[email];
    if (!validPassword || validPassword !== password) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Credenciais inválidas' };
    }
    
    // Find user
    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    // Check user status
    if (user.status !== 'active') {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Usuário suspenso ou inativo' };
    }
    
    // Check account status (except super_admin)
    if (user.role !== 'super_admin' && user.account_id) {
      const account = mockAccounts.find(a => a.id === user.account_id);
      if (account && account.status === 'paused') {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: 'Conta suspensa. Entre em contato com o administrador.' };
      }
    }
    
    // Get account
    const account = user.account_id 
      ? mockAccounts.find(a => a.id === user.account_id) || null 
      : null;
    
    setAuthState({
      user,
      account,
      isAuthenticated: true,
      isLoading: false,
    });
    
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setAuthState({
      user: null,
      account: null,
      isAuthenticated: false,
      isLoading: false,
    });
    setOriginalUser(null);
    setIsImpersonating(false);
  }, []);

  const impersonate = useCallback((userId: string) => {
    if (authState.user?.role !== 'super_admin') return;
    
    const targetUser = mockUsers.find(u => u.id === userId);
    if (!targetUser) return;
    
    const targetAccount = targetUser.account_id 
      ? mockAccounts.find(a => a.id === targetUser.account_id) || null 
      : null;
    
    setOriginalUser(authState.user);
    setIsImpersonating(true);
    setAuthState(prev => ({
      ...prev,
      user: targetUser,
      account: targetAccount,
    }));
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
  }, [originalUser]);

  return (
    <AuthContext.Provider 
      value={{ 
        ...authState, 
        login, 
        logout, 
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
