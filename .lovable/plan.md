

## Problema

O `syncWithGoogle` usa `prisma.calendarEvent.upsert()` com `where: { id: ... || 'new' }`. Quando o evento do Google ainda não existe no banco, `getEventIdByGoogleId` retorna `null`, e o código passa a string literal `'new'` como valor do campo `id` (que é `@db.Uuid`). O Postgres rejeita `'new'` porque não é um UUID válido.

## Correção

### `backend/src/services/calendar.service.ts` — método `syncWithGoogle` (linhas ~377-406)

Substituir o `upsert` por lógica condicional: se o evento já existe, faz `update`; senão, faz `create`:

```typescript
for (const gEvent of googleEvents) {
  if (gEvent.status === 'cancelled') continue;
  const startTime = gEvent.start?.dateTime || gEvent.start?.date;
  const endTime = gEvent.end?.dateTime || gEvent.end?.date;
  if (!startTime || !endTime) continue;

  const existingId = await this.getEventIdByGoogleId(gEvent.id, accountId);

  const eventData = {
    title: gEvent.summary || 'Sem título',
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    location: gEvent.location || null,
    meetingLink: gEvent.hangoutLink || null,
  };

  if (existingId) {
    await prisma.calendarEvent.update({
      where: { id: existingId },
      data: eventData,
    });
  } else {
    await prisma.calendarEvent.create({
      data: {
        ...eventData,
        accountId,
        createdById: userId,
        type: 'meeting',
        source: 'google',
        googleEventId: gEvent.id,
        googleCalendarId: 'primary',
      },
    });
  }
}
```

Impacto: arquivo único `backend/src/services/calendar.service.ts`. Requer rebuild do backend.

