# Organization Structure Migration Status

## ✅ Phase 1: Database Schema & Migration - COMPLETE

### What Was Accomplished

#### 1. Database Schema Updates
- ✅ Created `Organization` model with fiscal year settings
- ✅ Created `OrganizationSettings` model for org-wide configuration
- ✅ Created `Invitation` model for user invitations
- ✅ Created `UserRole` enum (ADMIN, MANAGER, REP, VIEWER)
- ✅ Created `ViewType` enum for Kanban views
- ✅ Updated `User` model with `role`, `organizationId`, `managerId`
- ✅ Updated `Opportunity` model with `organizationId`
- ✅ Updated `Account` model with `organizationId` and `ownerId`
- ✅ Created `KanbanView` model (view-based Kanban system)
- ✅ Updated `KanbanColumn` to use `viewId` instead of `userId`

#### 2. Data Migration
- ✅ Created organization for each existing user
- ✅ Migrated user settings to organization settings
- ✅ Assigned all opportunities to organizations
- ✅ Assigned all accounts to organizations
- ✅ Set all existing users as ADMIN of their organizations
- ✅ Converted user-based Kanban columns to view-based system

#### 3. Database State
All migrations applied successfully:
- Organization tables: `Organization`, `OrganizationSettings`, `Invitation`, `KanbanView`
- User fields: `organizationId`, `role`, `managerId`
- Opportunity fields: `organizationId`
- Account fields: `organizationId`, `ownerId`
- KanbanColumn fields: `viewId` (removed `userId`)
- All enums: `UserRole`, `ViewType`
- All foreign keys and unique constraints in place

### Migration Scripts Created
1. `/prisma/migrations/20251106154711_add_organization_structure/migration.sql` - Full migration SQL
2. `/scripts/check-database-state.mjs` - Database state verification
3. `/scripts/complete-migration.mjs` - Smart migration completion (handles partially-applied state)
4. `/scripts/fix-kanban-columns.mjs` - Kanban column constraint fixer
5. `/scripts/reset-migration-status.mjs` - Migration status management
6. `/scripts/execute-migration.mjs` - General-purpose migration executor

---

## 🚧 Phase 2: API Layer & Permissions - IN PROGRESS

### Next Steps (Remaining Work)

#### 1. Permission System (`src/lib/permissions.ts`)
Create utility functions for:
- `canViewOpportunity(user, opportunity)` - Check if user can view an opportunity
- `canEditOpportunity(user, opportunity)` - Check if user can edit
- `canDeleteOpportunity(user, opportunity)` - Check if user can delete
- `canManageUsers(user)` - Check if user is ADMIN
- `canInviteUsers(user)` - Check if user is ADMIN or MANAGER
- `getVisibleUserIds(user)` - Get IDs of users whose data this user can see
  - REP: own ID only
  - MANAGER: own ID + direct reports
  - ADMIN: all org users

#### 2. Organization Utilities (`src/lib/organization.ts`)
- `getOrganizationById(id)` - Fetch organization
- `getOrganizationByDomain(domain)` - For domain-based auto-join
- `getUsersInOrganization(orgId)` - List all users
- `getOrganizationSettings(orgId)` - Get settings

#### 3. Auth Helpers (`src/lib/auth.ts`)
Update `getCurrentUser()` to include:
- `role` field
- `organizationId` field
- `organization` relation

#### 4. Type Definitions
- `src/types/organization.ts` - Organization, OrganizationSettings types
- `src/types/invitation.ts` - Invitation types
- `src/types/permissions.ts` - Permission function types

#### 5. Zod Validation Schemas
- `src/lib/validations/user.ts` - User update/invite schemas
- `src/lib/validations/invitation.ts` - Invitation schemas
- `src/lib/validations/organization.ts` - Organization settings schemas

#### 6. API Route Updates
Update existing routes with organization scoping:
- `/api/v1/opportunities/*` - Filter by visible users
- `/api/v1/accounts/*` - Filter by organization
- `/api/v1/columns/*` - Include org-wide columns

Create new routes:
- `/api/v1/users` - List users, update roles
- `/api/v1/invitations` - Send/accept invitations
- `/api/v1/organization` - Get/update org settings

---

## 🔜 Phase 3: Frontend Updates

### User Management UI
- User list table component
- Invite user dialog
- Role assignment dropdown
- Manager assignment selector

### Auth Flow Updates
- Signup: Handle invitation tokens
- Signup: Domain-based auto-join
- Signup: Create new organization for first user
- Login: No changes needed

### Opportunity Page Updates
- Add "Owner" filter dropdown
- Add "View" toggle: My / Team / All
- Display owner on opportunity cards
- Allow reassignment (managers/admins only)

### Dashboard Updates
- Team metrics for managers/admins
- Leaderboard component
- Activity feed

---

## 📊 Current Database Schema

### Key Models
```prisma
model Organization {
  id                   String
  name                 String
  domain               String? @unique  // For auto-join
  fiscalYearStartMonth Int @default(1)
  users                User[]
  opportunities        Opportunity[]
  accounts             Account[]
}

model User {
  id             String
  email          String @unique
  role           UserRole @default(REP)
  organizationId String
  managerId      String?
  organization   Organization
  manager        User?
  directReports  User[]
}

enum UserRole {
  ADMIN
  MANAGER
  REP
  VIEWER
}
```

### Visibility Rules
| Role | Can See |
|------|---------|
| **ADMIN** | All opportunities in organization |
| **MANAGER** | Own opportunities + direct reports' opportunities |
| **REP** | Own opportunities only |
| **VIEWER** | Read-only access to own opportunities |

### Permission Matrix
| Action | ADMIN | MANAGER | REP | VIEWER |
|--------|-------|---------|-----|--------|
| View own opps | ✅ | ✅ | ✅ | ✅ |
| Edit own opps | ✅ | ✅ | ✅ | ❌ |
| View team opps | ✅ | ✅ | ❌ | ❌ |
| Edit team opps | ✅ | ✅ | ❌ | ❌ |
| Reassign opps | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Invite users | ✅ | ✅ | ❌ | ❌ |
| Org settings | ✅ | ❌ | ❌ | ❌ |

---

## 🎯 Implementation Priority

### Week 1 (Current - In Progress)
1. ✅ Database schema & migration
2. ✅ Prisma client generation
3. 🔄 Permission system utilities
4. 🔄 Organization utilities
5. 🔄 Update auth helpers

### Week 2
6. Create type definitions
7. Create Zod validation schemas
8. Update API routes with org scoping
9. Create new API routes (users, invitations, org)

### Week 3
10. Build user management UI
11. Update signup/login flow
12. Add owner filters to opportunities page
13. Update opportunity cards to show owner

### Week 4
14. Build team dashboard
15. Add opportunity reassignment
16. Build leaderboard component
17. Testing & bug fixes

---

## 📝 Notes

### Migration Learnings
- Database was partially migrated before, required smart completion script
- Kanban system was already upgraded to view-based (good!)
- All existing users are now ADMIN of their own organizations
- Account names are now scoped to organization (not globally unique)

### Next Session Focus
Start with the permission system and update auth helpers to include organization/role in session. This will unblock all API route updates.

