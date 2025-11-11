# Multi-Tenancy & Permissions

> Organization model, user roles, and data isolation

---

## 🏢 Multi-Tenancy Overview

This application uses a **multi-tenant architecture** where multiple organizations share the same database and application instance, but data is strictly isolated by `organizationId`.

**Key Concepts:**
- Each **Organization** is a separate tenant
- **Users** belong to one Organization
- **All data** (Opportunities, Accounts, Contacts, Views) is scoped to Organization
- **No cross-org data access** - even admins cannot see other orgs' data

---

## 📐 Organization Model

### Organization
Top-level tenant entity.

**Fields:**
- `id` (String, CUID) - Unique identifier
- `name` (String) - Organization display name
- `domain` (String, nullable, unique) - Email domain for auto-join (e.g., "acmecorp.com")
- `logo` (String, nullable) - Organization logo URL
- `fiscalYearStartMonth` (Int, 1-12) - Fiscal year start (default: 1 = January)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `users` → User[] (all users in this org)
- `accounts` → Account[] (all accounts)
- `opportunities` → Opportunity[] (all opportunities)
- `kanbanViews` → KanbanView[] (shared views)
- `invitations` → Invitation[] (pending invitations)
- `settings` → OrganizationSettings (one-to-one)

**Example:**
```json
{
  "id": "org_abc123",
  "name": "Acme Sales Team",
  "domain": "acme.com",
  "logo": "https://acme.com/logo.png",
  "fiscalYearStartMonth": 1
}
```

---

### OrganizationSettings
Configuration for an organization.

**Fields:**
- `id` (String, CUID)
- `organizationId` (String, unique FK)
- `defaultKanbanView` (String, nullable) - Default view ID for new users
- `defaultKanbanTemplateId` (String, nullable) - Default template to apply
- `allowSelfSignup` (Boolean, default: false) - Allow users to sign up without invitation
- `allowDomainAutoJoin` (Boolean, default: false) - Auto-add users with matching email domain
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Example:**
```json
{
  "organizationId": "org_abc123",
  "defaultKanbanView": "view_xyz789",
  "allowSelfSignup": false,
  "allowDomainAutoJoin": true
}
```

---

## 👥 User Roles

### UserRole Enum
```typescript
"ADMIN" | "MANAGER" | "REP" | "VIEWER"
```

### Role Permissions

#### ADMIN
**Full access to everything in the organization.**

Permissions:
- ✅ Manage organization settings
- ✅ Invite/remove users
- ✅ Change user roles
- ✅ View/edit all opportunities (any owner)
- ✅ View/edit all accounts
- ✅ Delete any data
- ✅ Create shared Kanban views
- ✅ Access admin endpoints

**Use Cases:**
- Org admins, IT admins, sales ops

---

#### MANAGER
**Can manage team members and view their data.**

Permissions:
- ✅ View/edit direct reports' opportunities
- ✅ View/edit own opportunities
- ✅ Invite users (role ≤ MANAGER)
- ✅ Change direct reports' roles (to REP or VIEWER)
- ✅ Create shared Kanban views
- ❌ Cannot change org settings
- ❌ Cannot delete users
- ❌ Cannot view other teams' data (unless direct report)

**Use Cases:**
- Sales managers, team leads

---

#### REP
**Standard user - can manage own data.**

Permissions:
- ✅ View/edit own opportunities
- ✅ View/edit own accounts
- ✅ Create/edit own contacts
- ✅ Create personal Kanban views
- ✅ View shared Kanban views
- ❌ Cannot view others' opportunities (unless shared)
- ❌ Cannot invite users
- ❌ Cannot change settings
- ❌ Cannot delete others' data

**Use Cases:**
- Sales reps, account executives

---

#### VIEWER
**Read-only access to own data.**

Permissions:
- ✅ View own opportunities (read-only)
- ✅ View shared Kanban views (read-only)
- ✅ Export data
- ❌ Cannot create/edit/delete anything
- ❌ Cannot invite users
- ❌ Cannot change settings

**Use Cases:**
- Sales ops (read-only), executives, analysts

---

## 🔐 Data Isolation Rules

### Principle: Always Scope by organizationId

**Every query MUST include `organizationId`:**

```typescript
// ✅ CORRECT
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId, // REQUIRED
  }
});

// ❌ WRONG - exposes data across orgs
const opportunities = await prisma.opportunity.findMany();
```

---

### Filtering by Owner

**REP role - see only own data:**
```typescript
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId,
    ownerId: user.id, // REPs see only their own
  }
});
```

**MANAGER role - see own + direct reports:**
```typescript
// Get all direct report IDs
const directReportIds = await prisma.user.findMany({
  where: { managerId: user.id },
  select: { id: true }
});

const allowedOwnerIds = [
  user.id,
  ...directReportIds.map(u => u.id)
];

const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId,
    ownerId: { in: allowedOwnerIds }
  }
});
```

**ADMIN role - see all in org:**
```typescript
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId,
    // No ownerId filter - see all
  }
});
```

---

### Verification Before Update/Delete

**Always verify ownership before modifying data:**

```typescript
// Get opportunity
const opportunity = await prisma.opportunity.findUnique({
  where: { id: opportunityId }
});

// Verify ownership
if (!opportunity) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

if (opportunity.organizationId !== user.organizationId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// For REP role, also check ownerId
if (user.role === 'REP' && opportunity.ownerId !== user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// For MANAGER role, check if owner is direct report
if (user.role === 'MANAGER') {
  const isDirectReport = await prisma.user.findFirst({
    where: {
      id: opportunity.ownerId,
      managerId: user.id
    }
  });

  if (!isDirectReport && opportunity.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}

// Now safe to update
await prisma.opportunity.update({
  where: { id: opportunityId },
  data: { /* updates */ }
});
```

---

## 🎫 Invitation System

### Workflow

**1. Admin/Manager sends invitation:**
```typescript
// POST /api/v1/invitations
const invitation = await prisma.invitation.create({
  data: {
    email: 'newuser@acme.com',
    role: 'REP',
    organizationId: user.organizationId,
    invitedById: user.id,
    token: generateUniqueToken(), // cuid
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
});

// Send email with invitation link
sendEmail({
  to: invitation.email,
  subject: 'Join Acme Sales Team',
  body: `Click here to join: ${appUrl}/auth/accept-invitation/${invitation.token}`
});
```

**2. User clicks invitation link:**
- Redirects to `/auth/accept-invitation/[token]`
- Verifies token is valid and not expired
- Shows sign-up form (if new user) or sign-in form (if existing)

**3. User accepts invitation:**
```typescript
// POST /api/v1/invitations/accept
const invitation = await prisma.invitation.findUnique({
  where: { token },
  include: { organization: true }
});

// Verify not expired
if (invitation.expiresAt < new Date()) {
  return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
}

// Create Supabase user
const { data: authUser, error } = await supabase.auth.signUp({
  email: invitation.email,
  password: providedPassword
});

// Create user record
const user = await prisma.user.create({
  data: {
    email: invitation.email,
    supabaseId: authUser.user.id,
    organizationId: invitation.organizationId,
    role: invitation.role,
    name: providedName
  }
});

// Mark invitation as accepted
await prisma.invitation.update({
  where: { id: invitation.id },
  data: { acceptedAt: new Date() }
});

// Redirect to dashboard
redirect('/opportunities');
```

---

### Domain Auto-Join

If `allowDomainAutoJoin` is enabled:

**1. User signs up with matching domain:**
```typescript
// POST /api/v1/auth/signup
const emailDomain = email.split('@')[1];

// Find org with matching domain
const org = await prisma.organization.findFirst({
  where: {
    domain: emailDomain,
    settings: {
      allowDomainAutoJoin: true
    }
  },
  include: { settings: true }
});

if (org) {
  // Auto-add to organization
  await prisma.user.create({
    data: {
      email,
      supabaseId: authUser.user.id,
      organizationId: org.id,
      role: 'REP', // Default role for auto-join
      name: providedName
    }
  });
}
```

**Security Note:**
- Only enable auto-join for trusted corporate domains
- Require email verification before granting access
- Consider requiring admin approval for auto-joined users

---

### Self-Signup

If `allowSelfSignup` is enabled:

**1. User signs up without invitation:**
```typescript
// POST /api/v1/auth/signup
const org = await prisma.organization.findFirst({
  where: {
    settings: {
      allowSelfSignup: true
    }
  }
});

// Or create new org for user
const newOrg = await prisma.organization.create({
  data: {
    name: `${userName}'s Organization`,
    settings: {
      create: {
        allowSelfSignup: true
      }
    }
  }
});

const user = await prisma.user.create({
  data: {
    email,
    supabaseId: authUser.user.id,
    organizationId: newOrg.id,
    role: 'ADMIN', // First user is admin
    name: providedName
  }
});
```

---

## 🔒 Permission Checking Helpers

### Server-Side Helpers

```typescript
// /src/lib/permissions.ts

export async function requireAuth(req: NextRequest) {
  const session = await getSession(req);
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function getUserWithOrg(supabaseId: string) {
  const user = await prisma.user.findUnique({
    where: { supabaseId },
    include: { organization: true }
  });

  if (!user?.organizationId) {
    throw new Error('User not in organization');
  }

  return user;
}

export function requireRole(user: User, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden');
  }
}

export async function canAccessOpportunity(
  user: User,
  opportunityId: string
): Promise<boolean> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId }
  });

  if (!opportunity) return false;
  if (opportunity.organizationId !== user.organizationId) return false;

  // ADMIN can access all
  if (user.role === 'ADMIN') return true;

  // Own opportunity
  if (opportunity.ownerId === user.id) return true;

  // MANAGER can access direct reports'
  if (user.role === 'MANAGER') {
    const isDirectReport = await prisma.user.findFirst({
      where: {
        id: opportunity.ownerId,
        managerId: user.id
      }
    });
    return !!isDirectReport;
  }

  return false;
}

export async function canEditOpportunity(
  user: User,
  opportunityId: string
): Promise<boolean> {
  // VIEWER cannot edit
  if (user.role === 'VIEWER') return false;

  // Otherwise, same as canAccessOpportunity
  return canAccessOpportunity(user, opportunityId);
}
```

**Usage in API routes:**
```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const user = await getUserWithOrg(session.user.id);

    const canEdit = await canEditOpportunity(user, params.id);
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Proceed with update...
  } catch (error) {
    // Handle errors...
  }
}
```

---

### Client-Side Helpers

```typescript
// /src/hooks/usePermissions.ts
"use client";

import { useUser } from '@/hooks/useUser';

export function usePermissions() {
  const { user } = useUser();

  return {
    isAdmin: user?.role === 'ADMIN',
    isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN',
    isRep: user?.role === 'REP',
    isViewer: user?.role === 'VIEWER',

    canInviteUsers: user?.role === 'ADMIN' || user?.role === 'MANAGER',
    canEditOrgSettings: user?.role === 'ADMIN',
    canViewAllOpportunities: user?.role === 'ADMIN',

    canEditOpportunity: (opportunity: Opportunity) => {
      if (user?.role === 'VIEWER') return false;
      if (user?.role === 'ADMIN') return true;
      if (opportunity.ownerId === user?.id) return true;
      // Check if MANAGER and direct report (would need additional data)
      return false;
    }
  };
}
```

**Usage in components:**
```tsx
"use client";

import { usePermissions } from '@/hooks/usePermissions';

export function OpportunityActions({ opportunity }: Props) {
  const { canEditOpportunity } = usePermissions();

  return (
    <div>
      {canEditOpportunity(opportunity) && (
        <Button onClick={handleEdit}>Edit</Button>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Multi-Tenancy

### Test Scenarios

**1. Data Isolation:**
- Create 2 orgs with different users
- Verify user A cannot see user B's opportunities
- Verify API returns 403 when accessing cross-org data

**2. Role Permissions:**
- Test each role can only perform allowed actions
- Verify REP cannot invite users
- Verify VIEWER cannot edit opportunities
- Verify MANAGER can see direct reports' data

**3. Invitation Flow:**
- Send invitation
- Verify token expiration
- Test accepting invitation
- Verify user is added to correct org

**4. Domain Auto-Join:**
- Enable auto-join for test domain
- Sign up with matching email
- Verify user is auto-added to org

---

## 🔍 Common Pitfalls & Solutions

### Pitfall 1: Forgetting organizationId in Queries
**Problem:**
```typescript
const opportunities = await prisma.opportunity.findMany();
// Returns ALL opportunities across ALL orgs!
```

**Solution:**
Always include `organizationId` in `where` clause:
```typescript
const opportunities = await prisma.opportunity.findMany({
  where: { organizationId: user.organizationId }
});
```

---

### Pitfall 2: Using Supabase User ID Directly
**Problem:**
```typescript
const opportunities = await prisma.opportunity.findMany({
  where: { ownerId: session.user.id } // supabaseId, not User.id!
});
```

**Solution:**
Look up User record first:
```typescript
const user = await prisma.user.findUnique({
  where: { supabaseId: session.user.id }
});

const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId,
    ownerId: user.id // Prisma User.id
  }
});
```

---

### Pitfall 3: Not Checking Role Before Actions
**Problem:**
```typescript
// Any user can delete any opportunity!
await prisma.opportunity.delete({ where: { id } });
```

**Solution:**
Check role and ownership:
```typescript
if (user.role === 'VIEWER') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

const canEdit = await canEditOpportunity(user, id);
if (!canEdit) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

await prisma.opportunity.delete({ where: { id } });
```

---

### Pitfall 4: Hardcoding organizationId
**Problem:**
```typescript
const org = await prisma.organization.findUnique({
  where: { id: 'org_abc123' } // Hardcoded!
});
```

**Solution:**
Always use authenticated user's organizationId:
```typescript
const org = await prisma.organization.findUnique({
  where: { id: user.organizationId }
});
```

---

## 📋 Multi-Tenancy Checklist

When building new features, ensure:

- [ ] All queries include `organizationId` filter
- [ ] User record fetched via `supabaseId` (not used directly)
- [ ] Role permissions checked for sensitive actions
- [ ] Ownership verified before update/delete
- [ ] API returns 403 for unauthorized access (not 404)
- [ ] Cross-org data leakage tested
- [ ] Invitation flow tested (if adding user management)
- [ ] Direct report relationship checked (for MANAGER role)
- [ ] Organization settings respected (auto-join, self-signup)
- [ ] Error messages don't expose other orgs' data
