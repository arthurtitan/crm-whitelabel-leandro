

## Fix: TypeScript Build Error in `fetchContactDetails`

### Problem

The Docker build fails because `response.json()` returns `unknown` and TypeScript cannot assign it to `{ id: number; created_at: string } | null`.

```
src/services/chatwoot-metrics.service.ts(177,5): error TS2322: Type 'unknown' is not assignable to type '{ id: number; created_at: string; } | null'.
```

### Fix

**File**: `backend/src/services/chatwoot-metrics.service.ts`, line 177

Change:
```typescript
return await response.json();
```
To:
```typescript
return await response.json() as { id: number; created_at: string };
```

This is a one-line type assertion fix. No logic changes.

