// App root component with authentication and routing
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { TagProvider } from "@/contexts/TagContext";
import { ProductProvider } from "@/contexts/ProductContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import LoginPage from "./pages/LoginPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";

// Super Admin
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import SuperAdminAccountsPage from "./pages/super-admin/SuperAdminAccountsPage";
import SuperAdminAccountDetailPage from "./pages/super-admin/SuperAdminAccountDetailPage";
import SuperAdminUsersPage from "./pages/super-admin/SuperAdminUsersPage";

// Admin
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminKanbanPage from "./pages/admin/AdminKanbanPage";
import AdminLeadsPage from "./pages/admin/AdminLeadsPage";
import AdminSalesPage from "./pages/admin/AdminSalesPage";
import AdminEventsPage from "./pages/admin/AdminEventsPage";

import AdminFinancePage from "./pages/admin/AdminFinancePage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminAgendaPage from "./pages/admin/AdminAgendaPage";
import AdminInsightsPage from "./pages/admin/AdminInsightsPage";

const queryClient = new QueryClient();

// Wrapper component to provide contexts with accountId and userId from AuthContext
// TagProvider must be outside FinanceProvider because FinanceContext uses TagContext
function AdminFinanceWrapper({ children }: { children: React.ReactNode }) {
  const { account, user } = useAuth();
  const accountId = account?.id || 'acc-1';
  const userId = user?.id || '';
  return (
    <TagProvider accountId={accountId}>
      <FinanceProvider accountId={accountId}>
        <ProductProvider accountId={accountId}>
          <CalendarProvider accountId={accountId} userId={userId}>
            {children}
          </CalendarProvider>
        </ProductProvider>
      </FinanceProvider>
    </TagProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Super Admin Routes */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <SuperAdminLayout>
                    <SuperAdminDashboard />
                  </SuperAdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/accounts"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <SuperAdminLayout>
                    <SuperAdminAccountsPage />
                  </SuperAdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/accounts/:accountId"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <SuperAdminLayout>
                    <SuperAdminAccountDetailPage />
                  </SuperAdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/users"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <SuperAdminLayout>
                    <SuperAdminUsersPage />
                  </SuperAdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin Routes - Wrapped with FinanceProvider */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminDashboard />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/kanban"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminKanbanPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leads"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminLeadsPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sales"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminSalesPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminEventsPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminFinancePage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminProductsPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agenda"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminAgendaPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/insights"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'agent']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminInsightsPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />
            {/* Agent Routes */}
            <Route
              path="/agent"
              element={
                <ProtectedRoute allowedRoles={['agent', 'admin', 'super_admin']}>
                  <AdminFinanceWrapper>
                    <AdminLayout>
                      <AdminKanbanPage />
                    </AdminLayout>
                  </AdminFinanceWrapper>
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
