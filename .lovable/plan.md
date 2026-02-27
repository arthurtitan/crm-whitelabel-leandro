

# Fix: TypeScript Build Errors in Backend

## Problem

The Docker build fails because `logger.info()` receives a `number` as the second argument, but its signature requires `Record<string, unknown>`.

Two lines in `backend/src/services/chatwoot-metrics.service.ts` are affected:
- **Line 552**: `logger.info('...:', fallbackNovos)` -- `fallbackNovos` is a number
- **Line 640**: `logger.info('...:', fallbackIA)` -- `fallbackIA` is a number

## Fix

Wrap the number in an object so it matches the `Record<string, unknown>` type.

### File: `backend/src/services/chatwoot-metrics.service.ts`

**Line 552** -- Change:
```typescript
logger.info('[Metrics] Used allConversations fallback for novosLeads:', fallbackNovos);
```
To:
```typescript
logger.info('[Metrics] Used allConversations fallback for novosLeads', { fallbackNovos });
```

**Line 640** -- Change:
```typescript
logger.info('[Metrics] Used Chatwoot API PARTIAL fallback for IA resolutions:', fallbackIA);
```
To:
```typescript
logger.info('[Metrics] Used Chatwoot API PARTIAL fallback for IA resolutions', { fallbackIA });
```

## After applying

Rebuild on VPS: `docker compose build && docker compose up -d`

