

# Fix: Syntax error in contact.service.ts (extra closing brace)

## Problem

The build fails with:
```
src/services/contact.service.ts(545,3): error TS1434: Unexpected keyword or identifier.
```

Line 540 has a duplicate `}` that closes the `ContactService` class prematurely. The `listLeadTags` method (line 545) ends up outside the class body.

## Root Cause

The `getByStage` method ends at line 539 with `}`, and line 540 has another `}` that was the original class-closing brace. When `listLeadTags` was appended, it went after this extra brace instead of inside the class.

## Fix

**File:** `backend/src/services/contact.service.ts`

Remove the extra `}` on line 540. The class should close at line 566 (after `listLeadTags`).

```
Line 539:   }        <-- end of getByStage
Line 540:   }        <-- REMOVE THIS (duplicate class close)
Line 541:
Line 542:   /**
```

Becomes:

```
Line 539:   }        <-- end of getByStage
Line 540:
Line 541:   /**
```

This is a one-line deletion. After this fix, the rebuild on EasyPanel will succeed.

