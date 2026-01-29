import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  GoogleConnection,
  CalendarEvent,
  CalendarSettings,
  CreateEventDTO,
  CalendarViewMode,
} from '@/types/calendar';
import {
  mockCalendarSettings,
} from '@/data/mockCalendarData';
import { toast } from 'sonner';

// ============= CONTEXT TYPE =============

interface CalendarContextType {
  // Connection state
  connection: GoogleConnection;
  isConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean; // true after initial load completes
  
  // Events
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  
  // View state
  currentDate: Date;
  viewMode: CalendarViewMode;
  
  // Actions - Connection
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  syncNow: () => Promise<void>;
  checkConnectionStatus: () => Promise<void>;
  
  // Actions - Settings
  updateSettings: (settings: Partial<CalendarSettings>) => Promise<void>;
  selectCalendar: (calendarId: string, selected: boolean) => void;
  
  // Actions - Events
  createEvent: (data: CreateEventDTO) => Promise<CalendarEvent>;
  updateEvent: (id: string, data: Partial<CreateEventDTO>) => Promise<CalendarEvent>;
  deleteEvent: (id: string) => Promise<void>;
  selectEvent: (event: CalendarEvent | null) => void;
  loadEvents: () => Promise<void>;
  
  // Actions - Navigation
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  
  // Availability (public)
  getAvailability: (month: string) => Record<string, string[]>;
  createBooking: (data: any) => Promise<{ success: boolean; eventId: string }>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

// ============= PROVIDER =============

interface CalendarProviderProps {
  children: ReactNode;
  accountId: string;
  userId: string;
}

const defaultConnection: GoogleConnection = {
  status: 'disconnected',
  email: null,
  connectedAt: null,
  calendars: [],
  settings: null,
  lastSync: null,
};

export function CalendarProvider({ children, accountId, userId }: CalendarProviderProps) {
  // State
  const [connection, setConnection] = useState<GoogleConnection>(defaultConnection);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const isConnected = connection.status === 'connected';

  // ============= LOAD EVENTS FROM DATABASE =============
  // Load CRM events from account + Google events from current user

  const loadEvents = useCallback(async () => {
    console.log('[Calendar] loadEvents called with accountId:', accountId, 'userId:', userId);
    
    try {
      // Load CRM events for the whole account
      const { data: crmEvents, error: crmError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('account_id', accountId)
        .eq('source', 'crm')
        .order('start_time', { ascending: true });

      if (crmError) {
        console.error('[Calendar] Error loading CRM events:', crmError);
      }
      console.log('[Calendar] CRM events loaded:', crmEvents?.length || 0);

      // Load Google events only for the current user
      const { data: googleEvents, error: googleError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('created_by', userId)
        .eq('source', 'google')
        .order('start_time', { ascending: true });

      if (googleError) {
        console.error('[Calendar] Error loading Google events:', googleError);
      }
      console.log('[Calendar] Google events loaded:', googleEvents?.length || 0);

      // Combine both event types
      const allEvents = [...(crmEvents || []), ...(googleEvents || [])];
      console.log('[Calendar] Total events:', allEvents.length);

      const mappedEvents: CalendarEvent[] = allEvents.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start_time,
        end: event.end_time,
        type: (event.type as CalendarEvent['type']) || 'appointment',
        source: (event.source as 'google' | 'crm') || 'crm',
        status: (event.status as CalendarEvent['status']) || 'scheduled',
        location: event.location || undefined,
        meetingLink: event.meeting_link || undefined,
        googleEventId: event.google_event_id || undefined,
        googleCalendarId: event.google_calendar_id || undefined,
        attendees: [],
        notes: event.notes || undefined,
        createdBy: event.created_by || undefined,
        createdAt: event.created_at || undefined,
        contactId: event.contact_id || undefined,
      }));

      // Sort by start time
      mappedEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      setEvents(mappedEvents);
    } catch (error) {
      console.error('[Calendar] Failed to load events:', error);
    }
  }, [accountId, userId]);

  // ============= CHECK CONNECTION STATUS =============

  const checkConnectionStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const response = await supabase.functions.invoke('google-calendar-status', {});
      
      if (response.error) {
        console.error('Status check error:', response.error);
        setConnection(defaultConnection);
      } else if (response.data) {
        const { connected, email, needsReauth } = response.data;
        
        if (needsReauth) {
          setConnection({
            ...defaultConnection,
            status: 'error',
            email,
          });
        } else if (connected) {
          setConnection({
            status: 'connected',
            email,
            connectedAt: new Date().toISOString(),
            calendars: [],
            settings: mockCalendarSettings,
            lastSync: new Date().toISOString(),
          });
        } else {
          setConnection(defaultConnection);
        }
      }
    } catch (error) {
      console.error('Connection status check failed:', error);
      setConnection(defaultConnection);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============= INITIAL LOAD + AUTO-SYNC POLLING =============
  // Syncs every 30 seconds when connected (same pattern as Kanban)

  useEffect(() => {
    if (!accountId) return;

    const init = async () => {
      console.log('[Calendar] Initializing context...');
      await checkConnectionStatus();
      await loadEvents();
      setIsInitialized(true);
      console.log('[Calendar] Context initialized');
    };
    init();

    // Set up 30-second polling for auto-sync when connected
    const SYNC_INTERVAL = 30000; // 30 seconds
    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (intervalId) return;
      
      intervalId = setInterval(async () => {
        console.log('[Calendar] Auto-sync polling...');
        
        // Check if still connected before syncing
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[Calendar] No session, skipping auto-sync');
          return;
        }

        try {
          // Silent sync - don't show toast for auto-sync
          const response = await supabase.functions.invoke('google-calendar-sync', {});
          
          if (!response.error) {
            console.log('[Calendar] Auto-sync complete, reloading events...');
            await loadEvents();
          }
        } catch (error) {
          console.warn('[Calendar] Auto-sync failed:', error);
        }
      }, SYNC_INTERVAL);
      
      console.log('[Calendar] Polling started (30s interval)');
    };

    // Start polling after initial load
    const pollingTimeout = setTimeout(startPolling, 2000);

    return () => {
      clearTimeout(pollingTimeout);
      if (intervalId) {
        clearInterval(intervalId);
        console.log('[Calendar] Polling stopped');
      }
    };
  }, [accountId, checkConnectionStatus, loadEvents]);

  // ============= CONNECTION ACTIONS =============

  const connectGoogle = useCallback(async () => {
    setConnection(prev => ({ ...prev, status: 'connecting' }));

    try {
      const response = await supabase.functions.invoke('google-calendar-auth-url', {});
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao iniciar conexão');
      }

      if (response.data?.authUrl) {
        // Detect if we're inside an iframe (Preview environment)
        const isInIframe = window.self !== window.top;
        
        if (isInIframe) {
          // In Preview/iframe: open new tab to bypass security restrictions
          window.open(response.data.authUrl, '_blank');
        } else {
          // In Published site: navigate in same tab for better UX
          window.location.href = response.data.authUrl;
        }
      } else {
        throw new Error('URL de autorização não recebida');
      }
    } catch (error: any) {
      console.error('Connect error:', error);
      setConnection(defaultConnection);
      toast.error(error.message || 'Erro ao conectar com Google Calendar');
    }
  }, []);

  const disconnectGoogle = useCallback(async () => {
    try {
      const response = await supabase.functions.invoke('google-calendar-disconnect', {});
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao desconectar');
      }

      // Clear connection state
      setConnection(defaultConnection);
      
      // Remove Google events from local state immediately
      setEvents(prev => prev.filter(event => event.source !== 'google'));
      
      // Reload events from database to ensure UI reflects backend state
      await loadEvents();
      
      toast.success('Google Calendar desconectado');
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error(error.message || 'Erro ao desconectar');
    }
  }, [loadEvents]);

  const syncNow = useCallback(async () => {
    console.log('[Calendar] syncNow called');
    
    // Don't rely on isConnected state (closure bug) - check session and let backend validate
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Calendar] syncNow: No session, aborting');
      return;
    }
    
    console.log('[Calendar] syncNow: Session found, proceeding...');
    setConnection(prev => ({ ...prev, status: 'syncing' }));

    try {
      console.log('[Calendar] Invoking google-calendar-sync...');
      const response = await supabase.functions.invoke('google-calendar-sync', {});
      
      if (response.error) {
        console.error('[Calendar] Sync error response:', response.error);
        // If backend says not connected, update local state accordingly
        if (response.error.message?.includes('não conectado')) {
          setConnection(defaultConnection);
          toast.info('Google Calendar não está conectado');
          return;
        }
        throw new Error(response.error.message || 'Erro ao sincronizar');
      }

      console.log('[Calendar] Sync successful, reloading events...');
      // Reload events from database
      await loadEvents();

      setConnection(prev => ({
        ...prev,
        status: 'connected',
        lastSync: new Date().toISOString(),
      }));

      const { synced, created, updated } = response.data || {};
      console.log(`[Calendar] Sync complete: ${created || 0} created, ${updated || 0} updated`);
      toast.success(`Sincronizado! ${created || 0} novos, ${updated || 0} atualizados`);
    } catch (error: any) {
      console.error('[Calendar] Sync error:', error);
      setConnection(prev => ({ ...prev, status: 'connected' }));
      toast.error(error.message || 'Erro ao sincronizar');
    }
  }, [loadEvents]);

  // ============= SETTINGS ACTIONS =============

  const updateSettings = useCallback(async (newSettings: Partial<CalendarSettings>) => {
    setConnection(prev => ({
      ...prev,
      settings: prev.settings ? { ...prev.settings, ...newSettings } : mockCalendarSettings,
    }));
    
    toast.success('Configurações salvas!');
  }, []);

  const selectCalendar = useCallback((calendarId: string, selected: boolean) => {
    setConnection(prev => ({
      ...prev,
      calendars: prev.calendars.map(cal =>
        cal.id === calendarId ? { ...cal, selected } : cal
      ),
    }));
  }, []);

  // ============= EVENT ACTIONS =============

  const createEvent = useCallback(async (data: CreateEventDTO): Promise<CalendarEvent> => {
    const { data: newEvent, error } = await supabase
      .from('calendar_events')
      .insert({
        account_id: accountId,
        title: data.title,
        start_time: data.start,
        end_time: data.end,
        type: data.type,
        location: data.location,
        notes: data.notes,
        contact_id: data.contactId,
        source: 'crm',
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      console.error('Create event error:', error);
      toast.error('Erro ao criar evento');
      throw error;
    }

    const mappedEvent: CalendarEvent = {
      id: newEvent.id,
      title: newEvent.title,
      start: newEvent.start_time,
      end: newEvent.end_time,
      type: (newEvent.type as CalendarEvent['type']) || 'appointment',
      source: 'crm',
      status: 'scheduled',
      location: newEvent.location || undefined,
      attendees: [],
      notes: newEvent.notes || undefined,
      createdBy: newEvent.created_by || 'system',
      createdAt: newEvent.created_at || new Date().toISOString(),
    };

    setEvents(prev => [...prev, mappedEvent]);
    toast.success('Evento criado com sucesso!');
    
    return mappedEvent;
  }, [accountId]);

  const updateEvent = useCallback(async (id: string, data: Partial<CreateEventDTO>): Promise<CalendarEvent> => {
    const { data: updatedEvent, error } = await supabase
      .from('calendar_events')
      .update({
        title: data.title,
        start_time: data.start,
        end_time: data.end,
        location: data.location,
        notes: data.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update event error:', error);
      toast.error('Erro ao atualizar evento');
      throw error;
    }

    const mappedEvent: CalendarEvent = {
      id: updatedEvent.id,
      title: updatedEvent.title,
      start: updatedEvent.start_time,
      end: updatedEvent.end_time,
      type: (updatedEvent.type as CalendarEvent['type']) || 'appointment',
      source: (updatedEvent.source as 'google' | 'crm') || 'crm',
      status: (updatedEvent.status as CalendarEvent['status']) || 'scheduled',
      location: updatedEvent.location || undefined,
      attendees: [],
      notes: updatedEvent.notes || undefined,
      createdBy: updatedEvent.created_by || 'system',
      createdAt: updatedEvent.created_at || new Date().toISOString(),
    };

    setEvents(prev => prev.map(event => event.id === id ? mappedEvent : event));
    toast.success('Evento atualizado!');
    
    return mappedEvent;
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete event error:', error);
      toast.error('Erro ao excluir evento');
      throw error;
    }

    setEvents(prev => prev.filter(event => event.id !== id));
    setSelectedEvent(null);
    toast.success('Evento excluído!');
  }, []);

  const selectEvent = useCallback((event: CalendarEvent | null) => {
    setSelectedEvent(event);
  }, []);

  // ============= NAVIGATION ACTIONS =============

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() - 1);
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setMonth(newDate.getMonth() - 1);
      }
      return newDate;
    });
  }, [viewMode]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() + 1);
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  }, [viewMode]);

  // ============= PUBLIC AVAILABILITY =============

  const getAvailability = useCallback((month: string) => {
    // TODO: Implement real availability based on events
    return {};
  }, []);

  const createBooking = useCallback(async (data: any) => {
    console.log('Creating booking:', data);
    return {
      success: true,
      eventId: `booking-${Date.now()}`,
    };
  }, []);

  // ============= CONTEXT VALUE =============

  const value = useMemo(() => ({
    connection,
    isConnected,
    isLoading,
    isInitialized,
    events,
    selectedEvent,
    currentDate,
    viewMode,
    connectGoogle,
    disconnectGoogle,
    syncNow,
    checkConnectionStatus,
    updateSettings,
    selectCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    loadEvents,
    setCurrentDate,
    setViewMode,
    goToToday,
    goToPrevious,
    goToNext,
    getAvailability,
    createBooking,
  }), [
    connection,
    isConnected,
    isLoading,
    isInitialized,
    events,
    selectedEvent,
    currentDate,
    viewMode,
    connectGoogle,
    disconnectGoogle,
    syncNow,
    checkConnectionStatus,
    updateSettings,
    selectCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    loadEvents,
    goToToday,
    goToPrevious,
    goToNext,
    getAvailability,
    createBooking,
  ]);

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

// ============= HOOK =============

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
