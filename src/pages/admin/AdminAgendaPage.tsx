import { useState } from 'react';
import { CalendarView } from '@/components/calendar';
import { useCalendar } from '@/contexts/CalendarContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Link2, User, Trash2, Pencil, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAgendaPage() {
  const { selectedEvent, selectEvent, deleteEvent, isConnected } = useCalendar();

  const handleCopyLink = () => {
    if (selectedEvent?.meetingLink) {
      navigator.clipboard.writeText(selectedEvent.meetingLink);
      toast.success('Link copiado!');
    }
  };

  const handleDelete = async () => {
    if (selectedEvent) {
      await deleteEvent(selectedEvent.id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">
            {isConnected ? 'Sincronizado com Google Calendar' : 'Gerencie seus agendamentos'}
          </p>
        </div>
      </div>

      <CalendarView />

      {/* Event Details Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && selectEvent(null)}>
        <SheetContent>
          {selectedEvent && (
            <>
              <SheetHeader>
                <div className="space-y-2">
                  <SheetTitle>{selectedEvent.title}</SheetTitle>
                  <Badge variant={selectedEvent.source === 'google' ? 'default' : 'secondary'}>
                    {selectedEvent.source === 'google' ? '🔵 Google Calendar' : '🟢 CRM'}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <span>{format(parseISO(selectedEvent.start), "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <span>
                      {format(parseISO(selectedEvent.start), 'HH:mm')} - {format(parseISO(selectedEvent.end), 'HH:mm')}
                    </span>
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.meetingLink && (
                    <div className="flex items-center gap-3">
                      <Link2 className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate text-muted-foreground">{selectedEvent.meetingLink}</p>
                        <div className="flex gap-2 mt-1">
                          <Button variant="outline" size="sm" onClick={handleCopyLink}>
                            <Copy className="w-3 h-3 mr-1" /> Copiar
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a href={selectedEvent.meetingLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedEvent.attendees.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Participantes</h4>
                    <div className="space-y-2">
                      {selectedEvent.attendees.map((attendee, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{attendee.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {attendee.status === 'confirmed' ? '✅ Confirmado' : '⏳ Pendente'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEvent.notes && (
                  <div>
                    <h4 className="font-medium mb-2">Observações</h4>
                    <p className="text-sm text-muted-foreground">{selectedEvent.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Pencil className="w-4 h-4 mr-1" /> Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
