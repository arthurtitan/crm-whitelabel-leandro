import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { Sale, SaleStatus } from '@/types/crm';
import { RefundConfirmationDialog } from '@/components/finance/RefundConfirmationDialog';
import { CreateSaleDialog } from '@/components/finance/CreateSaleDialog';
import { SaleItemsRow } from '@/components/finance/SaleItemsRow';
import { SaleDetailsSheet } from '@/components/finance/SaleDetailsSheet';
import { SalesAuditLog } from '@/components/finance/SalesAuditLog';
import { AgentFilter } from '@/components/dashboard/AgentFilter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSalesPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { 
    sales, 
    getContactById, 
    markAsPaid, 
    refundSale,
    kpis,
  } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'report'>('sales');
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; saleId: string | null; valor: number }>({
    open: false,
    saleId: null,
    valor: 0,
  });

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const contact = getContactById(sale.contact_id);
      const matchesSearch = contact?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
      
      // Filter by agent (responsavel_id)
      let matchesAgent = true;
      if (selectedAgent !== 'all' && isAdmin) {
        matchesAgent = sale.responsavel_id === selectedAgent;
      }
      
      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [sales, searchTerm, statusFilter, selectedAgent, isAdmin, getContactById]);

  // KPIs from context
  const totalRevenue = kpis.faturamentoBruto;
  const pendingSalesCount = kpis.vendasPendentes.count;
  const paidSalesCount = kpis.vendasPagas.count;
  const avgTicket = kpis.ticketMedio;

  const getContactName = (contactId: string) => {
    const contact = getContactById(contactId);
    return contact?.nome || 'Cliente';
  };

  const handleMarkAsPaid = (saleId: string) => {
    markAsPaid(saleId);
    toast.success('Pagamento confirmado!');
  };

  const handleRefundConfirm = (reason: string) => {
    if (!refundDialog.saleId) return;
    refundSale(refundDialog.saleId, reason);
    setRefundDialog({ open: false, saleId: null, valor: 0 });
  };

  const showTabs = isAdmin && user?.role === 'admin';

  // Sales content component to avoid duplication
  const SalesContent = () => (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Total</p>
                <p className="text-2xl font-bold text-success">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendas Pagas</p>
                <p className="text-2xl font-bold">{paidSalesCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-warning">{pendingSalesCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SaleStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="refunded">Estornados</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Agent Filter - Only for Admins */}
            {showTabs && (
              <AgentFilter value={selectedAgent} onChange={setSelectedAgent} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <SaleItemsRow
                    key={sale.id}
                    sale={sale}
                    contactName={getContactName(sale.contact_id)}
                    onMarkAsPaid={handleMarkAsPaid}
                    onRefundSale={(saleId, valor) => setRefundDialog({ open: true, saleId, valor })}
                    onInspect={(sale) => setSelectedSale(sale)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-gleps">Vendas</h1>
          <p className="text-muted-foreground">Gerencie vendas e pagamentos</p>
        </div>
        <CreateSaleDialog
          trigger={
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Nova Venda
            </Button>
          }
        />
      </div>

      {/* Conditional Tabs for Admins */}
      {showTabs ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sales' | 'report')}>
          <TabsList className="bg-muted">
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-2">
              <FileText className="w-4 h-4" />
              Relatório
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-6 space-y-6">
            <SalesContent />
          </TabsContent>

          <TabsContent value="report" className="mt-6">
            <SalesAuditLog />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          <SalesContent />
        </div>
      )}

      {/* Refund Dialog with Password Confirmation */}
      <RefundConfirmationDialog
        open={refundDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRefundDialog({ open: false, saleId: null, valor: 0 });
          }
        }}
        saleValue={refundDialog.valor}
        onConfirm={handleRefundConfirm}
      />

      {/* Sale Details Sheet */}
      <SaleDetailsSheet
        sale={selectedSale}
        open={!!selectedSale}
        onOpenChange={(open) => {
          if (!open) setSelectedSale(null);
        }}
        onMarkAsPaid={handleMarkAsPaid}
        onRefundSale={(saleId, valor) => setRefundDialog({ open: true, saleId, valor })}
      />
    </div>
  );
}
