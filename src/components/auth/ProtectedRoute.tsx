import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

type UserRole = 'super_admin' | 'admin' | 'agent';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireSuperAdmin?: boolean;
}

// Safety timeout to prevent infinite loading
const LOADING_TIMEOUT_MS = 3000;

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { canAccessRoute, getFirstAllowedRoute } = usePermissions();
  const location = useLocation();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Safety timeout - if loading for too long, redirect to login
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('[ProtectedRoute] Loading timeout, redirecting to login');
        setLoadingTimeout(true);
      }, LOADING_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
    setLoadingTimeout(false);
  }, [isLoading]);

  // If loading timed out, redirect to login
  if (loadingTimeout && isLoading) {
    return <Navigate to="/login" replace />;
  }

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
