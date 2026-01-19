import { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { Sale, Contact, LeadFunnelState, SaleStatus, PaymentMethod, Product, ContactOrigin } from '@/types/crm';
import { 
  mockSales, 
  mockContacts, 
  mockLeadFunnelStates, 
  mockFunnelStages,
  mockProducts 
} from '@/data/mockData';

// Event types for finance
interface FinanceEvent {
  id: string;
  type: 'sale.created' | 'sale.paid' | 'sale.cancelled' | 'sale.refunded';
  saleId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface CreateContactData {
  nome: string;
  telefone: string;
  email: string | null;
  origem: string;
}

interface CreateSaleData {
  contactId: string;
  productId: string;
  valor: number;
  metodoPagamento: PaymentMethod;
  responsavelId: string;
  convenioNome?: string;
}

interface FinanceContextType {
  // State
  sales: Sale[];
  contacts: Contact[];
  products: Product[];
  leadFunnelStates: LeadFunnelState[];
  events: FinanceEvent[];
  
  // Derived KPIs
  kpis: FinanceKPIs;
  
  // Actions
  createSale: (data: CreateSaleData) => { success: boolean; error?: string };
  createContact: (data: CreateContactData) => { success: boolean; error?: string; contactId?: string };
  updateLeadStage: (contactId: string, stageId: string) => void;
  markAsPaid: (saleId: string) => void;
  cancelSale: (saleId: string) => void;
  refundSale: (saleId: string, reason: string) => void;
  
  // Helpers
  getContactById: (id: string) => Contact | undefined;
  getContactFunnelStage: (contactId: string) => string | null;
  getContactFunnelStageOrder: (contactId: string) => number;
  canCreateSale: (contactId: string) => { allowed: boolean; reason?: string };
}

interface FinanceKPIs {
  faturamentoBruto: number;
  ticketMedio: number;
  totalVendas: number;
  vendasPagas: { count: number; valor: number };
  vendasPendentes: { count: number; valor: number };
  vendasCanceladas: { count: number; valor: number };
  vendasEstornadas: { count: number; valor: number };
  porMetodoPagamento: { method: PaymentMethod | 'none'; count: number; valor: number }[];
  leadsConvertidos: number;
  vendasCriadas: number;
  vendasPagasCount: number;
  faturamentoPorDia: { date: string; valor: number }[];
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}

interface FinanceProviderProps {
  children: ReactNode;
  accountId: string;
}

export function FinanceProvider({ children, accountId }: FinanceProviderProps) {
  const [sales, setSales] = useState<Sale[]>(
    mockSales.filter((s) => s.account_id === accountId)
  );
  
  const [contacts, setContacts] = useState<Contact[]>(
    mockContacts.filter((c) => c.account_id === accountId)
  );
  
  const [leadFunnelStates, setLeadFunnelStates] = useState<LeadFunnelState[]>(
    mockLeadFunnelStates.filter((lfs) => 
      mockContacts.filter((c) => c.account_id === accountId).some((c) => c.id === lfs.contact_id)
    )
  );
  
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  
  const products = useMemo(
    () => mockProducts.filter((p) => p.account_id === accountId && p.ativo),
    [accountId]
  );

  // Helper functions
  const getContactById = useCallback(
    (id: string) => contacts.find((c) => c.id === id),
    [contacts]
  );

  const getContactFunnelStage = useCallback(
    (contactId: string) => {
      const state = leadFunnelStates.find((lfs) => lfs.contact_id === contactId);
      if (!state?.funnel_stage_id) return null;
      const stage = mockFunnelStages.find((s) => s.id === state.funnel_stage_id);
      return stage?.nome || null;
    },
    [leadFunnelStates]
  );

  const getContactFunnelStageOrder = useCallback(
    (contactId: string): number => {
      const state = leadFunnelStates.find((lfs) => lfs.contact_id === contactId);
      if (!state?.funnel_stage_id) return 0;
      const stage = mockFunnelStages.find((s) => s.id === state.funnel_stage_id);
      return stage?.ordem || 0;
    },
    [leadFunnelStates]
  );

  // Update lead stage (for Kanban sync)
  const updateLeadStage = useCallback(
    (contactId: string, stageId: string) => {
      setLeadFunnelStates((prev) => {
        const existing = prev.find((lfs) => lfs.contact_id === contactId);
        if (existing) {
          return prev.map((lfs) =>
            lfs.contact_id === contactId
              ? { ...lfs, funnel_stage_id: stageId, updated_at: new Date().toISOString() }
              : lfs
          );
        }
        return [
          ...prev,
          {
            contact_id: contactId,
            funnel_stage_id: stageId,
            updated_at: new Date().toISOString(),
          },
        ];
      });
    },
    []
  );

  const canCreateSale = useCallback(
    (contactId: string): { allowed: boolean; reason?: string } => {
      const contact = getContactById(contactId);
      if (!contact) {
        return { allowed: false, reason: 'Contato não encontrado' };
      }

      const funnelState = leadFunnelStates.find((lfs) => lfs.contact_id === contactId);
      if (!funnelState?.funnel_stage_id) {
        return { allowed: false, reason: 'Lead não está no funil de vendas' };
      }

      const stage = mockFunnelStages.find((s) => s.id === funnelState.funnel_stage_id);
      if (!stage) {
        return { allowed: false, reason: 'Etapa do funil não encontrada' };
      }

      // Only allow sales from advanced stages (ordem >= 3: Interessado, Qualificado, Convertido)
      if (stage.ordem < 3) {
        return { 
          allowed: false, 
          reason: `Lead precisa estar em etapa avançada do funil (atual: ${stage.nome})` 
        };
      }

      return { allowed: true };
    },
    [getContactById, leadFunnelStates]
  );

  // Create contact
  const createContact = useCallback(
    (data: CreateContactData): { success: boolean; error?: string; contactId?: string } => {
      const newContact: Contact = {
        id: `contact-${Date.now()}`,
        account_id: accountId,
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        origem: data.origem as ContactOrigin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setContacts((prev) => [newContact, ...prev]);
      
      // Auto-add to funnel at advanced stage for immediate sale eligibility
      const qualifiedStage = mockFunnelStages.find((s) => s.nome === 'Qualificado');
      if (qualifiedStage) {
        setLeadFunnelStates((prev) => [
          { contact_id: newContact.id, funnel_stage_id: qualifiedStage.id, updated_at: new Date().toISOString() },
          ...prev,
        ]);
      }
      
      return { success: true, contactId: newContact.id };
    },
    [accountId]
  );

  // Create event helper
  const createEvent = useCallback((type: FinanceEvent['type'], saleId: string, payload: Record<string, unknown>) => {
    const event: FinanceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      saleId,
      payload,
      createdAt: new Date().toISOString(),
    };
    setEvents((prev) => [event, ...prev]);
    return event;
  }, []);

  // Actions
  const createSale = useCallback(
    (data: CreateSaleData): { success: boolean; error?: string } => {
      const validation = canCreateSale(data.contactId);
      if (!validation.allowed) {
        return { success: false, error: validation.reason };
      }

      const newSale: Sale = {
        id: `sale-${Date.now()}`,
        account_id: accountId,
        contact_id: data.contactId,
        product_id: data.productId,
        valor: data.valor,
        status: 'pending',
        metodo_pagamento: data.metodoPagamento,
        convenio_nome: data.convenioNome,
        responsavel_id: data.responsavelId,
        created_at: new Date().toISOString(),
        paid_at: null,
        refunded_at: null,
      };

      setSales((prev) => [newSale, ...prev]);
      createEvent('sale.created', newSale.id, { 
        contactId: data.contactId, 
        valor: data.valor 
      });

      return { success: true };
    },
    [accountId, canCreateSale, createEvent]
  );

  const markAsPaid = useCallback(
    (saleId: string) => {
      setSales((prev) =>
        prev.map((s) =>
          s.id === saleId
            ? { ...s, status: 'paid' as SaleStatus, paid_at: new Date().toISOString() }
            : s
        )
      );
      createEvent('sale.paid', saleId, { paid_at: new Date().toISOString() });
    },
    [createEvent]
  );

  const cancelSale = useCallback(
    (saleId: string) => {
      setSales((prev) =>
        prev.map((s) =>
          s.id === saleId
            ? { ...s, status: 'cancelled' as SaleStatus, cancelled_at: new Date().toISOString() }
            : s
        )
      );
      createEvent('sale.cancelled', saleId, { cancelled_at: new Date().toISOString() });
    },
    [createEvent]
  );

  const refundSale = useCallback(
    (saleId: string, reason: string) => {
      setSales((prev) =>
        prev.map((s) =>
          s.id === saleId
            ? { ...s, status: 'refunded' as SaleStatus, refunded_at: new Date().toISOString() }
            : s
        )
      );
      createEvent('sale.refunded', saleId, { reason, refunded_at: new Date().toISOString() });
    },
    [createEvent]
  );

  // Derived KPIs - computed from state
  const kpis = useMemo((): FinanceKPIs => {
    const paidSales = sales.filter((s) => s.status === 'paid');
    const pendingSales = sales.filter((s) => s.status === 'pending');
    const refundedSales = sales.filter((s) => s.status === 'refunded');

    const faturamentoBruto = paidSales.reduce((sum, s) => sum + s.valor, 0);
    const ticketMedio = paidSales.length > 0 ? faturamentoBruto / paidSales.length : 0;

    // By payment method
    const methodsMap = new Map<PaymentMethod | 'none', { count: number; valor: number }>();
    paidSales.forEach((s) => {
      const method = s.metodo_pagamento || 'none';
      const current = methodsMap.get(method) || { count: 0, valor: 0 };
      methodsMap.set(method, { count: current.count + 1, valor: current.valor + s.valor });
    });
    const porMetodoPagamento = Array.from(methodsMap.entries()).map(([method, data]) => ({
      method,
      ...data,
    }));

    // Funnel conversion
    const convertedStageIds = mockFunnelStages
      .filter((s) => s.ordem >= 4) // Qualificado ou Convertido
      .map((s) => s.id);
    
    const leadsConvertidos = leadFunnelStates.filter((lfs) =>
      lfs.funnel_stage_id && convertedStageIds.includes(lfs.funnel_stage_id)
    ).length;

    // Revenue by day (last 7 days)
    const today = new Date();
    const faturamentoPorDia: { date: string; valor: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayRevenue = paidSales
        .filter((s) => s.paid_at && s.paid_at.startsWith(dateStr))
        .reduce((sum, s) => sum + s.valor, 0);
      
      faturamentoPorDia.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: dayRevenue,
      });
    }

    return {
      faturamentoBruto,
      ticketMedio,
      totalVendas: sales.length,
      vendasPagas: {
        count: paidSales.length,
        valor: faturamentoBruto,
      },
      vendasPendentes: {
        count: pendingSales.length,
        valor: pendingSales.reduce((sum, s) => sum + s.valor, 0),
      },
      vendasCanceladas: {
        count: 0,
        valor: 0,
      },
      vendasEstornadas: {
        count: refundedSales.length,
        valor: refundedSales.reduce((sum, s) => sum + s.valor, 0),
      },
      porMetodoPagamento,
      leadsConvertidos,
      vendasCriadas: sales.length,
      vendasPagasCount: paidSales.length,
      faturamentoPorDia,
    };
  }, [sales, leadFunnelStates]);

  const value: FinanceContextType = {
    sales,
    contacts,
    products,
    leadFunnelStates,
    events,
    kpis,
    createSale,
    createContact,
    updateLeadStage,
    markAsPaid,
    cancelSale,
    refundSale,
    getContactById,
    getContactFunnelStage,
    getContactFunnelStageOrder,
    canCreateSale,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}
