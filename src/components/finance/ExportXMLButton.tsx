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

  const generateXML = (): string => {
    const { start, end } = getPeriodDates(period);
    const periodLabel = getPeriodLabel(period);
    const exportDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Filter sales by period
    const filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= start && saleDate <= end;
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<RelatorioFinanceiro>
  <Cabecalho>
    <Conta>${escapeXML(account?.nome || 'Conta')}</Conta>
    <DataExportacao>${exportDate}</DataExportacao>
    <Periodo>
      <Descricao>${periodLabel}</Descricao>
      <DataInicio>${format(start, 'yyyy-MM-dd')}</DataInicio>
      <DataFim>${format(end, 'yyyy-MM-dd')}</DataFim>
    </Periodo>
  </Cabecalho>

  <ResumoFinanceiro>
    <FaturamentoBruto>${kpis.faturamentoBruto.toFixed(2)}</FaturamentoBruto>
    <FaturamentoBrutoFormatado>${formatCurrency(kpis.faturamentoBruto)}</FaturamentoBrutoFormatado>
    <TicketMedio>${kpis.ticketMedio.toFixed(2)}</TicketMedio>
    <TicketMedioFormatado>${formatCurrency(kpis.ticketMedio)}</TicketMedioFormatado>
    <TotalVendas>${kpis.totalVendas}</TotalVendas>
    <VendasPagas>
      <Quantidade>${kpis.vendasPagas.count}</Quantidade>
      <Valor>${kpis.vendasPagas.valor.toFixed(2)}</Valor>
      <ValorFormatado>${formatCurrency(kpis.vendasPagas.valor)}</ValorFormatado>
    </VendasPagas>
    <VendasPendentes>
      <Quantidade>${kpis.vendasPendentes.count}</Quantidade>
      <Valor>${kpis.vendasPendentes.valor.toFixed(2)}</Valor>
      <ValorFormatado>${formatCurrency(kpis.vendasPendentes.valor)}</ValorFormatado>
    </VendasPendentes>
    <VendasEstornadas>
      <Quantidade>${kpis.vendasEstornadas.count}</Quantidade>
      <Valor>${kpis.vendasEstornadas.valor.toFixed(2)}</Valor>
      <ValorFormatado>${formatCurrency(kpis.vendasEstornadas.valor)}</ValorFormatado>
    </VendasEstornadas>
  </ResumoFinanceiro>

  <MetodosPagamento>
`;

    kpis.porMetodoPagamento.forEach((method) => {
      xml += `    <Metodo>
      <Nome>${escapeXML(method.method)}</Nome>
      <Quantidade>${method.count}</Quantidade>
      <Valor>${method.valor.toFixed(2)}</Valor>
      <ValorFormatado>${formatCurrency(method.valor)}</ValorFormatado>
    </Metodo>
`;
    });

    xml += `  </MetodosPagamento>

  <Vendas total="${filteredSales.length}">
`;

    filteredSales.forEach((sale) => {
      const contact = contacts.find((c) => c.id === sale.contact_id);
      const product = products.find((p) => p.id === sale.product_id);

      xml += `    <Venda>
      <ID>${escapeXML(sale.id)}</ID>
      <Status>${escapeXML(sale.status)}</Status>
      <Valor>${sale.valor.toFixed(2)}</Valor>
      <ValorFormatado>${formatCurrency(sale.valor)}</ValorFormatado>
      <MetodoPagamento>${escapeXML(sale.metodo_pagamento || 'Não definido')}</MetodoPagamento>
      <Convenio>${escapeXML(sale.convenio_nome || '')}</Convenio>
      <Recorrente>${sale.is_recurring ? 'Sim' : 'Não'}</Recorrente>
      <DataCriacao>${sale.created_at}</DataCriacao>
      <DataPagamento>${sale.paid_at || ''}</DataPagamento>
      <DataEstorno>${sale.refunded_at || ''}</DataEstorno>
      <Cliente>
        <ID>${escapeXML(contact?.id || '')}</ID>
        <Nome>${escapeXML(contact?.nome || 'Cliente não identificado')}</Nome>
        <Telefone>${escapeXML(contact?.telefone || '')}</Telefone>
        <Email>${escapeXML(contact?.email || '')}</Email>
        <Origem>${escapeXML(contact?.origem || '')}</Origem>
      </Cliente>
      <Itens>
`;

      sale.items.forEach((item) => {
        const itemProduct = products.find((p) => p.id === item.product_id);
        xml += `        <Item>
          <ProdutoID>${escapeXML(item.product_id)}</ProdutoID>
          <ProdutoNome>${escapeXML(itemProduct?.nome || 'Produto')}</ProdutoNome>
          <Quantidade>${item.quantidade}</Quantidade>
          <ValorUnitario>${item.valor_unitario.toFixed(2)}</ValorUnitario>
          <ValorTotal>${item.valor_total.toFixed(2)}</ValorTotal>
          <Estornado>${(item as any).refunded ? 'Sim' : 'Não'}</Estornado>
        </Item>
`;
      });

      xml += `      </Itens>
    </Venda>
`;
    });

    xml += `  </Vendas>

  <FaturamentoPorDia>
`;

    kpis.faturamentoPorDia.forEach((day) => {
      xml += `    <Dia>
      <Data>${escapeXML(day.date)}</Data>
      <Valor>${day.valor.toFixed(2)}</Valor>
      <ValorFormatado>${formatCurrency(day.valor)}</ValorFormatado>
    </Dia>
`;
    });

    xml += `  </FaturamentoPorDia>

  <Funil>
    <LeadsConvertidos>${kpis.leadsConvertidos}</LeadsConvertidos>
    <VendasCriadas>${kpis.vendasCriadas}</VendasCriadas>
    <VendasPagas>${kpis.vendasPagasCount}</VendasPagas>
  </Funil>

</RelatorioFinanceiro>`;

    return xml;
  };

  const handleExport = () => {
    setIsExporting(true);
    
    try {
      const xml = generateXML();
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const fileName = `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xml`;
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
