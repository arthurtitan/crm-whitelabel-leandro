

# Fix: Kanban Page Blank (Crash on lead-tags response parsing)

## Root Cause

The backend endpoint `GET /api/lead-tags` returns a wrapped response: `{ data: [...] }`.

However, `AdminKanbanPage.tsx` line 136 treats the raw response as a flat `LeadTag[]` array:

```typescript
incoming = await apiClient.get<LeadTag[]>('/api/lead-tags', { params: { accountId } });
```

This means `incoming` is actually `{ data: [...] }` (an object), not an array. When React later calls `.find()` or passes it to `mergeById()` (which does `incoming.map()`), it crashes because objects don't have `.map()` or `.find()`.

Since there's no Error Boundary, the crash propagates and unmounts the entire page -- resulting in the blank screen seen in the screenshot.

## Fix (2 changes)

### 1. `src/pages/admin/AdminKanbanPage.tsx` -- Unwrap the response

At line 136, unwrap the `{ data }` envelope the same way other backend services do (e.g., `tagsBackendService.listStageTags`):

```typescript
// Before (broken):
incoming = await apiClient.get<LeadTag[]>('/api/lead-tags', { params: { accountId } });

// After (correct):
const response = await apiClient.get<any>('/api/lead-tags', { params: { accountId } });
incoming = Array.isArray(response) ? response : (response?.data || []);
```

### 2. Add defensive guard in the same file

Around line 147, add a safety check so `mergeById` never receives a non-array even in future edge cases:

```typescript
// Ensure incoming is always an array before merging
if (!Array.isArray(incoming)) {
  incoming = [];
}
```

## Why this happens only on VPS (not in development)

In development mode with mocks enabled, the Kanban uses `supabase.from('lead_tags').select('*')` which returns a flat array. In backend mode (VPS), it uses the Express API which wraps responses in `{ data: [...] }`.

## Expected Result

- Kanban page loads and displays the 19 synced contacts across their stage columns.
- No more blank page crash.
- Compatible with both mock/Supabase and backend modes.

