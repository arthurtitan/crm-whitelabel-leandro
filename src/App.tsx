import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { TagProvider } from "@/contexts/TagContext";
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
import AdminConversationsPage from "./pages/admin/AdminConversationsPage";
import AdminFinancePage from "./pages/admin/AdminFinancePage";

const queryClient = new QueryClient();

// Wrapper component to provide FinanceContext and TagContext with accountId from AuthContext
function AdminFinanceWrapper({ children }: { children: React.ReactNode }) {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';
  return (
    <FinanceProvider accountId={accountId}>
      <TagProvider accountId={accountId}>
        {children}
      </TagProvider>
    </FinanceProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <div className="dark">
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
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
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
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
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <AdminFinanceWrapper>
                      <AdminLayout>
                        <AdminLeadsPage />
                      </AdminLayout>
                    </AdminFinanceWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/conversations"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <AdminFinanceWrapper>
                      <AdminLayout>
                        <AdminConversationsPage />
                      </AdminLayout>
                    </AdminFinanceWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/sales"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
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
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
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
                  <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                    <AdminFinanceWrapper>
                      <AdminLayout>
                        <AdminFinancePage />
                      </AdminLayout>
                    </AdminFinanceWrapper>
                  </ProtectedRoute>
                }
              />

              {/* Agent Routes - Reuse Admin Layout with agent access */}
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
          </BrowserRouter>
        </div>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
