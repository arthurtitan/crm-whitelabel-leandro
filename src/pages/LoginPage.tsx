import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Eye, EyeOff, LogIn, RefreshCw, Loader2 } from 'lucide-react';
import glepsLogo from '@/assets/gleps-logo.png';

// Helper function to get default route based on role and permissions
function getSmartDefaultRoute(user: { role: string; permissions?: string[] }): string {
  if (user.role === 'super_admin') {
    return '/super-admin';
  }
  if (user.role === 'admin') {
    return '/admin';
  }
  // For agents, find first allowed route based on permissions
  const permissionRouteMap: Record<string, string> = {
    'dashboard': '/admin',
    'kanban': '/admin/kanban',
    'leads': '/admin/leads',
    'agenda': '/admin/agenda',
    'sales': '/admin/sales',
    'finance': '/admin/finance',
    'products': '/admin/products',
    'events': '/admin/events',
    'insights': '/admin/insights',
  };
  
  const routeOrder = ['dashboard', 'kanban', 'leads', 'agenda', 'sales', 'finance', 'products', 'events', 'insights'];
  
  for (const perm of routeOrder) {
    if (user.permissions?.includes(perm)) {
      return permissionRouteMap[perm];
    }
  }
  
  return '/admin'; // Fallback
}

// Login timeout for the signIn call only (not hydration)
const SIGNIN_TIMEOUT_MS = 15000;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  const { login, logout, user, isAuthenticated, isLoading: authLoading, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if authenticated with user data
  useEffect(() => {
    if (isAuthenticated && user && !authLoading) {
      const targetRoute = getSmartDefaultRoute({ role: user.role, permissions: user.permissions });
      console.log('[LoginPage] User authenticated and hydrated, redirecting to:', targetRoute);
      navigate(targetRoute, { replace: true });
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  // Handle auth errors from context (hydration failures)
  useEffect(() => {
    if (authError) {
      console.log('[LoginPage] Auth error from context:', authError);
      setError(authError);
      setLoginSuccess(false);
      setIsSubmitting(false);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();
    setIsSubmitting(true);
    setLoginSuccess(false);
    
    console.log('[LoginPage] Starting login attempt for:', email);
    
    try {
      // Race between login and timeout (only for the signIn call)
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
          console.warn('[LoginPage] SignIn timeout reached');
          resolve({ success: false, error: 'Tempo excedido ao conectar. Verifique sua conexão e tente novamente.' });
        }, SIGNIN_TIMEOUT_MS);
      });
      
      const result = await Promise.race([
        login(email, password),
        timeoutPromise
      ]);
      
      if (!result.success) {
        console.error('[LoginPage] Login failed:', result.error);
        setError(result.error || 'Erro ao fazer login');
        setIsSubmitting(false);
      } else {
        console.log('[LoginPage] Login successful, waiting for hydration...');
        // Mark login as successful - now waiting for hydration via AuthContext
        setLoginSuccess(true);
        // Keep isSubmitting true until redirect happens or authError appears
      }
    } catch (err: any) {
      console.error('[LoginPage] Unexpected error during login:', err);
      setError('Erro inesperado ao fazer login. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const handleRetry = async () => {
    console.log('[LoginPage] Retry requested, logging out and clearing state');
    setError('');
    clearAuthError();
    setLoginSuccess(false);
    setIsSubmitting(false);
    await logout();
  };

  // Determine current state for UI
  const showLoadingProfile = loginSuccess && authLoading && !error && !authError;
  const showError = error || authError;
  const isFormDisabled = isSubmitting || showLoadingProfile;

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background gradient effect */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
      <div className="fixed top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center mb-2">
            <img 
              src={glepsLogo} 
              alt="Gleps.AI" 
              className="w-20 h-20 object-contain logo-glow rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Painel Gleps</h1>
          <p className="text-muted-foreground">
            Powered by <span className="text-primary font-medium">Gleps.AI</span>
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-lg glass-strong">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Entrar</CardTitle>
            <CardDescription>
              Digite suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {showError && (
                <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{error || authError}</span>
                    {authError && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="p-0 h-auto ml-2 text-destructive hover:text-destructive/80"
                        onClick={handleRetry}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Tentar novamente
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {showLoadingProfile && (
                <div className="flex items-center gap-2 p-3 text-sm text-primary bg-primary/10 rounded-lg border border-primary/20">
                  <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                  <span>Autenticado. Carregando seu perfil...</span>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90 font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90 font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-10"
                    disabled={isFormDisabled}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isFormDisabled}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity glow-primary"
                disabled={isFormDisabled}
              >
                {isSubmitting && !loginSuccess ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : showLoadingProfile ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando perfil...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
