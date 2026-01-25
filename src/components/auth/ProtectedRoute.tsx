import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { UserRole } from '@/types/crm';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { canAccessRoute, getFirstAllowedRoute } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super Admin check
  if (requireSuperAdmin && user.role !== 'super_admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  // Role check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // For agents, check granular permissions
  if (user.role === 'agent' && !canAccessRoute(location.pathname)) {
    // Redirect to first allowed route instead of unauthorized
    const allowedRoute = getFirstAllowedRoute();
    return <Navigate to={allowedRoute} replace />;
  }

  return <>{children}</>;
}

// Role-based redirect after login
export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'agent':
      return '/admin'; // Agents now use /admin routes with permission check
    default:
      return '/';
  }
}
