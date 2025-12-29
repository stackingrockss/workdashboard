# Salesforce Integration Plan

> Comprehensive guide for bi-directional sync between your Sales Opportunity Tracker and Salesforce CRM

**Created:** 2025-12-28
**Status:** Planning

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Salesforce Connected App Setup](#salesforce-connected-app-setup)
4. [Field Mapping](#field-mapping)
5. [Database Schema Changes](#database-schema-changes)
6. [API Endpoints](#api-endpoints)
7. [Sync Architecture](#sync-architecture)
8. [Implementation Phases](#implementation-phases)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)

---

## 🎯 Overview

### Goals

1. **Import opportunities from Salesforce** → Create/update opportunities in your app
2. **Export opportunities to Salesforce** → Push changes back to Salesforce
3. **Sync Accounts** → Map Salesforce Accounts to your Account model
4. **Sync Contacts** → Map Salesforce Contacts to your Contact model
5. **Bi-directional sync** → Keep both systems in sync with conflict resolution

### Sync Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **One-time Import** | Manual import from Salesforce | Initial migration |
| **Scheduled Sync** | Periodic sync (every 15-60 min) | Ongoing sync |
| **Real-time Webhooks** | Salesforce pushes changes via Outbound Messages | Near real-time (requires Salesforce setup) |
| **On-demand Sync** | User triggers sync manually | Quick updates |

### Recommended Approach

Start with **One-time Import + Scheduled Sync**, then add webhooks for real-time updates later.

---

## 🔧 Prerequisites

### 1. Salesforce Developer Account

You mentioned you have this set up. Confirm you have:
- [ ] Developer Edition org (free) or Sandbox
- [ ] Admin access to create Connected Apps
- [ ] API access enabled

### 2. Required npm Packages

```bash
npm install jsforce           # Salesforce API client
npm install crypto-js         # For encrypting credentials (optional, use existing pattern)
```

### 3. Environment Variables

Add to `.env.local`:

```env
# Salesforce OAuth (Connected App)
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:3000/api/v1/integrations/salesforce/callback

# For production
# SALESFORCE_REDIRECT_URI=https://yourapp.com/api/v1/integrations/salesforce/callback

# Optional: For username/password auth (dev only)
SALESFORCE_LOGIN_URL=https://login.salesforce.com
# For sandbox: https://test.salesforce.com
```

---

## 🔐 Salesforce Connected App Setup

### Step 1: Create Connected App in Salesforce

1. Log into your Salesforce Developer org
2. Go to **Setup** → Search "App Manager" → **New Connected App**
3. Fill in:
   - **Connected App Name:** `Your App Name - Opportunity Tracker`
   - **API Name:** `Your_App_Opportunity_Tracker`
   - **Contact Email:** your email
4. Enable OAuth Settings:
   - **Enable OAuth Settings:** ✅ Check
   - **Callback URL:** `http://localhost:3000/api/v1/integrations/salesforce/callback`
   - **Selected OAuth Scopes:**
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
     - `Access your basic information (id, profile, email, address, phone)`
     - `Full access (full)` (for development, restrict in production)
5. Save and wait 2-10 minutes for propagation
6. Copy **Consumer Key** and **Consumer Secret**

### Step 2: Configure Security

1. Go to **Setup** → **Connected Apps** → Find your app → **Manage**
2. Set **Permitted Users** to "All users may self-authorize" (for dev)
3. Set **IP Relaxation** to "Relax IP restrictions" (for dev)

### Step 3: Get Your Instance URL

After OAuth, you'll receive an instance URL like:
- `https://yourorg.my.salesforce.com` (Lightning)
- `https://na1.salesforce.com` (Classic)

---

## 🗺️ Field Mapping

### Opportunity Field Mapping

| Your App Field | Salesforce Standard Field | Notes |
|----------------|---------------------------|-------|
| `id` | - | Internal only, store `salesforceId` |
| `name` | `Name` | Required in both |
| `amountArr` | `Amount` | SF stores as decimal, convert to cents |
| `closeDate` | `CloseDate` | Required in SF |
| `stage` | `StageName` | Map to SF picklist values |
| `confidenceLevel` | `Probability` | SF uses 0-100%, you use 1-5 |
| `forecastCategory` | `ForecastCategoryName` | Map to SF values |
| `nextStep` | `NextStep` | Standard SF field |
| `notes` | `Description` | Map to Description |
| `accountId` | `AccountId` | Link via Account sync |
| `ownerId` | `OwnerId` | Map via User email |

### Stage Mapping

| Your App Stage | Salesforce StageName (Default) |
|----------------|--------------------------------|
| `discovery` | `Prospecting` or `Qualification` |
| `demo` | `Needs Analysis` or `Value Proposition` |
| `validateSolution` | `Proposal/Price Quote` |
| `decisionMakerApproval` | `Negotiation/Review` |
| `contracting` | `Negotiation/Review` |
| `closedWon` | `Closed Won` |
| `closedLost` | `Closed Lost` |

**Note:** You may need to customize SF stages to match yours exactly.

### Confidence Level → Probability Mapping

| Your App (1-5) | Salesforce (0-100%) |
|----------------|---------------------|
| 1 | 10% |
| 2 | 25% |
| 3 | 50% |
| 4 | 75% |
| 5 | 90% |

### Account Field Mapping

| Your App Field | Salesforce Standard Field |
|----------------|---------------------------|
| `id` | - (store `salesforceAccountId`) |
| `name` | `Name` |
| `website` | `Website` |
| `industry` | `Industry` |
| `priority` | Custom field or mapping |
| `health` | Custom field or mapping |

### Contact Field Mapping

| Your App Field | Salesforce Standard Field |
|----------------|---------------------------|
| `id` | - (store `salesforceContactId`) |
| `firstName` | `FirstName` |
| `lastName` | `LastName` |
| `title` | `Title` |
| `email` | `Email` |
| `phone` | `Phone` |
| `role` | Custom field (create in SF) |
| `sentiment` | Custom field (create in SF) |
| `accountId` | `AccountId` |

---

## 🗄️ Database Schema Changes

Add these fields to track Salesforce sync state:

### New Model: SalesforceIntegration

```prisma
model SalesforceIntegration {
  id                   String       @id @default(cuid())
  organizationId       String       @unique

  // OAuth tokens (encrypted)
  accessToken          String
  refreshToken         String
  instanceUrl          String       // e.g., https://yourorg.my.salesforce.com

  // Sync state
  lastSyncAt           DateTime?
  lastSyncStatus       String?      // 'success' | 'failed' | 'in_progress'
  lastSyncError        String?
  syncCursor           String?      // For incremental sync (LastModifiedDate)

  // Configuration
  isEnabled            Boolean      @default(true)
  syncIntervalMinutes  Int          @default(60)
  syncDirection        String       @default("bidirectional") // 'import_only' | 'export_only' | 'bidirectional'

  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  organization         Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@schema("opportunity_tracker")
}
```

### Updates to Existing Models

**Opportunity:**
```prisma
model Opportunity {
  // ... existing fields ...

  // Salesforce sync fields
  salesforceId              String?      @unique  // Salesforce Opportunity ID (18-char)
  salesforceLastSyncAt      DateTime?
  salesforceLastModified    DateTime?    // SF LastModifiedDate for conflict detection
  salesforceSyncStatus      String?      // 'synced' | 'pending_push' | 'pending_pull' | 'conflict'

  // ... rest of model
}
```

**Account:**
```prisma
model Account {
  // ... existing fields ...

  salesforceId              String?      @unique
  salesforceLastSyncAt      DateTime?
  salesforceLastModified    DateTime?

  // ... rest of model
}
```

**Contact:**
```prisma
model Contact {
  // ... existing fields ...

  salesforceId              String?      @unique
  salesforceLastSyncAt      DateTime?

  // ... rest of model
}
```

**User (for owner mapping):**
```prisma
model User {
  // ... existing fields ...

  salesforceUserId          String?      // Map to SF User.Id via email
}
```

---

## 🌐 API Endpoints

### OAuth Flow

```
GET  /api/v1/integrations/salesforce/auth
     → Redirects to Salesforce OAuth login

GET  /api/v1/integrations/salesforce/callback
     → Handles OAuth callback, stores tokens

DELETE /api/v1/integrations/salesforce/disconnect
     → Revokes tokens, removes integration
```

### Sync Operations

```
POST /api/v1/integrations/salesforce/sync
     → Trigger full sync (import + export)
     Body: { direction?: 'import' | 'export' | 'bidirectional' }

GET  /api/v1/integrations/salesforce/status
     → Get integration status, last sync time, errors

POST /api/v1/integrations/salesforce/import
     → Import all opportunities from Salesforce

POST /api/v1/integrations/salesforce/export
     → Push all local changes to Salesforce
```

### Individual Record Sync

```
POST /api/v1/opportunities/[id]/sync-salesforce
     → Sync single opportunity with Salesforce

POST /api/v1/accounts/[id]/sync-salesforce
     → Sync single account with Salesforce
```

### Settings

```
GET  /api/v1/integrations/salesforce/settings
     → Get sync configuration

PATCH /api/v1/integrations/salesforce/settings
     → Update sync configuration
     Body: { syncIntervalMinutes, syncDirection, isEnabled }
```

---

## 🔄 Sync Architecture

### High-Level Flow

```
┌─────────────────┐         ┌─────────────────┐
│   Your App      │◄───────►│   Salesforce    │
│                 │         │                 │
│  Opportunities  │  jsforce│  Opportunities  │
│  Accounts       │◄───────►│  Accounts       │
│  Contacts       │   API   │  Contacts       │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
    PostgreSQL                 Salesforce DB
```

### Sync Process (Inngest Background Job)

```typescript
// /src/inngest/functions/salesforce-sync.ts

export const salesforceSync = inngest.createFunction(
  {
    id: 'salesforce-sync',
    retries: 3,
  },
  { event: 'salesforce/sync.requested' },
  async ({ event, step }) => {
    const { organizationId, direction } = event.data;

    // Step 1: Get integration and refresh token if needed
    const integration = await step.run('get-integration', async () => {
      return await refreshTokenIfNeeded(organizationId);
    });

    // Step 2: Import from Salesforce
    if (direction !== 'export_only') {
      await step.run('import-opportunities', async () => {
        return await importOpportunities(integration);
      });

      await step.run('import-accounts', async () => {
        return await importAccounts(integration);
      });

      await step.run('import-contacts', async () => {
        return await importContacts(integration);
      });
    }

    // Step 3: Export to Salesforce
    if (direction !== 'import_only') {
      await step.run('export-opportunities', async () => {
        return await exportOpportunities(integration);
      });
    }

    // Step 4: Update sync status
    await step.run('update-status', async () => {
      await prisma.salesforceIntegration.update({
        where: { organizationId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncError: null,
        },
      });
    });
  }
);
```

### Scheduled Sync (Inngest Cron)

```typescript
export const scheduledSalesforceSync = inngest.createFunction(
  { id: 'scheduled-salesforce-sync' },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    // Find all orgs with enabled Salesforce integration
    const integrations = await step.run('get-integrations', async () => {
      return await prisma.salesforceIntegration.findMany({
        where: {
          isEnabled: true,
          // Only sync if interval has passed
          OR: [
            { lastSyncAt: null },
            {
              lastSyncAt: {
                lt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
              },
            },
          ],
        },
      });
    });

    // Trigger sync for each org
    for (const integration of integrations) {
      await inngest.send({
        name: 'salesforce/sync.requested',
        data: {
          organizationId: integration.organizationId,
          direction: integration.syncDirection,
        },
      });
    }
  }
);
```

### Conflict Resolution Strategy

When the same record is modified in both systems:

1. **Last-write-wins (default):** Compare `updatedAt` vs `LastModifiedDate`
2. **Salesforce-wins:** Always prefer Salesforce data (for orgs where SF is source of truth)
3. **App-wins:** Always prefer your app data (for orgs using SF as backup)
4. **Manual resolution:** Flag conflicts for user review

```typescript
const resolveConflict = (
  localRecord: Opportunity,
  sfRecord: SalesforceOpportunity,
  strategy: 'last_write_wins' | 'salesforce_wins' | 'app_wins'
) => {
  switch (strategy) {
    case 'salesforce_wins':
      return 'import'; // Update local with SF data
    case 'app_wins':
      return 'export'; // Update SF with local data
    case 'last_write_wins':
    default:
      const localModified = new Date(localRecord.updatedAt);
      const sfModified = new Date(sfRecord.LastModifiedDate);
      return localModified > sfModified ? 'export' : 'import';
  }
};
```

---

## 📅 Implementation Phases

### Phase 1: OAuth & Connection (1-2 days)

- [ ] Add `SalesforceIntegration` model to Prisma schema
- [ ] Create OAuth endpoints (`/auth`, `/callback`, `/disconnect`)
- [ ] Build settings UI in organization settings page
- [ ] Store encrypted tokens securely
- [ ] Test connection with Salesforce API

**Deliverables:**
- Users can connect/disconnect Salesforce
- Settings page shows connection status

### Phase 2: Import from Salesforce (2-3 days)

- [ ] Add `salesforceId` fields to Opportunity, Account, Contact
- [ ] Create jsforce service layer (`/src/lib/salesforce/`)
- [ ] Build field mapping utilities
- [ ] Implement import logic for:
  - [ ] Accounts
  - [ ] Contacts
  - [ ] Opportunities
- [ ] Create import API endpoint
- [ ] Add import button to UI

**Deliverables:**
- One-click import of all SF data
- Duplicate detection via `salesforceId`
- Import progress indicator

### Phase 3: Export to Salesforce (2-3 days)

- [ ] Implement export logic for:
  - [ ] Opportunities (create + update)
  - [ ] Accounts (create + update)
  - [ ] Contacts (create + update)
- [ ] Add sync status tracking
- [ ] Create export API endpoint
- [ ] Add "Sync to SF" button on opportunity detail

**Deliverables:**
- Push local changes to Salesforce
- Handle new records (create in SF)
- Handle updates (update in SF)

### Phase 4: Automated Sync (2-3 days)

- [ ] Create Inngest scheduled sync function
- [ ] Implement incremental sync (only changed records)
- [ ] Add conflict detection and resolution
- [ ] Build sync history/logs UI
- [ ] Add sync configuration options

**Deliverables:**
- Automatic background sync every X minutes
- Sync history with success/error logs
- Configurable sync settings

### Phase 5: Advanced Features (Optional, 3-5 days)

- [ ] Real-time webhooks (Salesforce Outbound Messages)
- [ ] Custom field mapping UI
- [ ] Selective sync (choose which opportunities to sync)
- [ ] Sync reports and analytics
- [ ] Bulk operations optimization

---

## 🔒 Security Considerations

### Token Storage

- **Encrypt tokens** using the same pattern as Gong integration (`accessKeySecret`)
- Store encryption key in environment variable
- Never log tokens

### OAuth Security

- Use PKCE flow for additional security (optional)
- Validate `state` parameter to prevent CSRF
- Short-lived access tokens with refresh token rotation

### Data Access

- Only sync data the user has access to in Salesforce
- Respect Salesforce sharing rules
- Scope all queries by `organizationId`

### Rate Limiting

- Salesforce API limits: 15,000-100,000 calls/day depending on edition
- Implement rate limiting and backoff
- Batch operations where possible (max 200 records per API call)

---

## 🧪 Testing Strategy

### Unit Tests

- Field mapping functions
- Conflict resolution logic
- Token refresh logic

### Integration Tests

- OAuth flow (mock Salesforce responses)
- Import/export operations (mock jsforce)
- Error handling and retries

### Manual Testing Checklist

- [ ] Connect to Salesforce
- [ ] Import opportunities from SF
- [ ] Verify field mapping is correct
- [ ] Create opportunity in app, sync to SF
- [ ] Update opportunity in SF, sync to app
- [ ] Test conflict resolution
- [ ] Disconnect and reconnect
- [ ] Test with different user roles

### Test Data in Salesforce

Create test opportunities in your Developer org:
1. "Test Opp - Discovery Stage" - Amount: $50,000
2. "Test Opp - Closed Won" - Amount: $100,000
3. "Test Opp - With Account" - Linked to test account

---

## 📁 File Structure

```
src/
├── app/api/v1/integrations/salesforce/
│   ├── auth/route.ts           # OAuth initiation
│   ├── callback/route.ts       # OAuth callback
│   ├── disconnect/route.ts     # Revoke tokens
│   ├── status/route.ts         # Get status
│   ├── sync/route.ts           # Trigger sync
│   ├── settings/route.ts       # Get/update settings
│   └── import/route.ts         # Import from SF
├── lib/
│   └── salesforce/
│       ├── client.ts           # jsforce connection factory
│       ├── auth.ts             # OAuth helpers
│       ├── sync.ts             # Sync logic
│       ├── mappers/
│       │   ├── opportunity.ts  # Opportunity field mapping
│       │   ├── account.ts      # Account field mapping
│       │   └── contact.ts      # Contact field mapping
│       └── types.ts            # Salesforce types
├── inngest/functions/
│   └── salesforce-sync.ts      # Background sync jobs
└── components/integrations/
    └── SalesforceSettings.tsx  # Settings UI
```

---

## 🚀 Getting Started

### Immediate Next Steps

1. **Create Connected App** in your Salesforce Developer org (see instructions above)
2. **Add environment variables** to `.env.local`
3. **Install jsforce:** `npm install jsforce`
4. **Run Prisma migration** after adding schema changes

### Questions to Decide

1. **Sync direction:** Do you want bidirectional sync, or import-only/export-only?
2. **Conflict resolution:** Which strategy fits your workflow?
3. **Sync frequency:** How often should automated sync run?
4. **Custom fields:** Do you need to create custom fields in Salesforce to match your app's fields (e.g., `role`, `sentiment` for contacts)?

---

## 📚 Resources

- [Salesforce Developer Docs - REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [jsforce Documentation](https://jsforce.github.io/)
- [Salesforce Connected Apps Guide](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)
- [OAuth 2.0 Web Server Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
