# Google Calendar Integration - Implementation Guide

**Status:** Planned
**Priority:** Medium
**Estimated Effort:** 3-5 days
**Dependencies:** Supabase Auth, Prisma, Google Cloud Console setup

---

## 📋 Overview

This feature will integrate Google Calendar with the Sales Opportunity Tracker to:
1. **View external meetings** - Automatically sync and display calendar events within the app
2. **Track meeting context** - Link calendar events to opportunities and accounts
3. **Add to calendar** (future) - Create calendar events directly from opportunities

### Business Value
- **Sales visibility**: See upcoming external meetings alongside opportunities
- **Context awareness**: Understand meeting frequency and timing for each account
- **Workflow automation**: Reduce manual calendar management for sales reps

---

## 🏗️ Architecture Overview

### Authentication Flow
```
User clicks "Connect Google Calendar" (Settings page)
    ↓
Redirect to Google OAuth consent screen
    ↓
User grants calendar permissions
    ↓
Google redirects to callback URL with authorization code
    ↓
Exchange code for access_token + refresh_token
    ↓
Store tokens in OAuthToken table (encrypted)
    ↓
User's calendar is now connected
```

### Token Management
- **Access tokens** expire after 1 hour
- **Refresh tokens** are long-lived (until user revokes)
- Automatic token refresh before expiration
- Background job checks token expiration daily

### Data Sync Strategy
**Option A: On-demand fetching** (Recommended for MVP)
- Fetch calendar events when user views a page
- Cache results in memory for 5-10 minutes
- No database storage of calendar events

**Option B: Background sync** (Future enhancement)
- Periodic sync job (every 15-30 minutes)
- Store events in `CalendarEvent` table
- Enable advanced features (notifications, search, analytics)

---

## 🗄️ Database Schema Changes

### New Model: OAuthToken

```prisma
model OAuthToken {
  id           String    @id @default(cuid())
  userId       String
  provider     String    // "google", "microsoft", "apple"
  accessToken  String    @db.Text  // Encrypted
  refreshToken String?   @db.Text  // Encrypted
  expiresAt    DateTime
  scopes       String[]  // Granted OAuth scopes
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
  @@index([expiresAt])
  @@schema("opportunity_tracker")
}

model User {
  // ... existing fields ...
  oauthTokens  OAuthToken[]
}
```

### Optional: CalendarEvent Model (for Option B - Background Sync)

```prisma
model CalendarEvent {
  id                String    @id @default(cuid())
  userId            String
  googleEventId     String    // Google's event ID
  summary           String    // Event title
  description       String?   @db.Text
  location          String?
  startTime         DateTime
  endTime           DateTime
  attendees         String[]  // Email addresses
  isExternal        Boolean   // Has attendees outside organization
  organizerEmail    String?
  meetingUrl        String?   // Google Meet, Zoom, etc.
  opportunityId     String?   // Link to opportunity (optional)
  accountId         String?   // Link to account (optional)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity       Opportunity?  @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  account           Account?      @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@unique([userId, googleEventId])
  @@index([userId, startTime])
  @@index([opportunityId])
  @@index([accountId])
  @@schema("opportunity_tracker")
}

model Opportunity {
  // ... existing fields ...
  calendarEvents CalendarEvent[]
}

model Account {
  // ... existing fields ...
  calendarEvents CalendarEvent[]
}
```

### Migration Commands

```bash
# Create migration
npx prisma migrate dev --name add_oauth_tokens

# If adding CalendarEvent later
npx prisma migrate dev --name add_calendar_events

# Generate Prisma Client
npx prisma generate
```

---

## 🔐 Environment Variables

Add to `.env` and `.env.example`:

```bash
# Google Calendar OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/integrations/google/callback

# Production
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/v1/integrations/google/callback

# Optional: Encryption key for OAuth tokens
OAUTH_ENCRYPTION_KEY=generate_a_32_character_key
```

### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable **Google Calendar API**:
   - APIs & Services → Library → Search "Google Calendar API" → Enable
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/v1/integrations/google/callback` (development)
     - `https://yourdomain.com/api/v1/integrations/google/callback` (production)
5. Copy **Client ID** and **Client Secret** to `.env`

---

## 📁 File Structure

```
/src
  /lib
    /integrations
      google-calendar.ts           # Google Calendar API client
      oauth-helpers.ts             # Token refresh, encryption, validation
  /app
    /api
      /v1
        /integrations
          /google
            /authorize
              route.ts             # GET - Initiate OAuth flow
            /callback
              route.ts             # GET - Handle OAuth callback
            /disconnect
              route.ts             # POST - Revoke tokens and disconnect
            /calendar
              /events
                route.ts           # GET - Fetch calendar events
              /sync
                route.ts           # POST - Manual sync trigger (future)
    /settings
      /integrations
        page.tsx                   # Settings page for managing integrations
  /components
    /integrations
      google-calendar-connect-button.tsx
      google-calendar-disconnect-button.tsx
      calendar-events-list.tsx
      calendar-event-card.tsx
      upcoming-meetings-widget.tsx
  /types
    calendar.ts                    # TypeScript types for calendar events
```

---

## 🛠️ Implementation Phases

### Phase 1: OAuth Infrastructure (Days 1-2)

**Goal:** Enable users to connect their Google Calendar

**Tasks:**
1. ✅ Create `OAuthToken` Prisma model and migration
2. ✅ Add Google OAuth environment variables
3. ✅ Set up Google Cloud Console project and OAuth credentials
4. ✅ Create OAuth helper utilities (`/src/lib/integrations/oauth-helpers.ts`):
   - `encryptToken()` - Encrypt tokens before storage
   - `decryptToken()` - Decrypt tokens for API calls
   - `isTokenExpired()` - Check if token needs refresh
   - `refreshGoogleToken()` - Exchange refresh token for new access token
5. ✅ Implement OAuth routes:
   - `GET /api/v1/integrations/google/authorize` - Start OAuth flow
   - `GET /api/v1/integrations/google/callback` - Handle callback, store tokens
   - `POST /api/v1/integrations/google/disconnect` - Revoke and delete tokens
6. ✅ Build Settings UI:
   - "Connect Google Calendar" button
   - Connection status indicator
   - "Disconnect" button
   - Last sync timestamp
7. ✅ Test OAuth flow end-to-end

**Deliverables:**
- Users can connect/disconnect Google Calendar
- Tokens stored securely in database
- Automatic token refresh working

---

### Phase 2: Calendar Event Fetching (Days 3-4)

**Goal:** Display external meetings in the app

**Tasks:**
1. ✅ Create Google Calendar API client (`/src/lib/integrations/google-calendar.ts`):
   - `GoogleCalendarClient` class
   - `listEvents(userId, startDate, endDate)` - Fetch events
   - `getEvent(userId, eventId)` - Get single event details
   - Built-in token refresh handling
2. ✅ Create API endpoint:
   - `GET /api/v1/integrations/google/calendar/events` - Fetch events
   - Query params: `startDate`, `endDate`, `accountId` (filter by account)
   - Response format: `{ events: CalendarEvent[], hasMore: boolean }`
3. ✅ Define TypeScript types (`/src/types/calendar.ts`):
   - `CalendarEvent` interface
   - `CalendarEventFilter` interface
   - `CalendarProvider` enum
4. ✅ Build UI components:
   - `<CalendarEventsList />` - List view of events
   - `<CalendarEventCard />` - Individual event card
   - `<UpcomingMeetingsWidget />` - Dashboard widget
5. ✅ Integrate into existing pages:
   - Dashboard: "Upcoming External Meetings" section
   - Opportunity detail: Related calendar events
   - Account detail: All meetings with this account
6. ✅ Add filtering logic:
   - Identify "external" meetings (attendees outside organization)
   - Filter by date range
   - Filter by account/opportunity

**Deliverables:**
- Users can view calendar events in the app
- Events are identified as external/internal
- Events can be linked to accounts/opportunities

---

### Phase 3: Write Operations (Future - Days 5+)

**Goal:** Create and manage calendar events from the app

**Tasks:**
1. ✅ Update OAuth scopes to include write access:
   - Change from `calendar.readonly` to `calendar.events`
2. ✅ Extend Google Calendar client:
   - `createEvent(userId, eventData)` - Create new event
   - `updateEvent(userId, eventId, updates)` - Update existing event
   - `deleteEvent(userId, eventId)` - Delete event
3. ✅ Create API endpoints:
   - `POST /api/v1/integrations/google/calendar/events` - Create event
   - `PATCH /api/v1/integrations/google/calendar/events/[id]` - Update event
   - `DELETE /api/v1/integrations/google/calendar/events/[id]` - Delete event
4. ✅ Build UI features:
   - "Add to Calendar" button on opportunity detail page
   - Calendar event creation dialog
   - Pre-fill event details from opportunity data
5. ✅ Add opportunity ↔ calendar sync:
   - Store `googleEventId` on Opportunity model
   - Update calendar event when opportunity changes
   - Update opportunity when calendar event changes (webhook)

**Deliverables:**
- Users can create calendar events from opportunities
- Events stay in sync with opportunity data
- Two-way sync between app and Google Calendar

---

## 🔌 API Documentation

### Authorization Endpoint

**Start OAuth Flow**
```http
GET /api/v1/integrations/google/authorize
```

**Response:**
- Redirects to Google OAuth consent screen
- User grants calendar permissions
- Google redirects to callback URL

**State Parameter:**
- Includes `userId` to verify user on callback
- Prevents CSRF attacks

---

### Callback Endpoint

**Handle OAuth Callback**
```http
GET /api/v1/integrations/google/callback?code={auth_code}&state={user_id}
```

**Query Parameters:**
- `code` (string, required) - Authorization code from Google
- `state` (string, required) - User ID for verification

**Success Response:**
```json
{
  "success": true,
  "message": "Google Calendar connected successfully",
  "scopes": ["https://www.googleapis.com/auth/calendar.readonly"]
}
```

**Error Response:**
```json
{
  "error": "Invalid authorization code",
  "details": "The authorization code has expired or is invalid"
}
```

**Redirects to:** `/settings/integrations?status=connected`

---

### Disconnect Endpoint

**Revoke Calendar Access**
```http
POST /api/v1/integrations/google/disconnect
```

**Request Headers:**
- `Content-Type: application/json`

**Success Response:**
```json
{
  "success": true,
  "message": "Google Calendar disconnected"
}
```

**Error Response:**
```json
{
  "error": "No connected calendar found"
}
```

---

### Fetch Events Endpoint

**Get Calendar Events**
```http
GET /api/v1/integrations/google/calendar/events?startDate=2025-01-01&endDate=2025-01-31&accountId=abc123
```

**Query Parameters:**
- `startDate` (ISO date, optional) - Default: today
- `endDate` (ISO date, optional) - Default: 30 days from startDate
- `accountId` (string, optional) - Filter events by account email domains
- `externalOnly` (boolean, optional) - Only show external meetings (default: true)

**Success Response:**
```json
{
  "events": [
    {
      "id": "google_event_id_123",
      "summary": "Sales Demo - Acme Corp",
      "description": "Product demo for Q1 opportunity",
      "startTime": "2025-01-15T14:00:00Z",
      "endTime": "2025-01-15T15:00:00Z",
      "attendees": [
        "rep@yourcompany.com",
        "buyer@acmecorp.com"
      ],
      "isExternal": true,
      "organizerEmail": "rep@yourcompany.com",
      "meetingUrl": "https://meet.google.com/abc-defg-hij",
      "location": null
    }
  ],
  "hasMore": false
}
```

**Error Response:**
```json
{
  "error": "Calendar not connected",
  "message": "Please connect your Google Calendar in Settings"
}
```

---

## 🎨 UI/UX Design

### Settings Page - Calendar Integration Section

**Location:** `/settings/integrations`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Calendar Integration                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Not Connected]  Google Calendar                        │
│                                                         │
│ Connect your Google Calendar to:                        │
│ • View external meetings alongside opportunities        │
│ • Track meeting frequency with each account            │
│ • Add opportunities to your calendar (coming soon)      │
│                                                         │
│ [Connect Google Calendar] ←────────────────────────── Button│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**After Connection:**
```
┌─────────────────────────────────────────────────────────┐
│ Calendar Integration                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [✓ Connected]  Google Calendar                          │
│                                                         │
│ Connected as: user@example.com                          │
│ Last synced: 2 minutes ago                              │
│ Permissions: Read calendar events                       │
│                                                         │
│ [Disconnect]  [Sync Now]  ←──────────────────────── Buttons│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Dashboard - Upcoming Meetings Widget

**Location:** Dashboard page (top section)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Upcoming External Meetings                              │
│                                                    [⚙️]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Today                                                   │
│ ├─ 2:00 PM   Sales Demo - Acme Corp                    │
│ │             with buyer@acmecorp.com                   │
│ │             [View Opportunity]                        │
│                                                         │
│ Tomorrow                                                │
│ ├─ 10:00 AM  Discovery Call - Beta Inc                 │
│ │             with cto@betainc.com                      │
│ │             [Link to Opportunity]                     │
│                                                         │
│ Thu, Jan 18                                             │
│ ├─ 3:00 PM   Follow-up - Gamma LLC                     │
│               with founder@gammallc.com                 │
│               [View Opportunity]                        │
│                                                         │
│ [View All Meetings]                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Only shows external meetings (attendees outside organization)
- Groups by date (Today, Tomorrow, [Date])
- Links to related opportunity (if matched)
- "Link to Opportunity" action if not matched
- Gear icon opens settings (connect calendar if not connected)

---

### Opportunity Detail - Related Calendar Events

**Location:** Opportunity detail page (new tab or section)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Related Meetings                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Past Meetings (3)                                       │
│                                                         │
│ ├─ Jan 10, 2025 - Discovery Call                       │
│ │   2:00 PM - 3:00 PM                                  │
│ │   Attendees: buyer@acmecorp.com, cto@acmecorp.com   │
│ │   [📅 View in Calendar]                              │
│                                                         │
│ ├─ Jan 12, 2025 - Product Demo                         │
│ │   10:00 AM - 11:00 AM                                │
│ │   Attendees: buyer@acmecorp.com                      │
│ │   [📅 View in Calendar]                              │
│                                                         │
│ Upcoming Meetings (1)                                   │
│                                                         │
│ ├─ Jan 18, 2025 - Follow-up Call                       │
│ │   3:00 PM - 4:00 PM                                  │
│ │   Attendees: buyer@acmecorp.com                      │
│ │   [📅 View in Calendar]                              │
│                                                         │
│ [+ Add to Calendar] ←───────────────────── Future feature│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Matching Logic:**
- Match by account email domain (e.g., `@acmecorp.com`)
- Match by attendee email (if contact stored on opportunity)
- Manual linking via "Link to Opportunity" action

---

## 🔒 Security Considerations

### Token Security

**Encryption at Rest:**
```typescript
// Use crypto to encrypt tokens before storing
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY; // 32 characters
const ALGORITHM = 'aes-256-gcm';

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}
```

**Best Practices:**
- ✅ Store tokens encrypted in database (`@db.Text` for large tokens)
- ✅ Never expose tokens in client-side code
- ✅ Never log tokens (even in dev mode)
- ✅ Use environment variables for encryption keys
- ✅ Rotate encryption keys periodically
- ✅ Use HTTPS for all OAuth redirects (production)

---

### OAuth Scope Management

**Principle of Least Privilege:**
- Start with minimal scopes: `calendar.readonly`
- Only request write access when needed
- Store granted scopes in `OAuthToken.scopes` field
- Check scopes before API calls

**Scope Definitions:**
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events
- `https://www.googleapis.com/auth/calendar.events` - Read + write calendar events
- `https://www.googleapis.com/auth/calendar` - Full calendar access (avoid if possible)

**Upgrading Scopes:**
If you need additional scopes later:
1. Update OAuth authorization URL with new scopes
2. User must re-authorize (consent screen shown again)
3. New scopes stored in `OAuthToken.scopes` array

---

### User Data Privacy

**Data Scoping:**
```typescript
// ALWAYS filter by userId
const token = await prisma.oAuthToken.findUnique({
  where: {
    userId_provider: {
      userId: user.id,
      provider: 'google'
    }
  }
});

// NEVER expose another user's calendar data
const events = await prisma.calendarEvent.findMany({
  where: {
    userId: user.id, // ← Critical: scope by user
    startTime: { gte: startDate }
  }
});
```

**Multi-Tenancy:**
- Respect `organizationId` boundaries
- Never share calendar data across organizations
- Team calendars (future): Require explicit sharing permissions

**User Control:**
- Users can disconnect at any time
- Disconnecting deletes all tokens and synced events
- Clear messaging about what data is accessed

---

### Error Handling

**Token Expiration:**
```typescript
async function getValidToken(userId: string): Promise<string> {
  const token = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: 'google' } }
  });

  if (!token) {
    throw new Error('Calendar not connected');
  }

  // Check if expired
  if (new Date() >= token.expiresAt) {
    // Attempt refresh
    const newToken = await refreshGoogleToken(token.refreshToken);

    // Update in database
    await prisma.oAuthToken.update({
      where: { id: token.id },
      data: {
        accessToken: encryptToken(newToken.access_token),
        expiresAt: new Date(Date.now() + newToken.expires_in * 1000)
      }
    });

    return newToken.access_token;
  }

  return decryptToken(token.accessToken);
}
```

**Revoked Tokens:**
```typescript
// Google returns 401 if user revoked access
try {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    // Token revoked - delete from database
    await prisma.oAuthToken.delete({
      where: { userId_provider: { userId, provider: 'google' } }
    });

    throw new Error('Calendar access revoked. Please reconnect.');
  }
} catch (error) {
  // Handle network errors, rate limits, etc.
}
```

**User-Facing Error Messages:**
- ✅ "Calendar not connected. Please connect in Settings."
- ✅ "Calendar access expired. Please reconnect."
- ✅ "Failed to sync calendar. Please try again."
- ❌ Don't expose: "Invalid token: eyJhbGciOiJSUzI1..."

---

## 🧪 Testing Strategy

### Unit Tests

**Test Files:**
- `src/lib/integrations/oauth-helpers.test.ts`
- `src/lib/integrations/google-calendar.test.ts`
- `src/app/api/v1/integrations/google/authorize/route.test.ts`
- `src/app/api/v1/integrations/google/callback/route.test.ts`

**Test Coverage:**
1. **Token encryption/decryption**
   - Encrypts and decrypts correctly
   - Handles invalid encrypted strings
2. **Token refresh logic**
   - Detects expired tokens
   - Refreshes successfully with valid refresh token
   - Handles invalid/revoked refresh tokens
3. **OAuth flow**
   - Generates correct authorization URL
   - Exchanges code for tokens
   - Stores tokens in database
   - Handles callback errors (invalid code, state mismatch)
4. **Google Calendar client**
   - Fetches events correctly
   - Handles API errors (401, 403, 429, 500)
   - Automatically refreshes expired tokens

**Mock Strategy:**
- Mock Prisma client using `prisma-mock`
- Mock Google OAuth API using `msw` (Mock Service Worker)
- Mock Google Calendar API responses

---

### Integration Tests

**Test Scenarios:**
1. **Full OAuth flow**
   - User clicks "Connect"
   - Redirects to Google (check URL params)
   - Mock callback with authorization code
   - Verify tokens stored in database
   - Verify user sees "Connected" status
2. **Token refresh**
   - Create expired token in database
   - Fetch calendar events (should auto-refresh)
   - Verify new token stored
3. **Calendar event fetching**
   - Mock Google Calendar API response
   - Fetch events via API endpoint
   - Verify correct filtering (external only, date range)
   - Verify response format matches schema

**Tools:**
- Playwright or Cypress for E2E tests
- `@testing-library/react` for component tests
- Jest for unit tests

---

### Manual Testing Checklist

**Before Production:**
- [ ] OAuth flow works end-to-end (dev + production)
- [ ] Tokens are encrypted in database (check with Prisma Studio)
- [ ] Token refresh works automatically
- [ ] Disconnect flow deletes all tokens
- [ ] Calendar events display correctly
- [ ] External meeting detection works
- [ ] Date range filtering works
- [ ] Account/opportunity matching works
- [ ] Error states display user-friendly messages
- [ ] Loading states show skeletons/spinners
- [ ] Settings page shows connection status
- [ ] Test with multiple users (no data leakage)
- [ ] Test with expired/revoked tokens

---

## 📊 Analytics & Monitoring

### Metrics to Track

**Adoption Metrics:**
- Number of users who connected Google Calendar
- Percentage of active users with calendar connected
- Number of calendar events synced per user
- Number of events linked to opportunities

**Engagement Metrics:**
- Calendar events viewed per user per day
- "Add to Calendar" button clicks (Phase 3)
- Calendar sync frequency
- Settings page visits for calendar integration

**Error Metrics:**
- OAuth authorization failures
- Token refresh failures
- API call failures (401, 403, 429, 500)
- Disconnection rate (users disconnecting calendar)

**Performance Metrics:**
- Calendar event fetch latency (p50, p95, p99)
- Token refresh latency
- Background sync job duration (if implemented)

### Logging

**What to Log:**
- ✅ OAuth flow events (start, success, failure)
- ✅ Token refresh events (success, failure)
- ✅ API errors with status codes
- ✅ Sync job results (events fetched, errors)
- ❌ **NEVER log tokens or user email/calendar data**

**Log Format:**
```typescript
logger.info('OAuth authorization started', {
  userId: user.id,
  provider: 'google',
  scopes: ['calendar.readonly']
});

logger.error('Token refresh failed', {
  userId: user.id,
  provider: 'google',
  error: error.message,
  // Do NOT log token or refresh_token
});
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Create Google Cloud Console project
- [ ] Enable Google Calendar API
- [ ] Create OAuth 2.0 credentials (production redirect URI)
- [ ] Add environment variables to Vercel/hosting platform
- [ ] Generate OAuth encryption key (32 characters)
- [ ] Run Prisma migrations on production database
- [ ] Test OAuth flow on staging environment
- [ ] Review security: tokens encrypted, scopes minimal
- [ ] Set up error monitoring (Sentry, LogRocket)
- [ ] Set up analytics tracking

### Post-Deployment

- [ ] Test OAuth flow on production
- [ ] Monitor error rates
- [ ] Monitor API latency
- [ ] Check database for encrypted tokens (Prisma Studio)
- [ ] Verify no sensitive data in logs
- [ ] Test with multiple users
- [ ] Document any issues/bugs
- [ ] Gather user feedback

---

## 🛠️ Troubleshooting Guide

### Common Issues

**Issue: "redirect_uri_mismatch" error during OAuth**
- **Cause:** Redirect URI in Google Console doesn't match the one in code
- **Fix:** Ensure `GOOGLE_REDIRECT_URI` exactly matches authorized URI in Google Console

**Issue: "Invalid authorization code" error**
- **Cause:** Authorization code already used or expired (codes expire after ~10 minutes)
- **Fix:** Restart OAuth flow, exchange code immediately in callback

**Issue: Token refresh fails with 400 error**
- **Cause:** Refresh token is invalid or revoked
- **Fix:** Delete `OAuthToken` record, prompt user to reconnect

**Issue: Calendar events not showing**
- **Cause:** User's calendar is empty, or events are outside date range
- **Fix:** Check date range filter, verify events exist in Google Calendar

**Issue: "Calendar not connected" error after connection**
- **Cause:** Token not stored correctly in database
- **Fix:** Check callback route logic, verify Prisma query succeeded

---

## 📚 Resources

### Documentation
- [Google Calendar API Docs](https://developers.google.com/calendar/api/guides/overview)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### Libraries
- `googleapis` - Official Google APIs Node.js client
- `@prisma/client` - Database ORM
- `crypto` - Node.js built-in (token encryption)

### Example Code
```typescript
// Install Google APIs client
npm install googleapis

// Example usage
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials
oauth2Client.setCredentials({
  access_token: accessToken,
  refresh_token: refreshToken
});

// Create Calendar client
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Fetch events
const response = await calendar.events.list({
  calendarId: 'primary',
  timeMin: new Date().toISOString(),
  maxResults: 10,
  singleEvents: true,
  orderBy: 'startTime',
});
```

---

## ✅ Acceptance Criteria

### Phase 1: OAuth Infrastructure
- [ ] User can click "Connect Google Calendar" in Settings
- [ ] OAuth flow redirects to Google consent screen
- [ ] User grants calendar read permissions
- [ ] Callback stores encrypted tokens in database
- [ ] Settings page shows "Connected" status
- [ ] User can disconnect calendar (deletes tokens)
- [ ] Token refresh happens automatically before expiration

### Phase 2: Calendar Event Fetching
- [ ] User can view upcoming external meetings on dashboard
- [ ] Events are filtered to only show external attendees
- [ ] Events can be filtered by date range
- [ ] Events show: title, time, attendees, meeting URL
- [ ] Events are linked to opportunities/accounts (if matched)
- [ ] Loading states show skeleton loaders
- [ ] Empty states show "No upcoming meetings"
- [ ] Error states show user-friendly messages

### Phase 3: Write Operations (Future)
- [ ] User can create calendar events from opportunities
- [ ] Event details pre-filled from opportunity data
- [ ] Events sync back to Google Calendar
- [ ] User can edit/delete events from the app
- [ ] Changes sync bidirectionally

---

## 🎯 Success Metrics

**Adoption:**
- 60%+ of active users connect Google Calendar within 30 days
- 80%+ of connected users keep calendar connected after 90 days

**Engagement:**
- Users view calendar events 3+ times per week on average
- 40%+ of opportunities are linked to calendar events

**Performance:**
- Calendar event fetch latency < 1 second (p95)
- Token refresh success rate > 99%
- OAuth flow completion rate > 90%

**Quality:**
- Zero token leakage incidents
- < 5% error rate on API calls
- User-reported bugs < 2 per month

---

## 📝 Future Enhancements

### v2.0 Features
- **Webhook subscriptions** - Real-time calendar updates
- **Meeting intelligence** - Extract action items from calendar events
- **Automatic opportunity creation** - Create opportunities from qualifying meetings
- **Multi-calendar support** - Sync multiple calendars per user
- **Team calendars** - Share team availability with sales reps

### Other Calendar Providers
- **Microsoft Outlook/Office 365**
- **Apple Calendar (iCloud)**
- **CalDAV (generic standard)**

### Advanced Features
- **Meeting prep automation** - Pull opportunity context before meetings
- **Post-meeting follow-up** - Create tasks/notes after meetings
- **Calendar analytics** - Meeting frequency by account/stage
- **Scheduling links** - Generate booking links for prospects

---

## 🤝 Contributing

When implementing this feature:
1. Follow the project's [Claude Agent Rules](./.claude/CLAUDE.md)
2. Use TypeScript strict mode (no `any` types)
3. Add Zod validation for all API inputs
4. Write unit tests for critical logic
5. Document all public functions with JSDoc
6. Use path aliases (`@/`) instead of relative imports
7. Follow existing API response patterns
8. Add error handling with user-friendly messages

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Author:** AI Assistant (Claude)
**Status:** Ready for Implementation