import { useState } from 'react';
import { Download, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportXMLButtonProps {
  period: string;
}

export function ExportXMLButton({ period }: ExportXMLButtonProps) {
  const { sales, contacts, products, kpis, events } = useFinance();
  const { account } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const getPeriodLabel = (periodKey: string): string => {
    const labels: Record<string, string> = {
      '7d': 'Últimos 7 dias',
      '30d': 'Últimos 30 dias',
      '90d': 'Últimos 90 dias',
      'all': 'Todo o período',
    };
    return labels[periodKey] || periodKey;
  };

  const getPeriodDates = (periodKey: string): { start: Date; end: Date } => {
    const end = new Date();
    const start = new Date();
    
    switch (periodKey) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setFullYear(2020);
    }
    
    return { start, end };
  };

  const escapeXML = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const generateExcelXML = (): string => {
    const { start, end } = getPeriodDates(period);
    const periodLabel = getPeriodLabel(period);
    const exportDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Filter sales by period
    const filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= start && saleDate <= end;
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="R$ #,##0.00"/>
    </Style>
  </Styles>

  <Worksheet ss:Name="Resumo">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Relatório Financeiro</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Conta:</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(account?.nome || 'Conta')}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Data Exportação:</Data></Cell>
        <Cell><Data ss:Type="String">${exportDate}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Período:</Data></Cell>
        <Cell><Data ss:Type="String">${periodLabel}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Data Início:</Data></Cell>
        <Cell><Data ss:Type="String">${format(start, 'dd/MM/yyyy')}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Data Fim:</Data></Cell>
        <Cell><Data ss:Type="String">${format(end, 'dd/MM/yyyy')}</Data></Cell>
      </Row>
      <Row></Row>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">KPIs Financeiros</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Faturamento Bruto:</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kpis.faturamentoBruto}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Ticket Médio:</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kpis.ticketMedio}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Total de Vendas:</Data></Cell>
        <Cell><Data ss:Type="Number">${kpis.totalVendas}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Vendas Pagas:</Data></Cell>
        <Cell><Data ss:Type="Number">${kpis.vendasPagas.count}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kpis.vendasPagas.valor}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Vendas Pendentes:</Data></Cell>
        <Cell><Data ss:Type="Number">${kpis.vendasPendentes.count}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kpis.vendasPendentes.valor}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Vendas Estornadas:</Data></Cell>
        <Cell><Data ss:Type="Number">${kpis.vendasEstornadas.count}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${kpis.vendasEstornadas.valor}</Data></Cell>
      </Row>
      <Row></Row>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Métodos de Pagamento</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Qtd</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Valor</Data></Cell>
      </Row>
`;

    kpis.porMetodoPagamento.forEach((method) => {
      xml += `      <Row>
        <Cell><Data ss:Type="String">${escapeXML(method.method)}</Data></Cell>
        <Cell><Data ss:Type="Number">${method.count}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${method.valor}</Data></Cell>
      </Row>
`;
    });

    xml += `    </Table>
  </Worksheet>

  <Worksheet ss:Name="Vendas">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">ID</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Valor</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Método Pagamento</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Convênio</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Recorrente</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Data Criação</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Data Pagamento</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Cliente</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Telefone</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Email</Data></Cell>
      </Row>
`;

    filteredSales.forEach((sale) => {
      const contact = contacts.find((c) => c.id === sale.contact_id);
      xml += `      <Row>
        <Cell><Data ss:Type="String">${escapeXML(sale.id)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(sale.status)}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${sale.valor}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(sale.metodo_pagamento || 'Não definido')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(sale.convenio_nome || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${sale.is_recurring ? 'Sim' : 'Não'}</Data></Cell>
        <Cell><Data ss:Type="String">${format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}</Data></Cell>
        <Cell><Data ss:Type="String">${sale.paid_at ? format(new Date(sale.paid_at), 'dd/MM/yyyy HH:mm') : ''}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(contact?.nome || 'Cliente não identificado')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(contact?.telefone || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(contact?.email || '')}</Data></Cell>
      </Row>
`;
    });

    xml += `    </Table>
  </Worksheet>

  <Worksheet ss:Name="Itens Vendidos">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Venda ID</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Produto</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Quantidade</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Valor Unitário</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Valor Total</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Estornado</Data></Cell>
      </Row>
`;

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const itemProduct = products.find((p) => p.id === item.product_id);
        xml += `      <Row>
        <Cell><Data ss:Type="String">${escapeXML(sale.id)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXML(itemProduct?.nome || 'Produto')}</Data></Cell>
        <Cell><Data ss:Type="Number">${item.quantidade}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.valor_unitario}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${item.valor_total}</Data></Cell>
        <Cell><Data ss:Type="String">${(item as any).refunded ? 'Sim' : 'Não'}</Data></Cell>
      </Row>
`;
      });
    });

    xml += `    </Table>
  </Worksheet>

  <Worksheet ss:Name="Faturamento por Dia">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Data</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Valor</Data></Cell>
      </Row>
`;

    kpis.faturamentoPorDia.forEach((day) => {
      xml += `      <Row>
        <Cell><Data ss:Type="String">${escapeXML(day.date)}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${day.valor}</Data></Cell>
      </Row>
`;
    });

    xml += `    </Table>
  </Worksheet>

</Workbook>`;

    return xml;
  };

  const handleExport = () => {
    setIsExporting(true);
    
    try {
      const xml = generateExcelXML();
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const fileName = `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xls`;
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Relatório exportado com sucesso!', {
        description: fileName,
      });
    } catch (error) {
      toast.error('Erro ao exportar relatório');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
    >
      <FileCode className="w-4 h-4" />
      <span className="hidden sm:inline">Exportar XML</span>
      <span className="sm:hidden">XML</span>
    </Button>
  );
}
