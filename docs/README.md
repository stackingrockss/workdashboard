# Documentation Structure

This folder contains **user-facing and setup documentation** that remains relevant over time.

## Documentation Guidelines

### What Goes Here (`docs/`)

| Type | Description | Example |
|------|-------------|---------|
| **Setup Guides** | How to configure external services | `GOOGLE_AUTH_SETUP.md` |
| **Quick Start** | Checklists for common setup tasks | `QUICK_START_CHECKLIST.md` |
| **Integration Guides** | How to connect third-party services | OAuth setup, API keys |
| **Runbooks** | Operational procedures | Deployment, troubleshooting |

### What Does NOT Go Here

| Type | Where It Goes | Reason |
|------|---------------|--------|
| Feature specs/designs | `.claude/plans/` (temporary) | Delete after implementation |
| Bug fix documentation | Git commit messages | Historical, not ongoing reference |
| Architecture docs | `.claude/ARCHITECTURE.md` | Claude-specific context |
| API documentation | `.claude/API.md` | Claude-specific context |
| Code conventions | `.claude/CLAUDE.md` | Claude-specific context |

### Naming Conventions

- Use `SCREAMING_SNAKE_CASE.md` for important docs (e.g., `GOOGLE_AUTH_SETUP.md`)
- Use `kebab-case.md` for guides (e.g., `deployment-guide.md`)
- Prefix with category if needed (e.g., `setup-`, `guide-`, `runbook-`)

### Keeping Docs Current

1. **Review quarterly**: Check if docs reference outdated paths, features, or processes
2. **Delete after implementation**: Feature specs should be removed once shipped
3. **Update on breaking changes**: If a feature changes significantly, update related docs
4. **Archive, don't hoard**: If a doc hasn't been referenced in 6 months, consider deleting

---

## Current Documentation

### Setup & Configuration
- [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md) - Complete Google OAuth setup guide
- [QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md) - Quick setup checklist for auth
- [AUTH_IMPLEMENTATION_SUMMARY.md](./AUTH_IMPLEMENTATION_SUMMARY.md) - Auth architecture overview

---

## Related Documentation

### Claude-Specific (`.claude/`)
These docs provide context for AI assistants and are imported into CLAUDE.md:

- `.claude/CLAUDE.md` - Main instructions and conventions
- `.claude/ARCHITECTURE.md` - Codebase architecture
- `.claude/API.md` - API endpoint documentation
- `.claude/INTEGRATIONS.md` - External service integrations
- `.claude/MULTI_TENANCY.md` - Multi-tenant architecture
- `.claude/DATA_MODEL.md` - Database schema reference

### Temporary Plans (`.claude/plans/`)
Feature implementation plans live here temporarily during development.
**Delete plans after the feature is shipped.**

### Agent Configurations (`.claude/agents/`)
Specialized agent configurations for different task types.
