import { useAuth } from '@/contexts/AuthContext';

export type AgentPermission = 
  | 'dashboard' 
  | 'kanban' 
  | 'leads' 
  | 'conversations' 
  | 'agenda'
  | 'sales' 
  | 'finance'
  | 'products'
  | 'events' 
  | 'refunds';

// Map routes to required permissions
const routePermissionMap: Record<string, AgentPermission> = {
  '/admin': 'dashboard',
  '/admin/kanban': 'kanban',
  '/admin/leads': 'leads',
  '/admin/conversations': 'conversations',
  '/admin/agenda': 'agenda',
  '/admin/sales': 'sales',
  '/admin/finance': 'finance',
  '/admin/products': 'products',
  '/admin/events': 'events',
};

export function usePermissions() {
  const { user } = useAuth();
  
  const hasPermission = (permission: AgentPermission): boolean => {
    // Super Admin and Admin have all permissions
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true;
    }
    // Agents check their permissions array
    return user?.permissions?.includes(permission) ?? false;
  };
  
  const canAccessRoute = (route: string): boolean => {
    // Super Admin and Admin can access all routes
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true;
    }
    
    const permission = routePermissionMap[route];
    return permission ? hasPermission(permission) : true;
  };

  const getFirstAllowedRoute = (): string => {
    // Super Admin and Admin default to dashboard
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return '/admin';
    }

    // For agents, find the first permitted route
    const routeOrder = [
      '/admin',
      '/admin/kanban',
      '/admin/leads',
      '/admin/conversations',
      '/admin/agenda',
      '/admin/sales',
      '/admin/finance',
      '/admin/products',
      '/admin/events',
    ];

    for (const route of routeOrder) {
      if (canAccessRoute(route)) {
        return route;
      }
    }

    return '/admin'; // Fallback
  };
  
  return { hasPermission, canAccessRoute, getFirstAllowedRoute };
}
