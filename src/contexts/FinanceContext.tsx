import { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { Sale, SaleItem, Contact, LeadFunnelState, SaleStatus, PaymentMethod, Product, ContactOrigin, LeadNote } from '@/types/crm';
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

interface UpdateContactData {
  nome?: string;
  telefone?: string;
  email?: string | null;
  origem?: ContactOrigin;
}

/** Item individual para criação de venda */
export interface CreateSaleItem {
  productId: string;
  quantidade: number;
  valorUnitario: number;
}

interface CreateSaleData {
  contactId: string;
  /** @deprecated Use items[] para múltiplos produtos */
  productId?: string;
  items: CreateSaleItem[];
  metodoPagamento: PaymentMethod;
  responsavelId: string;
  convenioNome?: string;
  /**
   * Usado apenas quando a venda é criada no mesmo fluxo do cadastro do contato.
   * Evita falha de validação por causa do setState assíncrono (contato/etapa ainda não refletem no contexto).
   */
  skipValidation?: boolean;
}

interface FinanceContextType {
  // State
  sales: Sale[];
  contacts: Contact[];
  products: Product[];
  leadFunnelStates: LeadFunnelState[];
  leadNotes: LeadNote[];
  events: FinanceEvent[];
  
  // Derived KPIs
  kpis: FinanceKPIs;
  
  // Actions
  createSale: (data: CreateSaleData) => { success: boolean; error?: string };
  createContact: (data: CreateContactData) => { success: boolean; error?: string; contactId?: string };
  updateContact: (contactId: string, data: UpdateContactData) => { success: boolean; error?: string };
  deleteContact: (contactId: string) => { success: boolean; error?: string };
  updateLeadStage: (contactId: string, stageId: string) => void;
  addLeadNote: (contactId: string, content: string, authorId: string, authorName: string) => void;
  markAsPaid: (saleId: string) => void;
  cancelSale: (saleId: string) => void;
  refundSale: (saleId: string, reason: string) => void;
  refundSaleItem: (saleId: string, itemId: string, reason: string) => void;
  updateSale: (saleId: string, data: Partial<Sale>) => { success: boolean; error?: string };
  
  // Helpers
  getContactById: (id: string) => Contact | undefined;
  getContactSales: (contactId: string) => Sale[];
  getContactNotes: (contactId: string) => LeadNote[];
  getContactFunnelStage: (contactId: string) => string | null;
  getContactFunnelStageOrder: (contactId: string) => number;
  getProductById: (id: string) => Product | undefined;
  canCreateSale: (contactId: string) => { allowed: boolean; reason?: string };
  checkIsRecurringSale: (contactId: string, productId: string) => boolean;
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

  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  
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

  const getProductById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products]
  );

  const getContactSales = useCallback(
    (contactId: string) => sales.filter((s) => s.contact_id === contactId),
    [sales]
  );

  const getContactNotes = useCallback(
    (contactId: string) => leadNotes.filter((n) => n.contact_id === contactId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    [leadNotes]
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

  // Check if sale is recurring (same product purchased before)
  const checkIsRecurringSale = useCallback(
    (contactId: string, productId: string): boolean => {
      const previousSales = sales.filter(
        (s) => s.contact_id === contactId && s.product_id === productId
      );
      return previousSales.length > 0;
    },
    [sales]
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

  // Add lead note
  const addLeadNote = useCallback(
    (contactId: string, content: string, authorId: string, authorName: string) => {
      const newNote: LeadNote = {
        id: `note-${Date.now()}`,
        contact_id: contactId,
        author_id: authorId,
        author_name: authorName,
        content,
        created_at: new Date().toISOString(),
      };
      setLeadNotes((prev) => [newNote, ...prev]);
    },
    []
  );

  // Vendas podem ser criadas em QUALQUER etapa do Kanban
  // A validação de etapa avançada foi removida conforme regra de negócio
  const canCreateSale = useCallback(
    (contactId: string): { allowed: boolean; reason?: string } => {
      const contact = getContactById(contactId);
      if (!contact) {
        return { allowed: false, reason: 'Contato não encontrado' };
      }

      // Vendas permitidas em qualquer etapa do funil
      return { allowed: true };
    },
    [getContactById]
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

  // Update contact
  const updateContact = useCallback(
    (contactId: string, data: UpdateContactData): { success: boolean; error?: string } => {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) {
        return { success: false, error: 'Contato não encontrado' };
      }

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? {
                ...c,
                ...data,
                updated_at: new Date().toISOString(),
              }
            : c
        )
      );

      return { success: true };
    },
    [contacts]
  );

  // Delete contact
  const deleteContact = useCallback(
    (contactId: string): { success: boolean; error?: string } => {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) {
        return { success: false, error: 'Contato não encontrado' };
      }

      // Check if contact has sales
      const contactSales = sales.filter((s) => s.contact_id === contactId);
      if (contactSales.length > 0) {
        return { success: false, error: 'Não é possível remover lead com vendas registradas' };
      }

      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      setLeadFunnelStates((prev) => prev.filter((lfs) => lfs.contact_id !== contactId));
      setLeadNotes((prev) => prev.filter((n) => n.contact_id !== contactId));

      return { success: true };
    },
    [contacts, sales]
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
      if (!data.skipValidation) {
        const validation = canCreateSale(data.contactId);
        if (!validation.allowed) {
          return { success: false, error: validation.reason };
        }
      }

      // Build items array with generated IDs
      const saleId = `sale-${Date.now()}`;
      const items: SaleItem[] = data.items.map((item, index) => ({
        id: `item-${saleId}-${index}`,
        product_id: item.productId,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.quantidade * item.valorUnitario,
      }));

      // Calculate total value from items
      const valorTotal = items.reduce((sum, item) => sum + item.valor_total, 0);

      // Check if any product is recurring
      const isRecurring = data.items.some(item => 
        checkIsRecurringSale(data.contactId, item.productId)
      );

      const newSale: Sale = {
        id: saleId,
        account_id: accountId,
        contact_id: data.contactId,
        product_id: data.items[0]?.productId, // backwards compatibility
        items,
        valor: valorTotal,
        status: 'pending',
        metodo_pagamento: data.metodoPagamento,
        convenio_nome: data.convenioNome,
        responsavel_id: data.responsavelId,
        is_recurring: isRecurring,
        created_at: new Date().toISOString(),
        paid_at: null,
        refunded_at: null,
      };

      setSales((prev) => [newSale, ...prev]);
      createEvent('sale.created', newSale.id, { 
        contactId: data.contactId, 
        valor: valorTotal,
        itemsCount: items.length,
        isRecurring,
      });

      return { success: true };
    },
    [accountId, canCreateSale, checkIsRecurringSale, createEvent]
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

  const refundSaleItem = useCallback(
    (saleId: string, itemId: string, reason: string) => {
      setSales((prev) =>
        prev.map((s) => {
          if (s.id !== saleId) return s;

          // Mark the specific item as refunded
          const updatedItems = s.items.map((item) =>
            item.id === itemId
              ? { ...item, refunded: true, refunded_at: new Date().toISOString(), refund_reason: reason }
              : item
          );

          // Recalculate total value excluding refunded items
          const activeItems = updatedItems.filter((item) => !(item as any).refunded);
          const newTotal = activeItems.reduce((sum, item) => sum + item.valor_total, 0);

          // If all items are refunded, mark the sale as refunded
          const allRefunded = updatedItems.every((item) => (item as any).refunded);

          return {
            ...s,
            items: updatedItems,
            valor: newTotal,
            status: allRefunded ? ('refunded' as SaleStatus) : s.status,
            refunded_at: allRefunded ? new Date().toISOString() : s.refunded_at,
          };
        })
      );
      createEvent('sale.refunded', saleId, { itemId, reason, refunded_at: new Date().toISOString() });
    },
    [createEvent]
  );

  const updateSale = useCallback(
    (saleId: string, data: Partial<Sale>): { success: boolean; error?: string } => {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) {
        return { success: false, error: 'Venda não encontrada' };
      }

      setSales((prev) =>
        prev.map((s) =>
          s.id === saleId
            ? { ...s, ...data }
            : s
        )
      );

      return { success: true };
    },
    [sales]
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
    leadNotes,
    events,
    kpis,
    createSale,
    createContact,
    updateContact,
    deleteContact,
    updateLeadStage,
    addLeadNote,
    markAsPaid,
    cancelSale,
    refundSale,
    refundSaleItem,
    updateSale,
    getContactById,
    getContactSales,
    getContactNotes,
    getContactFunnelStage,
    getContactFunnelStageOrder,
    getProductById,
    canCreateSale,
    checkIsRecurringSale,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}
