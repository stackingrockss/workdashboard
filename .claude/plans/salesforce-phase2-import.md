# Salesforce Phase 2: Import from Salesforce

## Overview

Implement the ability to import Opportunities, Accounts, and Contacts from Salesforce into the app. This will follow the same pattern as the Gong sync integration, using Inngest for background processing.

## Architecture Decisions

### Sync Strategy
- **Import Order**: Accounts → Contacts → Opportunities (respects foreign key relationships)
- **Duplicate Detection**: Use `salesforceId` field to identify existing records
- **Update Strategy**: Update existing records if Salesforce `LastModifiedDate` is newer
- **Owner Mapping**: Map Salesforce `OwnerId` to app users via email matching

### Field Mapping

**Opportunities:**
| Salesforce | App | Notes |
|------------|-----|-------|
| `Id` | `salesforceId` | Unique identifier |
| `Name` | `name` | Required |
| `Amount` | `amountArr` | Convert to cents (×100) |
| `CloseDate` | `closeDate` | Date conversion |
| `StageName` | `stage` | Map via `STAGE_MAPPING` |
| `Probability` | `confidenceLevel` | 0-100 → 1-5 scale |
| `NextStep` | `nextStep` | Direct mapping |
| `Description` | `notes` | Direct mapping |
| `AccountId` | `accountId` | Lookup local account by SF ID |
| `OwnerId` | `ownerId` | Map via user email |
| `ForecastCategoryName` | `forecastCategory` | Map to enum |
| `LastModifiedDate` | `salesforceLastModified` | For conflict detection |

**Accounts:**
| Salesforce | App | Notes |
|------------|-----|-------|
| `Id` | `salesforceId` | Unique identifier |
| `Name` | `name` | Required |
| `Website` | `website` | Direct mapping |
| `Industry` | `industry` | Direct mapping |
| `OwnerId` | `ownerId` | Map via user email |

**Contacts:**
| Salesforce | App | Notes |
|------------|-----|-------|
| `Id` | `salesforceId` | Unique identifier |
| `FirstName` | `firstName` | Direct mapping |
| `LastName` | `lastName` | Required |
| `Title` | `title` | Direct mapping |
| `Email` | `email` | Direct mapping |
| `Phone` | `phone` | Direct mapping |
| `AccountId` | `accountId` | Lookup local account by SF ID |

---

## Implementation Plan

### Step 1: Create Mapper Utilities
**File:** `src/lib/integrations/salesforce/mappers/`

Create dedicated mapper files for each entity:

1. **`opportunity-mapper.ts`**
   - `mapSalesforceToOpportunity()` - Convert SF opportunity to app format
   - `mapOpportunityToSalesforce()` - Convert app opportunity to SF format (for export)
   - Stage mapping using existing `STAGE_MAPPING` constant
   - Probability/confidence conversion using existing helpers

2. **`account-mapper.ts`**
   - `mapSalesforceToAccount()` - Convert SF account to app format
   - `mapAccountToSalesforce()` - Convert app account to SF format

3. **`contact-mapper.ts`**
   - `mapSalesforceToContact()` - Convert SF contact to app format
   - Default `role` to 'user' (no equivalent in SF)
   - Default `sentiment` to 'unknown'

4. **`user-mapper.ts`**
   - `buildUserEmailMap()` - Cache SF User ID → App User ID mapping
   - Query SF users and match by email to app users

### Step 2: Create Import Logic
**File:** `src/lib/integrations/salesforce/sync.ts`

Functions:
- `importAccountsFromSalesforce(client, organizationId, options)`
- `importContactsFromSalesforce(client, organizationId, accountIdMap)`
- `importOpportunitiesFromSalesforce(client, organizationId, accountIdMap, userIdMap)`
- `performFullImport(organizationId)` - Orchestrates full import

Each import function:
1. Query Salesforce with optional `modifiedSince` filter
2. Build ID maps for foreign key lookups
3. Upsert records using `salesforceId` as unique key
4. Track sync status and statistics

### Step 3: Create Inngest Background Job
**File:** `src/lib/inngest/functions/sync-salesforce.ts`

Two functions:
1. **`syncSalesforceCron`** - Scheduled job (hourly) for all enabled integrations
2. **`syncSalesforceForOrg`** - Per-organization sync triggered by cron or manual

Events:
- `salesforce/sync.manual` - Triggered by user
- `salesforce/sync.scheduled` - Triggered by cron

Steps:
1. Fetch and validate integration
2. Build user email map (SF users → app users)
3. Import accounts
4. Import contacts
5. Import opportunities
6. Update sync status

### Step 4: Create Sync API Endpoint
**File:** `src/app/api/v1/integrations/salesforce/sync/route.ts`

- `POST` - Trigger manual sync (admin only)
- `GET` - Get sync status and statistics

Request body options:
```json
{
  "fullSync": false,  // If true, reimport all data
  "entities": ["accounts", "contacts", "opportunities"]  // Optional filter
}
```

### Step 5: Update UI Components
**File:** `src/components/features/settings/salesforce-integration-card.tsx`

Add:
- "Import Now" button (triggers sync)
- Sync status display (last sync time, records imported)
- Import progress indicator
- Entity counts (accounts, contacts, opportunities imported)

---

## File Structure

```
src/lib/integrations/salesforce/
├── client.ts          (existing)
├── types.ts           (existing)
├── index.ts           (existing)
├── sync.ts            (NEW - import/export logic)
└── mappers/
    ├── index.ts       (NEW - re-exports)
    ├── opportunity.ts (NEW)
    ├── account.ts     (NEW)
    ├── contact.ts     (NEW)
    └── user.ts        (NEW)

src/lib/inngest/functions/
└── sync-salesforce.ts (NEW)

src/app/api/v1/integrations/salesforce/
├── auth/route.ts      (existing)
├── callback/route.ts  (existing)
├── disconnect/route.ts (existing)
├── status/route.ts    (existing)
├── settings/route.ts  (existing)
└── sync/route.ts      (NEW)
```

---

## Error Handling

1. **Token Expiration**: jsforce handles auto-refresh
2. **API Rate Limits**: Batch queries, implement backoff
3. **Missing Owners**: Fall back to first org admin
4. **Invalid Stages**: Map unknown stages to `discovery`
5. **Duplicate Detection**: Skip if `salesforceId` already exists with same `LastModifiedDate`

---

## Testing Checklist

- [ ] Import accounts from SF creates new Account records
- [ ] Import accounts updates existing records (matched by `salesforceId`)
- [ ] Import contacts links to correct accounts
- [ ] Import opportunities maps stages correctly
- [ ] Import opportunities converts Amount to cents
- [ ] Owner mapping works via email
- [ ] Sync status updates correctly
- [ ] Manual sync triggers work
- [ ] Scheduled sync runs hourly
- [ ] UI shows sync progress and results

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Mapper utilities | 1-2 hours |
| Import logic | 2-3 hours |
| Inngest background job | 1-2 hours |
| Sync API endpoint | 1 hour |
| UI updates | 1-2 hours |
| Testing | 1-2 hours |
| **Total** | **7-12 hours** |
