import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSuperAdminKPIs, getServerResources, mockServerConsumptionHistory, mockWeeklyConsumption } from '@/data/mockData';
import { mockAccounts, mockUsers } from '@/data/mockData';
import { Building2, Users, CheckCircle, PauseCircle, Cpu, HardDrive, Wifi, MemoryStick } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Line, LineChart } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SuperAdminDashboard() {
  const kpis = getSuperAdminKPIs();
  const serverResources = getServerResources();

  const kpiCards = [
    {
      title: 'Total de Contas',
      value: kpis.total_accounts,
      icon: Building2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total de Usuários',
      value: kpis.total_users,
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Contas Ativas',
      value: kpis.active_accounts,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Contas Pausadas',
      value: kpis.paused_accounts,
      icon: PauseCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  // Formatar dados de consumo para os gráficos
  const consumptionChartData = mockServerConsumptionHistory.map((item) => ({
    ...item,
    time: format(new Date(item.timestamp), 'HH:mm'),
  }));

  const chartConfig = {
    cpu: { label: 'CPU %', color: 'hsl(var(--primary))' },
    ram: { label: 'RAM %', color: 'hsl(var(--info))' },
    disk: { label: 'Disco %', color: 'hsl(var(--warning))' },
    network_in: { label: 'Entrada MB/s', color: 'hsl(var(--success))' },
    network_out: { label: 'Saída MB/s', color: 'hsl(var(--destructive))' },
  };

  const weeklyChartConfig = {
    cpu_avg: { label: 'CPU Média %', color: 'hsl(var(--primary))' },
    ram_avg: { label: 'RAM Média %', color: 'hsl(var(--info))' },
    requests: { label: 'Requisições', color: 'hsl(var(--success))' },
  };

  const getProgressColor = (value: number, threshold: number = 80) => {
    if (value >= threshold) return 'bg-destructive';
    if (value >= threshold * 0.7) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Global</h1>
        <p className="text-muted-foreground">
          Visão geral de todas as contas, usuários e consumo de recursos do servidor
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <p className="text-3xl font-bold">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${kpi.bgColor}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Server Resources - Real-time Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">CPU</p>
                <p className="text-xs text-muted-foreground">{serverResources.cpu_used}% de {serverResources.cpu_total}%</p>
              </div>
            </div>
            <Progress value={serverResources.cpu_used} className="h-2" />
            <p className={`text-xs mt-2 ${serverResources.cpu_used >= 80 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {serverResources.cpu_used >= 80 ? '⚠️ Considere upgrade' : 'Uso normal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-info/10">
                <MemoryStick className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-sm font-medium">RAM</p>
                <p className="text-xs text-muted-foreground">{serverResources.ram_used}GB de {serverResources.ram_total}GB</p>
              </div>
            </div>
            <Progress value={(serverResources.ram_used / serverResources.ram_total) * 100} className="h-2" />
            <p className={`text-xs mt-2 ${(serverResources.ram_used / serverResources.ram_total) >= 0.8 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {(serverResources.ram_used / serverResources.ram_total) >= 0.8 ? '⚠️ Memória alta' : `${(serverResources.ram_total - serverResources.ram_used).toFixed(1)}GB disponível`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <HardDrive className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium">NVMe/Disco</p>
                <p className="text-xs text-muted-foreground">{serverResources.disk_used}GB de {serverResources.disk_total}GB</p>
              </div>
            </div>
            <Progress value={(serverResources.disk_used / serverResources.disk_total) * 100} className="h-2" />
            <p className="text-xs mt-2 text-muted-foreground">
              {serverResources.disk_total - serverResources.disk_used}GB livres
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Wifi className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium">Rede</p>
                <p className="text-xs text-muted-foreground">{serverResources.network_bandwidth}Mbps de {serverResources.network_limit}Mbps</p>
              </div>
            </div>
            <Progress value={(serverResources.network_bandwidth / serverResources.network_limit) * 100} className="h-2" />
            <p className="text-xs mt-2 text-muted-foreground">
              Largura de banda OK
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU & RAM Usage - Last 24h */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">CPU & RAM - Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <AreaChart data={consumptionChartData}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area type="monotone" dataKey="cpu" name="CPU %" stroke="hsl(var(--primary))" fill="url(#cpuGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="ram" name="RAM %" stroke="hsl(var(--info))" fill="url(#ramGradient)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Network Traffic - Last 24h */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Tráfego de Rede - Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <LineChart data={consumptionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="network_in" name="Entrada MB/s" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="network_out" name="Saída MB/s" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Weekly Average Consumption */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Consumo Médio Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={weeklyChartConfig} className="h-[280px] w-full">
              <BarChart data={mockWeeklyConsumption}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="cpu_avg" name="CPU %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ram_avg" name="RAM %" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Disk Usage Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Uso de Disco - Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <AreaChart data={consumptionChartData}>
                <defs>
                  <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="disk" name="Disco %" stroke="hsl(var(--warning))" fill="url(#diskGradient)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Scaling Recommendations */}
      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-info/10">
              <Cpu className="w-6 h-6 text-info" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Recomendações de Escalabilidade</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>CPU:</strong> {serverResources.cpu_used >= 70 ? 'Considere adicionar mais vCPUs se picos frequentes acima de 80%' : 'Uso saudável, sem necessidade de upgrade'}</li>
                <li>• <strong>RAM:</strong> {(serverResources.ram_used / serverResources.ram_total) >= 0.75 ? 'Considere upgrade para 32GB se crescimento continuar' : 'Margem confortável disponível'}</li>
                <li>• <strong>Disco NVMe:</strong> {(serverResources.disk_used / serverResources.disk_total) >= 0.7 ? 'Planeje expansão de storage em breve' : 'Espaço suficiente para crescimento'}</li>
                <li>• <strong>Rede:</strong> Bandwidth adequada para a carga atual</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
