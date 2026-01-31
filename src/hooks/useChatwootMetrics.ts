import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DashboardMetrics {
  totalLeads: number;
  conversasAtivas: number;
  conversasResolvidas: number;
  conversasPendentes: number;
  conversasSemResposta: number;

  // Contagens absolutas (preferir no UI para evitar arredondamento)
  atendimentosIA?: number;
  atendimentosHumano?: number;
  atendimentosClassificados?: number;

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
  atendimentosIA: 0,
  atendimentosHumano: 0,
  atendimentosClassificados: 0,
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
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const lastGoodDataRef = useRef<DashboardMetrics | null>(null);

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

  type FetchReason = 'initial' | 'poll' | 'manual';

  const fetchMetrics = useCallback(async (reason: FetchReason = 'manual') => {
    if (!isConfigured || !account) {
      setIsLoading(false);
      setData(DEFAULT_METRICS);
      return;
    }

    try {
      // Evita concorrência (principal causa de falhas intermitentes em polling)
      if (inFlightRef.current) {
        // Em ação manual, cancela a request anterior e faz a nova.
        if (reason === 'manual') {
          abortRef.current?.abort();
        } else {
          return;
        }
      }

      inFlightRef.current = true;
      setError(null);

      const isInitialLoad = lastGoodDataRef.current == null && data == null;
      if (reason === 'initial' || isInitialLoad) {
        setIsLoading(true);
      }
      if (reason !== 'initial') {
        setIsSyncing(true);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      console.log('[useChatwootMetrics] Fetching metrics...', {
        reason,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        inboxId,
        agentId,
      });

      const maxAttempts = reason === 'poll' ? 2 : 3;
      let lastErr: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Timeout por tentativa
        const TIMEOUT_MS = 45000; // mantém compatível com instâncias lentas
        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/fetch-chatwoot-metrics`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // JWT quando disponível; fallback mantém comportamento atual
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
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          if (result.success && result.data) {
            lastGoodDataRef.current = result.data as DashboardMetrics;
            setData(result.data);
            setError(null);
            setLastSyncAt(new Date().toISOString());
            return;
          }

          throw new Error(result.error || 'Erro ao carregar métricas');
        } catch (err: any) {
          lastErr = err;

          // Abort/timeout: não adianta retry imediato
          if (err?.name === 'AbortError') {
            throw err;
          }

          const msg = String(err?.message || '');
          const isNetworkFail = msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror');
          const is5xx = msg.includes('HTTP 5');
          const is429 = msg.includes('HTTP 429');
          const shouldRetry = attempt < maxAttempts && (isNetworkFail || is5xx || is429);

          if (!shouldRetry) {
            throw err;
          }

          // backoff com jitter
          const backoffMs = 800 * attempt + Math.floor(Math.random() * 400);
          console.warn('[useChatwootMetrics] Retry fetch metrics...', { attempt, maxAttempts, backoffMs, msg });
          await sleep(backoffMs);
        } finally {
          clearTimeout(timeoutId);
          // Só limpa se ainda for a controladora atual
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      }

      throw lastErr instanceof Error ? lastErr : new Error('Erro desconhecido ao carregar métricas');
    } catch (err: any) {
      console.error('[useChatwootMetrics] Error:', err);

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const rawMsg = String(err?.message || '');
      const rawMsgLower = rawMsg.toLowerCase();
      const message = err?.name === 'AbortError'
        ? 'Timeout ao buscar métricas. O Chatwoot pode estar lento.'
        : (!online
          ? 'Sem conexão com a internet.'
          : (rawMsgLower.includes('failed to fetch') || rawMsgLower.includes('networkerror')
            ? 'Falha de conexão ao buscar métricas. Tente novamente em alguns segundos.'
            : (rawMsg || 'Erro de conexão')));

      setError(message);

      // Mantém o último dado válido em tela (evita “zerar” o dashboard em falhas transitórias)
      if (lastGoodDataRef.current) {
        setData(lastGoodDataRef.current);
      } else {
        setData(DEFAULT_METRICS);
      }

      // Evita “spam” de toast em falhas do polling
      if (reason !== 'poll') {
        toast({
          title: 'Erro ao carregar métricas',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [account, dateFrom, dateTo, inboxId, agentId, isConfigured, toast]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics('initial');
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
          fetchMetrics('poll');
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
    fetchMetrics('manual');
    
    // Reset polling timer
    if (intervalRef.current && enablePolling && isConfigured) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchMetrics('poll');
        }
      }, pollingInterval);
    }
  }, [fetchMetrics, enablePolling, isConfigured, pollingInterval]);

  // Cleanup: abort request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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
