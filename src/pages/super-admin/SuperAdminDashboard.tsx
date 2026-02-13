import { useState, useEffect } from 'react';
import { Building2, Users, CheckCircle, PauseCircle, Contact, DollarSign, TrendingUp } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SuperAdminKPIs {
  totalAccounts: number;
  activeAccounts: number;
  pausedAccounts: number;
  totalUsers: number;
  activeUsers: number;
  totalContacts: number;
  totalPaidSales: number;
  totalRevenue: number;
}

export default function SuperAdminDashboard() {
  const [kpis, setKpis] = useState<SuperAdminKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const { data, error } = await supabase.functions.invoke('super-admin-kpis');
        if (error) throw error;
        setKpis(data);
      } catch (err: any) {
        console.error('Erro ao buscar KPIs:', err);
        toast({
          title: 'Erro ao carregar dados',
          description: err.message || 'Não foi possível carregar os KPIs do dashboard.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchKPIs();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const kpiCards = [
    {
      title: 'Total de Contas',
      value: kpis?.totalAccounts ?? 0,
      icon: Building2,
      iconColor: 'text-primary',
      iconBgColor: 'bg-primary/10',
    },
    {
      title: 'Contas Ativas',
      value: kpis?.activeAccounts ?? 0,
      icon: CheckCircle,
      iconColor: 'text-success',
      iconBgColor: 'bg-success/10',
    },
    {
      title: 'Contas Pausadas',
      value: kpis?.pausedAccounts ?? 0,
      icon: PauseCircle,
      iconColor: 'text-warning',
      iconBgColor: 'bg-warning/10',
    },
    {
      title: 'Total de Usuários',
      value: kpis?.totalUsers ?? 0,
      subtitle: `${kpis?.activeUsers ?? 0} ativos`,
      icon: Users,
      iconColor: 'text-info',
      iconBgColor: 'bg-info/10',
    },
    {
      title: 'Total de Contatos',
      value: kpis?.totalContacts ?? 0,
      icon: Contact,
      iconColor: 'text-accent-foreground',
      iconBgColor: 'bg-accent',
    },
    {
      title: 'Vendas Pagas',
      value: kpis?.totalPaidSales ?? 0,
      icon: DollarSign,
      iconColor: 'text-success',
      iconBgColor: 'bg-success/10',
    },
    {
      title: 'Receita Total',
      value: formatCurrency(kpis?.totalRevenue ?? 0),
      icon: TrendingUp,
      iconColor: 'text-primary',
      iconBgColor: 'bg-primary/10',
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Dashboard Global</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Visão geral de todas as contas, usuários e receita
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <KPICard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            icon={kpi.icon}
            iconColor={kpi.iconColor}
            iconBgColor={kpi.iconBgColor}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
