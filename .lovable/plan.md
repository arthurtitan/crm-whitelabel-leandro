

# Fix: Automatic JWT Token Refresh

## Problem

The JWT access token expires after 1 hour (`JWT_EXPIRES_IN=1h`). The dashboard polls Chatwoot metrics every 30 seconds. When the token expires mid-session, the API returns 401 "Token expirado", triggering a global logout via `auth:unauthorized`. The user sees the error banner and loses their session.

The backend already has a fully functional `/api/auth/refresh` endpoint that accepts the refresh token (stored in localStorage) and returns a new access token. However, the frontend `apiClient` never calls it.

## Solution

Add transparent token refresh to `src/api/client.ts`:

1. When a request gets a 401 with code `TOKEN_EXPIRED`, instead of immediately logging out:
   - Attempt to call `/api/auth/refresh` with the stored refresh token
   - If successful, save the new access token and retry the original request
   - If refresh also fails, then proceed with logout

2. Use a mutex/flag to prevent multiple concurrent refresh attempts (the 30s polling could trigger several 401s simultaneously).

## Implementation Details

**File: `src/api/client.ts`**

Add a refresh mechanism:

```typescript
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) return false;
  
  try {
    const response = await fetch(buildUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) return false;
    
    const result = await response.json();
    const data = result?.data ?? result;
    if (data?.token) {
      tokenManager.setToken(data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
```

Modify `handleResponse` to intercept `TOKEN_EXPIRED` and retry:

- On 401 with `TOKEN_EXPIRED` code, call `tryRefreshToken()` (deduplicated via the mutex)
- If refresh succeeds, retry the original fetch with the new token
- If refresh fails, proceed with current logout behavior

The retry needs access to the original request parameters, so the refresh+retry logic will be integrated into the `request()` function rather than `handleResponse()`.

## Architecture

```text
Request fails with 401 TOKEN_EXPIRED
        |
        v
  Is refresh in progress?
   /            \
  YES            NO
   |              |
   v              v
 Wait for      Start refresh
 existing      POST /api/auth/refresh
 promise         |
   |         Success?
   |        /       \
   v      YES        NO
 Retry    Save      Clear tokens
 with     new       Dispatch logout
 new      token
 token      |
            v
          Retry original request
```

## Result

- Users stay logged in as long as the refresh token is valid (7 days)
- Dashboard polling continues seamlessly across token renewals
- No more "Token expirado" errors during normal usage
- Multiple simultaneous 401s are deduplicated into a single refresh call
