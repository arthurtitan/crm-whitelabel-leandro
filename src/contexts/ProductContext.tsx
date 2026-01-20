import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Product, PaymentMethod } from '@/types/crm';
import { mockProducts } from '@/data/mockData';

// ============= TYPES =============

export interface CreateProductData {
  nome: string;
  valor_padrao: number;
  metodos_pagamento: PaymentMethod[];
  convenios_aceitos: string[];
  ativo: boolean;
}

export interface UpdateProductData {
  nome?: string;
  valor_padrao?: number;
  metodos_pagamento?: PaymentMethod[];
  convenios_aceitos?: string[];
  ativo?: boolean;
}

interface ProductContextType {
  products: Product[];
  convenios: string[];
  
  // CRUD operations
  createProduct: (data: CreateProductData) => { success: boolean; productId?: string; error?: string };
  updateProduct: (productId: string, data: UpdateProductData) => { success: boolean; error?: string };
  toggleProductStatus: (productId: string) => { success: boolean; error?: string };
  deleteProduct: (productId: string) => { success: boolean; error?: string };
  
  // Convenio management
  addConvenio: (nome: string) => void;
  removeConvenio: (nome: string) => void;
  
  // Helpers
  getProductById: (productId: string) => Product | undefined;
  getActiveProducts: () => Product[];
}

interface ProductProviderProps {
  children: ReactNode;
  accountId: string;
}

// ============= CONTEXT =============

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function useProduct() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
}

// ============= PROVIDER =============

export function ProductProvider({ children, accountId }: ProductProviderProps) {
  // Initialize products from mock data filtered by accountId
  const [products, setProducts] = useState<Product[]>(() =>
    mockProducts.filter((p) => p.account_id === accountId).map(p => ({
      ...p,
      convenios_aceitos: p.convenios_aceitos || [],
      updated_at: p.updated_at || p.created_at,
    }))
  );

  // Global convenios list for the account
  const [convenios, setConvenios] = useState<string[]>([
    'Unimed',
    'Bradesco Saúde',
    'Amil',
    'SulAmérica',
    'NotreDame Intermédica',
    'Hapvida',
    'Porto Seguro',
    'GEAP',
  ]);

  // ============= CRUD OPERATIONS =============

  const createProduct = useCallback((data: CreateProductData) => {
    // TODO: Backend integration
    // POST /api/products
    // Body: { nome, valor_padrao, metodos_pagamento, convenios_aceitos, ativo }

    if (!data.nome.trim()) {
      return { success: false, error: 'Nome é obrigatório' };
    }

    if (data.valor_padrao <= 0) {
      return { success: false, error: 'Valor deve ser maior que zero' };
    }

    if (data.metodos_pagamento.length === 0) {
      return { success: false, error: 'Selecione ao menos um método de pagamento' };
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      account_id: accountId,
      nome: data.nome.trim(),
      valor_padrao: data.valor_padrao,
      metodos_pagamento: data.metodos_pagamento,
      convenios_aceitos: data.convenios_aceitos,
      ativo: data.ativo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setProducts((prev) => [...prev, newProduct]);
    return { success: true, productId: newProduct.id };
  }, [accountId]);

  const updateProduct = useCallback((productId: string, data: UpdateProductData) => {
    // TODO: Backend integration
    // PUT /api/products/:id
    // Body: { nome?, valor_padrao?, metodos_pagamento?, convenios_aceitos?, ativo? }

    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) {
      return { success: false, error: 'Produto não encontrado' };
    }

    if (data.nome !== undefined && !data.nome.trim()) {
      return { success: false, error: 'Nome é obrigatório' };
    }

    if (data.valor_padrao !== undefined && data.valor_padrao <= 0) {
      return { success: false, error: 'Valor deve ser maior que zero' };
    }

    if (data.metodos_pagamento !== undefined && data.metodos_pagamento.length === 0) {
      return { success: false, error: 'Selecione ao menos um método de pagamento' };
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              ...data,
              nome: data.nome?.trim() ?? p.nome,
              updated_at: new Date().toISOString(),
            }
          : p
      )
    );

    return { success: true };
  }, [products]);

  const toggleProductStatus = useCallback((productId: string) => {
    // TODO: Backend integration
    // PATCH /api/products/:id/status

    const product = products.find((p) => p.id === productId);
    if (!product) {
      return { success: false, error: 'Produto não encontrado' };
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, ativo: !p.ativo, updated_at: new Date().toISOString() }
          : p
      )
    );

    return { success: true };
  }, [products]);

  const deleteProduct = useCallback((productId: string) => {
    // TODO: Backend integration
    // DELETE /api/products/:id
    // Note: Should validate no sales exist for this product before deleting

    const product = products.find((p) => p.id === productId);
    if (!product) {
      return { success: false, error: 'Produto não encontrado' };
    }

    // In real implementation, check if product has sales
    // For now, just delete
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    return { success: true };
  }, [products]);

  // ============= CONVENIO MANAGEMENT =============

  const addConvenio = useCallback((nome: string) => {
    // TODO: Backend integration
    // POST /api/convenios
    const trimmedName = nome.trim();
    if (trimmedName && !convenios.includes(trimmedName)) {
      setConvenios((prev) => [...prev, trimmedName]);
    }
  }, [convenios]);

  const removeConvenio = useCallback((nome: string) => {
    // TODO: Backend integration
    // DELETE /api/convenios/:nome
    setConvenios((prev) => prev.filter((c) => c !== nome));
  }, []);

  // ============= HELPERS =============

  const getProductById = useCallback(
    (productId: string) => products.find((p) => p.id === productId),
    [products]
  );

  const getActiveProducts = useCallback(
    () => products.filter((p) => p.ativo),
    [products]
  );

  // ============= CONTEXT VALUE =============

  const value = useMemo<ProductContextType>(
    () => ({
      products,
      convenios,
      createProduct,
      updateProduct,
      toggleProductStatus,
      deleteProduct,
      addConvenio,
      removeConvenio,
      getProductById,
      getActiveProducts,
    }),
    [
      products,
      convenios,
      createProduct,
      updateProduct,
      toggleProductStatus,
      deleteProduct,
      addConvenio,
      removeConvenio,
      getProductById,
      getActiveProducts,
    ]
  );

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}
