/**
 * Finance Backend Service
 * 
 * Handles sales, products, contacts, and finance operations
 * via the Express backend API when VITE_USE_BACKEND=true.
 */

import { apiClient, ApiResponse } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type { Sale, Product, Contact, LeadNote, SaleItem, PaymentMethod, ContactOrigin } from '@/types/crm';

// ============= SALES =============

export interface CreateSaleBackendData {
  contactId: string;
  items: { productId: string; quantidade: number; valorUnitario: number }[];
  metodoPagamento: PaymentMethod;
  responsavelId: string;
  convenioNome?: string;
}

export const financeBackendService = {
  // --- Sales ---

  fetchSales: async (accountId: string): Promise<Sale[]> => {
    const res = await apiClient.get<ApiResponse<Sale[]>>(API_ENDPOINTS.SALES.LIST);
    return res.data || [];
  },

  createSale: async (data: CreateSaleBackendData): Promise<Sale> => {
    const res = await apiClient.post<ApiResponse<Sale>>(API_ENDPOINTS.SALES.CREATE, data);
    return res.data;
  },

  markAsPaid: async (saleId: string): Promise<Sale> => {
    const res = await apiClient.patch<ApiResponse<Sale>>(API_ENDPOINTS.SALES.MARK_PAID(saleId));
    return res.data;
  },

  refundSale: async (saleId: string, reason: string): Promise<Sale> => {
    const res = await apiClient.post<ApiResponse<Sale>>(API_ENDPOINTS.SALES.REFUND(saleId), { reason });
    return res.data;
  },

  refundSaleItem: async (saleId: string, itemId: string, reason: string): Promise<Sale> => {
    const res = await apiClient.post<ApiResponse<Sale>>(
      API_ENDPOINTS.SALES.REFUND_ITEM(saleId, itemId),
      { reason }
    );
    return res.data;
  },

  getSaleKPIs: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await apiClient.get<ApiResponse<any>>(API_ENDPOINTS.SALES.STATS, { params });
    return res.data;
  },

  getAuditLog: async (saleId: string) => {
    const res = await apiClient.get<ApiResponse<any[]>>(API_ENDPOINTS.SALES.TRANSACTIONS(saleId));
    return res.data || [];
  },

  // --- Products ---

  fetchProducts: async (accountId: string): Promise<Product[]> => {
    const res = await apiClient.get<ApiResponse<Product[]>>(API_ENDPOINTS.PRODUCTS.LIST, {
      params: { ativo: true },
    });
    return res.data || [];
  },

  // --- Contacts ---

  fetchContacts: async (accountId: string): Promise<Contact[]> => {
    const res = await apiClient.get<ApiResponse<Contact[]>>(API_ENDPOINTS.CONTACTS.LIST);
    return res.data || [];
  },

  createContact: async (accountId: string, data: {
    nome: string;
    telefone: string;
    email: string | null;
    origem: string;
  }): Promise<Contact> => {
    const res = await apiClient.post<ApiResponse<Contact>>(API_ENDPOINTS.CONTACTS.CREATE, data);
    return res.data;
  },

  updateContact: async (contactId: string, data: {
    nome?: string;
    telefone?: string;
    email?: string | null;
    origem?: ContactOrigin;
  }): Promise<Contact> => {
    const res = await apiClient.put<ApiResponse<Contact>>(API_ENDPOINTS.CONTACTS.UPDATE(contactId), data);
    return res.data;
  },

  deleteContact: async (contactId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.CONTACTS.DELETE(contactId));
  },

  // --- Notes ---

  fetchNotes: async (contactId: string): Promise<LeadNote[]> => {
    const res = await apiClient.get<ApiResponse<LeadNote[]>>(API_ENDPOINTS.CONTACTS.NOTES(contactId));
    return res.data || [];
  },

  addNote: async (contactId: string, content: string, authorId: string, authorName: string): Promise<LeadNote> => {
    const res = await apiClient.post<ApiResponse<LeadNote>>(API_ENDPOINTS.CONTACTS.ADD_NOTE(contactId), {
      content,
      authorId,
      authorName,
    });
    return res.data;
  },

  // --- Finance KPIs ---

  getFinanceKPIs: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await apiClient.get<ApiResponse<any>>('/api/finance/kpis', { params });
    return res.data;
  },

  getRevenueChart: async (params?: { startDate?: string; endDate?: string; granularity?: string }) => {
    const res = await apiClient.get<ApiResponse<any>>('/api/finance/revenue-chart', { params });
    return res.data;
  },

  getPaymentMethods: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await apiClient.get<ApiResponse<any>>('/api/finance/payment-methods', { params });
    return res.data;
  },

  getFunnelConversion: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await apiClient.get<ApiResponse<any>>('/api/finance/funnel-conversion', { params });
    return res.data;
  },
};

export default financeBackendService;
