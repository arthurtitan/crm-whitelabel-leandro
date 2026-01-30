import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DashboardMetrics {
  totalLeads: number;
  conversasAtivas: number;
  conversasResolvidas: number;
  conversasPendentes: number;
  conversasSemResposta: number;
  percentualIA: number;
  percentualHumano: number;
  tempoMedioPrimeiraResposta: string;
  tempoMedioResolucao: string;
  taxaTransbordo: string;
  conversasPorCanal: Array<{
    inboxId: number;
    canal: string;
    inboxName: string;
    totalConversas: number;
  }>;
  picoPorHora: Array<{
    hora: number;
    totalConversas: number;
  }>;
  backlog: {
    ate15min: number;
    de15a60min: number;
    acima60min: number;
  };
  agentes: Array<{
    agentId: number;
    agentName: string;
    agentEmail: string;
    thumbnail?: string;
    atendimentosAssumidos: number;
    atendimentosResolvidos: number;
    tempoMedioResposta: string;
    taxaResolucao: number;
  }>;
  qualidade: {
    conversasSemResposta: number;
    taxaAtendimentoVenda: string;
  };
}

interface UseChatwootMetricsParams {
  dateFrom: Date;
  dateTo: Date;
  inboxId?: number;
  agentId?: number;
  pollingInterval?: number;
  enablePolling?: boolean;
}

interface UseChatwootMetricsResult {
  data: DashboardMetrics | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  isTabActive: boolean;
  error: string | null;
  isConfigured: boolean;
  refetch: () => void;
}

const DEFAULT_METRICS: DashboardMetrics = {
  totalLeads: 0,
  conversasAtivas: 0,
  conversasResolvidas: 0,
  conversasPendentes: 0,
  conversasSemResposta: 0,
  percentualIA: 0,
  percentualHumano: 0,
  tempoMedioPrimeiraResposta: '0s',
  tempoMedioResolucao: '0s',
  taxaTransbordo: '0%',
  conversasPorCanal: [],
  picoPorHora: [],
  backlog: { ate15min: 0, de15a60min: 0, acima60min: 0 },
  agentes: [],
  qualidade: { conversasSemResposta: 0, taxaAtendimentoVenda: '0%' },
};

const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds

export function useChatwootMetrics({
  dateFrom,
  dateTo,
  inboxId,
  agentId,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  enablePolling = true,
}: UseChatwootMetricsParams): UseChatwootMetricsResult {
  const { account } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isTabActive, setIsTabActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isConfigured = Boolean(
    account?.chatwoot_base_url &&
    account?.chatwoot_account_id &&
    account?.chatwoot_api_key
  );

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchMetrics = useCallback(async () => {
    if (!isConfigured || !account) {
      setIsLoading(false);
      setData(DEFAULT_METRICS);
      return;
    }

    setIsLoading(true);
    setError(null);

    const TIMEOUT_MS = 45000; // 45 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      console.log('[useChatwootMetrics] Fetching metrics...', {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        inboxId,
        agentId,
      });

      const response = await fetch(
        `${supabaseUrl}/functions/v1/fetch-chatwoot-metrics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token 
              ? `Bearer ${session.access_token}` 
              : `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            baseUrl: account.chatwoot_base_url,
            accountId: account.chatwoot_account_id,
            apiKey: account.chatwoot_api_key,
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            inboxId,
            agentId,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[useChatwootMetrics] Response:', result);

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Erro ao carregar métricas');
        setData(DEFAULT_METRICS);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[useChatwootMetrics] Error:', err);
      
      if (err.name === 'AbortError') {
        setError('Timeout ao buscar métricas. O servidor Chatwoot pode estar lento.');
      } else {
        setError(err.message || 'Erro de conexão');
      }
      
      setData(DEFAULT_METRICS);
      
      toast({
        title: 'Erro ao carregar métricas',
        description: err.message || 'Não foi possível conectar ao Chatwoot',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
      setLastSyncAt(new Date().toISOString());
    }
  }, [account, dateFrom, dateTo, inboxId, agentId, isConfigured, toast]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Polling with visibility detection
  useEffect(() => {
    if (!isConfigured || !enablePolling) return;

    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          setIsSyncing(true);
          fetchMetrics();
        }
      }, pollingInterval);
    };

    if (isTabActive) {
      startPolling();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isConfigured, enablePolling, pollingInterval, isTabActive, fetchMetrics]);

  // Manual refetch that resets polling timer
  const refetch = useCallback(() => {
    setIsSyncing(true);
    fetchMetrics();
    
    // Reset polling timer
    if (intervalRef.current && enablePolling && isConfigured) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          setIsSyncing(true);
          fetchMetrics();
        }
      }, pollingInterval);
    }
  }, [fetchMetrics, enablePolling, isConfigured, pollingInterval]);

  return {
    data,
    isLoading,
    isSyncing,
    lastSyncAt,
    isTabActive,
    error,
    isConfigured,
    refetch,
  };
}
