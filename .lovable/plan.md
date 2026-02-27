

# Fix: Backend Build Failure Blocking All Production Fixes

## Root Cause

The backend has **never deployed any of the previous fixes** because the TypeScript compiler fails at build time with:

```
'chatwootBaseUrl' does not exist in type '{ id: string; nome: string; status: AccountStatus; timezone: string; }'
```

The middleware (`auth.middleware.ts`) assigns `chatwootBaseUrl`, `chatwootAccountId`, and `chatwootApiKey` to `req.account`, but the `AuthenticatedRequest` interface in `backend/src/types/index.ts` does not declare those fields.

## Fix (1 file, 3 lines)

**File:** `backend/src/types/index.ts` (lines 26-31)

Update the `account` property of `AuthenticatedRequest` to include the Chatwoot fields:

```typescript
account?: {
  id: string;
  nome: string;
  status: AccountStatus;
  timezone: string;
  chatwootBaseUrl: string | null;
  chatwootAccountId: string | null;
  chatwootApiKey: string | null;
};
```

## What This Unblocks

Once this type is fixed, the backend will compile and deploy successfully. All previously-implemented fixes will then become active in production:

1. `verifyPassword` returning 400/403 instead of 401 (no more forced logout)
2. `x-confirm-password` header being sent from the frontend on account deletion
3. Calendar controller guards for null `accountId` (no more Prisma crashes)
4. Chatwoot fields returned in `/api/auth/me` response

## After Deploy

Rebuild the backend on EasyPanel. The build should pass, and all 7 previous fixes will go live simultaneously.
