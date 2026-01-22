import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
  GoogleConnection,
  CalendarEvent,
  CalendarSettings,
  CreateEventDTO,
  CalendarViewMode,
  ConnectionStatus,
} from '@/types/calendar';
import {
  mockConnectedState,
  mockDisconnectedState,
  mockCalendarEvents,
  mockCalendarSettings,
  generateMockAvailability,
} from '@/data/mockCalendarData';
import { toast } from 'sonner';

// ============= CONTEXT TYPE =============

interface CalendarContextType {
  // Connection state
  connection: GoogleConnection;
  isConnected: boolean;
  
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
  
  // Actions - Settings
  updateSettings: (settings: Partial<CalendarSettings>) => Promise<void>;
  selectCalendar: (calendarId: string, selected: boolean) => void;
  
  // Actions - Events
  createEvent: (data: CreateEventDTO) => Promise<CalendarEvent>;
  updateEvent: (id: string, data: Partial<CreateEventDTO>) => Promise<CalendarEvent>;
  deleteEvent: (id: string) => Promise<void>;
  selectEvent: (event: CalendarEvent | null) => void;
  
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
}

export function CalendarProvider({ children, accountId }: CalendarProviderProps) {
  // State
  const [connection, setConnection] = useState<GoogleConnection>(mockDisconnectedState);
  const [events, setEvents] = useState<CalendarEvent[]>(mockCalendarEvents);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  const isConnected = connection.status === 'connected';

  // ============= CONNECTION ACTIONS =============

  const connectGoogle = useCallback(async () => {
    // TODO: GET /api/integrations/google/auth-url
    // Redirect to Google OAuth
    
    // Mock: Simulate connection process
    setConnection(prev => ({ ...prev, status: 'connecting' }));
    
    // Simulate OAuth delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock: Set as connected
    setConnection({
      ...mockConnectedState,
      lastSync: new Date().toISOString(),
    });
    
    toast.success('Google Calendar conectado com sucesso!');
  }, []);

  const disconnectGoogle = useCallback(async () => {
    // TODO: DELETE /api/integrations/google
    
    // Mock: Disconnect
    setConnection(mockDisconnectedState);
    toast.success('Google Calendar desconectado');
  }, []);

  const syncNow = useCallback(async () => {
    // TODO: POST /api/integrations/google/sync
    
    if (!isConnected) return;
    
    setConnection(prev => ({ ...prev, status: 'syncing' }));
    
    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setConnection(prev => ({
      ...prev,
      status: 'connected',
      lastSync: new Date().toISOString(),
    }));
    
    toast.success('Calendário sincronizado!');
  }, [isConnected]);

  // ============= SETTINGS ACTIONS =============

  const updateSettings = useCallback(async (newSettings: Partial<CalendarSettings>) => {
    // TODO: PUT /api/integrations/google/settings
    
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
    // TODO: POST /api/calendar/events
    
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: data.title,
      start: data.start,
      end: data.end,
      type: data.type,
      source: 'crm',
      status: 'scheduled',
      location: data.location,
      meetingLink: data.createGoogleMeet ? `https://meet.google.com/${Math.random().toString(36).slice(2, 11)}` : undefined,
      attendees: data.attendeeEmails?.map(email => ({
        name: email.split('@')[0],
        email,
        status: 'pending' as const,
      })) || [],
      notes: data.notes,
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
    };
    
    setEvents(prev => [...prev, newEvent]);
    toast.success('Evento criado com sucesso!');
    
    return newEvent;
  }, []);

  const updateEvent = useCallback(async (id: string, data: Partial<CreateEventDTO>): Promise<CalendarEvent> => {
    // TODO: PUT /api/calendar/events/:id
    
    let updatedEvent: CalendarEvent | undefined;
    
    setEvents(prev => prev.map(event => {
      if (event.id === id) {
        updatedEvent = {
          ...event,
          title: data.title ?? event.title,
          start: data.start ?? event.start,
          end: data.end ?? event.end,
          location: data.location ?? event.location,
          notes: data.notes ?? event.notes,
        };
        return updatedEvent;
      }
      return event;
    }));
    
    toast.success('Evento atualizado!');
    return updatedEvent!;
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    // TODO: DELETE /api/calendar/events/:id
    
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
    // TODO: GET /api/public/availability/:accountSlug?month=...
    return generateMockAvailability(month);
  }, []);

  const createBooking = useCallback(async (data: any) => {
    // TODO: POST /api/public/bookings
    console.log('Creating booking:', data);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      eventId: `booking-${Date.now()}`,
    };
  }, []);

  // ============= CONTEXT VALUE =============

  const value = useMemo(() => ({
    connection,
    isConnected,
    events,
    selectedEvent,
    currentDate,
    viewMode,
    connectGoogle,
    disconnectGoogle,
    syncNow,
    updateSettings,
    selectCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
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
    events,
    selectedEvent,
    currentDate,
    viewMode,
    connectGoogle,
    disconnectGoogle,
    syncNow,
    updateSettings,
    selectCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
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
