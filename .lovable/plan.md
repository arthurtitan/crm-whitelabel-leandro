

# Fix: TypeScript errors in chatwoot-metrics.service.ts

## Problem

Build fails with two TS2345 errors at lines 459 and 520. The `catch` variables (`syncErr`, `dbErr`) are typed as `unknown` by TypeScript's strict mode, but `logger.warn()` expects `Record<string, unknown> | undefined` as the second argument.

## Fix

**File:** `backend/src/services/chatwoot-metrics.service.ts`

Cast the error variables in the two `logger.warn` calls:

- **Line 459**: Change `logger.warn('[Metrics] resolution_logs sync error (non-fatal):', syncErr)` to `logger.warn('[Metrics] resolution_logs sync error (non-fatal):', syncErr as any)`
- **Line 520**: Change `logger.warn('[Metrics] resolution_logs query error (non-fatal):', dbErr)` to `logger.warn('[Metrics] resolution_logs query error (non-fatal):', dbErr as any)`

This is a two-line change. After applying, rebuild on EasyPanel.

