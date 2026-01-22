import { ReactNode, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ArrowLeftRight,
  Kanban,
  DollarSign,
  Activity,
  Wallet,
  Building2,
  Package,
  Calendar,
  Lightbulb,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const adminNavItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Kanban', href: '/admin/kanban', icon: Kanban },
  { title: 'Leads', href: '/admin/leads', icon: Users },
  { title: 'Agenda', href: '/admin/agenda', icon: Calendar },
  { title: 'Vendas', href: '/admin/sales', icon: DollarSign },
  { title: 'Financeiro', href: '/admin/finance', icon: Wallet },
  { title: 'Produtos', href: '/admin/products', icon: Package },
  { title: 'Eventos', href: '/admin/events', icon: Activity },
  { title: 'Insights', href: '/admin/insights', icon: Lightbulb },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, account, logout, isImpersonating, exitImpersonation } = useAuth();
  const { canAccessRoute } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  // Filter nav items based on user permissions
  const visibleNavItems = useMemo(() => {
    return adminNavItems.filter(item => canAccessRoute(item.href));
  }, [canAccessRoute]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-sidebar-border bg-sidebar px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sidebar-primary" />
            <span className="font-semibold text-sidebar-foreground truncate max-w-[150px]">
              {account?.nome || 'Admin'}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64',
          'hidden lg:block'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <Building2 className="w-7 h-7 text-sidebar-primary flex-shrink-0" />
              <span className="font-bold text-lg text-sidebar-foreground truncate">
                {account?.nome || 'Admin'}
              </span>
            </div>
          )}
          {collapsed && <Building2 className="w-7 h-7 text-sidebar-primary mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-muted transition-colors',
              collapsed && 'mx-auto'
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <nav className="p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <item.icon className={cn('w-5 h-5 flex-shrink-0', collapsed && 'mx-auto')} />
                  {!collapsed && <span className="font-medium">{item.title}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Menu */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors',
                  collapsed && 'justify-center'
                )}
              >
                <Avatar className="h-9 w-9 border-2 border-sidebar-primary">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                    {user ? getInitials(user.nome) : 'AD'}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user?.nome}
                    </p>
                    <p className="text-xs text-sidebar-muted truncate">{user?.email}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isImpersonating && (
                <>
                  <DropdownMenuItem onClick={exitImpersonation} className="text-warning">
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Sair da Impersonação
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <ScrollArea className="h-[calc(100%-5rem)]">
          <nav className="p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-sidebar-border">
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-64',
          'pt-16 lg:pt-0'
        )}
      >
        {isImpersonating && (
          <div className="bg-warning/10 border-b border-warning/30 px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm text-warning">
              <ArrowLeftRight className="w-4 h-4" />
              <span>
                Visualizando como <strong>{user?.nome}</strong>
              </span>
              <button onClick={exitImpersonation} className="underline hover:no-underline ml-2">
                Sair
              </button>
            </div>
          </div>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
