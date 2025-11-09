# Database Migration Scripts

This directory contains database migration and maintenance scripts.

## Fix Opportunity Organizations

**Script:** `fix-opportunity-organizations.ts`

**Purpose:** Fixes opportunities that have missing or incorrect `organizationId` values by setting them to match their owner's `organizationId`.

### When to use this script

Use this script if you encounter 404 errors when trying to update opportunities, especially after organization-level scoping was added to the application.

### How to run

#### Local/Development Database

```bash
# Dry run (preview changes without applying them)
npm run migrate:fix-orgs:dry-run

# Apply changes
npm run migrate:fix-orgs
```

#### Production Database

**⚠️ IMPORTANT:** Always run a dry run first to preview changes!

```bash
# 1. Set the production DATABASE_URL environment variable
export DATABASE_URL="your-production-database-url"

# 2. Run dry run to preview changes
npm run migrate:fix-orgs:dry-run

# 3. If everything looks good, apply the changes
npm run migrate:fix-orgs
```

**Using Vercel CLI:**

```bash
# 1. Pull environment variables
vercel env pull .env.production

# 2. Load the production DATABASE_URL
export $(grep DATABASE_URL .env.production | xargs)

# 3. Run dry run
npm run migrate:fix-orgs:dry-run

# 4. Apply changes
npm run migrate:fix-orgs
```

### What it does

1. Scans all opportunities in the database
2. For each opportunity:
   - Checks if the opportunity has a valid owner
   - Checks if the owner has an organizationId
   - Compares the opportunity's organizationId with the owner's organizationId
   - Updates the opportunity's organizationId if they don't match
3. Reports:
   - Total opportunities scanned
   - Number of opportunities fixed
   - Number of opportunities skipped (already correct)
   - Any errors encountered

### Output example

```
🔍 Scanning opportunities for organization issues...

📊 Found 15 opportunities

🔧 [opp-003] "Enterprise Deal" - Updating organizationId from null to org-abc123 (owner: user@example.com)
🔧 [opp-007] "Mid-Market Deal" - Updating organizationId from org-old456 to org-abc123 (owner: user@example.com)

============================================================
📈 Migration Summary
============================================================
Total opportunities:     15
Fixed:                   2
Skipped (already OK):    13
Errors:                  0

✅ Migration completed successfully!
```

### Troubleshooting

**Error: "Owner not found"**
- The opportunity's `ownerId` doesn't match any user in the database
- Manual intervention required to either fix the ownerId or delete the orphaned opportunity

**Error: "Owner has no organization"**
- The opportunity's owner doesn't have an `organizationId` set
- Fix the user's organization assignment first, then re-run the script

### Safety features

- **Dry run mode:** Preview all changes before applying them
- **Error handling:** Each opportunity is processed individually; errors don't stop the entire migration
- **Detailed logging:** All changes are logged with opportunity ID, name, and owner email
- **Statistics:** Summary report shows exactly what was changed
