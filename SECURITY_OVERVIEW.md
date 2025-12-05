# Security Overview: Sales Opportunity Tracker

**Document Version:** 1.0
**Last Updated:** December 2024
**Prepared For:** IT Security Review
**Classification:** Internal Use Only

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Overview](#application-overview)
3. [Architecture & Hosting](#architecture--hosting)
   - [Underlying Infrastructure Providers](#underlying-infrastructure-providers)
4. [External Services & Vendors](#external-services--vendors)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Data Classification](#data-classification)
7. [Authentication & Access Control](#authentication--access-control)
8. [Encryption & Data Protection](#encryption--data-protection)
9. [Vendor Security Certifications](#vendor-security-certifications)
10. [SSO/Okta Integration Path](#ssookta-integration-path)
11. [Risk Assessment & Mitigations](#risk-assessment--mitigations)
12. [Compliance Considerations](#compliance-considerations)
13. [Appendix: Environment Variables](#appendix-environment-variables)

---

## Executive Summary

The Sales Opportunity Tracker is a web-based CRM application designed to help sales teams manage opportunities, track customer interactions, and leverage AI-powered insights for deal progression.

### Key Security Highlights

| Area | Implementation |
|------|----------------|
| **Hosting** | Vercel (SOC 2 Type II) |
| **Database** | Supabase PostgreSQL (SOC 2 Type II) |
| **Authentication** | Supabase Auth (SSO/SAML capable) |
| **AI Processing** | Google Gemini (Google Cloud compliance) |
| **Data Isolation** | Multi-tenant with organizationId scoping |
| **Encryption in Transit** | TLS 1.2+ for all connections |
| **Token Storage** | AES-256-GCM encryption at rest |

### SSO Requirement

The application currently uses Supabase Auth with email/password. **Supabase supports SAML 2.0 SSO** on Pro plans and above, enabling Okta integration. See [SSO/Okta Integration Path](#ssookta-integration-path) for implementation details.

---

## Application Overview

### Purpose

A sales pipeline management tool that enables:
- Opportunity tracking through customizable Kanban boards
- Contact and account management
- Meeting note parsing and AI-powered insights
- Calendar integration for scheduling
- Financial research (SEC filings, earnings data)

### Users

- Sales Representatives
- Sales Managers
- Sales Leadership (read-only dashboards)

### Data Processed

- Sales opportunity details (deal size, close dates, stages)
- Customer contact information (names, emails, phone numbers)
- Meeting transcripts and notes
- Calendar events and attendees
- Public financial data (SEC filings, earnings calls)

---

## Architecture & Hosting

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│                    (HTTPS/TLS 1.2+ only)                            │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VERCEL EDGE NETWORK                             │
│                 (CDN, DDoS Protection, WAF)                         │
│                      SOC 2 Type II Certified                        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                               │
│              (Server-Side Rendering, API Routes)                    │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Auth      │  │   API       │  │  Background │                 │
│  │  Middleware │  │  Routes     │  │    Jobs     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │  SUPABASE   │ │   GOOGLE    │ │  INNGEST    │
          │  (Auth+DB)  │ │   (AI+API)  │ │  (Jobs)     │
          │  SOC 2      │ │  SOC 2/ISO  │ │  SOC 2      │
          └─────────────┘ └─────────────┘ └─────────────┘
```

### Hosting Details

| Component | Provider | Region | Compliance |
|-----------|----------|--------|------------|
| Application | Vercel | US (configurable) | SOC 2 Type II |
| Database | Supabase | US East (configurable) | SOC 2 Type II |
| Auth | Supabase | Same as database | SOC 2 Type II |
| Background Jobs | Inngest | US | SOC 2 Type II |

### Underlying Infrastructure Providers

All application services run on major cloud providers that may already be on your approved vendor list:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION STACK                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐ │
│   │  Vercel   │    │ Supabase  │    │  Inngest  │    │  Google   │ │
│   │  (Host)   │    │ (DB/Auth) │    │  (Jobs)   │    │ (AI/APIs) │ │
│   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘ │
│         │                │                │                │        │
├─────────┼────────────────┼────────────────┼────────────────┼────────┤
│         ▼                ▼                ▼                ▼        │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐ │
│   │    AWS    │    │    AWS    │    │    AWS    │    │   GCP     │ │
│   │           │    │  (or GCP) │    │           │    │           │ │
│   └───────────┘    └───────────┘    └───────────┘    └───────────┘ │
│                                                                      │
│              UNDERLYING INFRASTRUCTURE LAYER                         │
└─────────────────────────────────────────────────────────────────────┘
```

| Service | Underlying Provider | Infrastructure Details |
|---------|---------------------|------------------------|
| **Vercel** | AWS | Runs on AWS Lambda, CloudFront, S3. Uses AWS regions for compute and edge network. |
| **Supabase** | AWS (default) | PostgreSQL hosted on AWS EC2/RDS in US-East by default. Also supports GCP and Azure regions. |
| **Inngest** | AWS | Serverless functions running on AWS infrastructure. |
| **Google Gemini** | GCP | Native Google Cloud infrastructure with Google's security controls. |
| **Google Calendar/Tasks** | GCP | Native Google Cloud APIs. |

### Why This Matters

If your organization has **AWS and/or GCP pre-approved**, this application's entire stack runs on those providers:

| If You Have Approved... | Coverage |
|-------------------------|----------|
| **AWS only** | Vercel, Supabase (default region), Inngest ✅ |
| **GCP only** | Google Gemini, Calendar, Tasks ✅ / Supabase can use GCP region ✅ |
| **AWS + GCP** | Full stack covered ✅ |

### Data Residency Options

| Service | Available Regions | How to Configure |
|---------|-------------------|------------------|
| **Vercel** | US, EU, APAC | Project settings → select region |
| **Supabase** | US East, US West, EU (Frankfurt), APAC (Singapore, Sydney), Canada | Project creation or migration |
| **Inngest** | US (default), EU available | Account settings |
| **Google** | Global with regional options | Workspace admin settings |

### No Direct Cloud Access Required

Important: This application uses **managed services only**. You do not need:
- Direct AWS/GCP console access
- IAM roles or service accounts in your cloud environment
- VPC peering or private networking
- Any infrastructure provisioning

All services are fully managed SaaS platforms that abstract away the underlying infrastructure.

---

## External Services & Vendors

### Primary Services (Required)

| Service | Purpose | Data Sent | Data Received |
|---------|---------|-----------|---------------|
| **Supabase** | Authentication, PostgreSQL database | User credentials, all application data | Session tokens, query results |
| **Vercel** | Application hosting, edge network | Application code, environment variables | HTTP responses |
| **Google Gemini AI** | Meeting note parsing, research generation | Meeting transcripts, SEC filing excerpts | AI-generated summaries and insights |
| **Inngest** | Background job processing | Job payloads (IDs, transcripts) | Job status, results |

### Secondary Services (Optional Features)

| Service | Purpose | Data Sent | Data Received |
|---------|---------|-----------|---------------|
| **Google Calendar API** | Calendar sync, event creation | OAuth token, event details | Calendar events, attendees |
| **Google Tasks API** | Task sync | OAuth token, task details | Task lists, items |
| **SEC EDGAR** | Public company filings | Stock ticker, company name | Public SEC filings (10-K, 10-Q) |
| **Finnhub** | Earnings calendar, transcripts | API key, stock ticker | Public earnings data |

### Services NOT Used

- No analytics or tracking services
- No third-party error monitoring (can be added)
- No advertising or marketing services
- No data brokers or data enrichment services

---

## Data Flow Diagrams

### Authentication Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  User  │────▶│ Next.js │────▶│ Supabase │────▶│ Prisma  │
│Browser │     │   App   │     │   Auth   │     │   DB    │
└────────┘     └─────────┘     └──────────┘     └─────────┘
    │               │               │               │
    │  1. Login     │               │               │
    │──────────────▶│               │               │
    │               │ 2. Verify     │               │
    │               │──────────────▶│               │
    │               │               │ 3. Return JWT │
    │               │◀──────────────│               │
    │               │ 4. Sync User  │               │
    │               │───────────────────────────────▶
    │ 5. Set Cookie │               │               │
    │◀──────────────│               │               │
```

### AI Processing Flow (Gemini)

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  User  │────▶│ Next.js │────▶│ Inngest  │────▶│ Gemini  │
│Browser │     │   API   │     │  Queue   │     │   AI    │
└────────┘     └─────────┘     └──────────┘     └─────────┘
    │               │               │               │
    │ 1. Submit     │               │               │
    │   Transcript  │               │               │
    │──────────────▶│               │               │
    │               │ 2. Queue Job  │               │
    │               │──────────────▶│               │
    │ 3. Return     │               │               │
    │   Job ID      │               │               │
    │◀──────────────│               │               │
    │               │               │ 4. Process    │
    │               │               │──────────────▶│
    │               │               │               │
    │               │               │ 5. AI Result  │
    │               │               │◀──────────────│
    │               │ 6. Save to DB │               │
    │               │◀──────────────│               │
```

### Data Sent to Google Gemini

| Data Type | Fields Sent | Purpose | PII Included |
|-----------|-------------|---------|--------------|
| Meeting Transcripts | Full transcript text | Extract action items, pain points, goals | May contain names mentioned in meeting |
| SEC Filings | Business overview, risk factors sections | Summarize for account research | No |
| Earnings Transcripts | Public transcript text | Extract key quotes, guidance | No |

**Note:** User email addresses and contact phone numbers are NOT sent to Gemini.

### Google Calendar Integration Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  User  │────▶│ Next.js │────▶│  Google  │────▶│ Prisma  │
│Browser │     │   API   │     │ Calendar │     │   DB    │
└────────┘     └─────────┘     └──────────┘     └─────────┘
    │               │               │               │
    │ 1. Connect    │               │               │
    │──────────────▶│               │               │
    │               │ 2. OAuth      │               │
    │               │──────────────▶│               │
    │ 3. Consent    │               │               │
    │◀──────────────│               │               │
    │ 4. Approve    │               │               │
    │──────────────▶│               │               │
    │               │ 5. Token      │               │
    │               │◀──────────────│               │
    │               │ 6. Encrypt &  │               │
    │               │    Store      │               │
    │               │───────────────────────────────▶
```

---

## Data Classification

### High Sensitivity (Confidential)

| Data Type | Fields | Storage | Encryption |
|-----------|--------|---------|------------|
| OAuth Tokens | accessToken, refreshToken | PostgreSQL | AES-256-GCM |
| User Credentials | Password hash | Supabase Auth | bcrypt (managed) |
| Meeting Transcripts | transcriptText | PostgreSQL | At rest (Supabase) |

### Medium Sensitivity (Internal)

| Data Type | Fields | Storage | Encryption |
|-----------|--------|---------|------------|
| Contact PII | email, phone, name | PostgreSQL | At rest (Supabase) |
| Financial Data | amountArr (deal values) | PostgreSQL | At rest (Supabase) |
| Calendar Events | attendees, meeting URLs | PostgreSQL | At rest (Supabase) |

### Low Sensitivity (Internal)

| Data Type | Fields | Storage | Encryption |
|-----------|--------|---------|------------|
| Opportunity Metadata | stage, closeDate | PostgreSQL | At rest (Supabase) |
| Account Information | name, industry, website | PostgreSQL | At rest (Supabase) |
| Public Financial Data | SEC filings, earnings | PostgreSQL | At rest (Supabase) |

---

## Authentication & Access Control

### Current Authentication

| Method | Provider | MFA Support | SSO Support |
|--------|----------|-------------|-------------|
| Email/Password | Supabase Auth | Yes (TOTP) | SAML 2.0 (Pro plan) |
| OAuth | Google (optional) | Via Google | N/A |

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full organization access, user management, settings |
| **MANAGER** | View/edit own data + direct reports' data |
| **REP** | View/edit own data only |
| **VIEWER** | Read-only access to assigned data |

### Multi-Tenant Data Isolation

All database queries are scoped by `organizationId`:

```typescript
// Every query includes organization filter
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId, // Always enforced
    // ... other filters
  }
});
```

**Isolation Guarantees:**
- Users cannot access other organizations' data
- API routes verify organizationId on every request
- Database has no cross-organization queries
- Foreign keys enforce referential integrity within organizations

---

## Encryption & Data Protection

### Encryption in Transit

| Connection | Protocol | Certificate |
|------------|----------|-------------|
| Browser ↔ Vercel | TLS 1.2+ | Vercel managed |
| Vercel ↔ Supabase | TLS 1.2+ | Supabase managed |
| Vercel ↔ Google APIs | TLS 1.2+ | Google managed |
| Vercel ↔ Inngest | TLS 1.2+ | Inngest managed |

### Encryption at Rest

| Data | Method | Key Management |
|------|--------|----------------|
| Database (all data) | AES-256 | Supabase managed |
| OAuth Tokens | AES-256-GCM | Application managed (`OAUTH_ENCRYPTION_KEY`) |
| Backups | AES-256 | Supabase managed |

### OAuth Token Encryption Details

```
Algorithm: AES-256-GCM
IV: Random 16 bytes per encryption
Auth Tag: 16 bytes for authenticated encryption
Format: iv:authTag:encryptedData (hex encoded)
Key: 32-character hex string (256 bits)
```

### Secrets Management

| Secret Type | Storage | Access |
|-------------|---------|--------|
| API Keys | Vercel Environment Variables | Server-side only |
| Database URL | Vercel Environment Variables | Server-side only |
| OAuth Secrets | Vercel Environment Variables | Server-side only |
| Encryption Key | Vercel Environment Variables | Server-side only |

---

## Vendor Security Certifications

### Supabase (Database & Authentication)

| Certification | Status | Documentation |
|---------------|--------|---------------|
| SOC 2 Type II | ✅ Certified | [supabase.com/security](https://supabase.com/security) |
| HIPAA | ✅ Available (Enterprise) | On request |
| GDPR | ✅ Compliant | DPA available |
| Data Residency | ✅ Configurable | US, EU, APAC regions |

**Key Security Features:**
- Row Level Security (RLS) policies
- SSL/TLS encryption in transit
- AES-256 encryption at rest
- Automated backups with point-in-time recovery
- Network isolation and firewall rules

### Vercel (Application Hosting)

| Certification | Status | Documentation |
|---------------|--------|---------------|
| SOC 2 Type II | ✅ Certified | [vercel.com/security](https://vercel.com/security) |
| GDPR | ✅ Compliant | DPA available |
| Data Residency | ✅ Configurable | Multiple regions |

**Key Security Features:**
- DDoS protection
- Web Application Firewall (WAF)
- Automatic HTTPS
- Edge network encryption
- Environment variable encryption

### Google Cloud / Gemini AI

| Certification | Status | Documentation |
|---------------|--------|---------------|
| SOC 1/2/3 | ✅ Certified | [cloud.google.com/security/compliance](https://cloud.google.com/security/compliance) |
| ISO 27001 | ✅ Certified | On request |
| ISO 27017 | ✅ Certified | On request |
| ISO 27018 | ✅ Certified | On request |
| FedRAMP | ✅ High | On request |
| HIPAA | ✅ BAA Available | On request |

**Gemini API Data Usage Policy:**
- Data sent to Gemini API is NOT used to train models (API terms)
- Data is processed and discarded after response generation
- No data retention for API calls
- Enterprise terms available for additional guarantees

**Reference:** [Google AI Terms of Service](https://ai.google.dev/terms)

### Inngest (Background Jobs)

| Certification | Status | Documentation |
|---------------|--------|---------------|
| SOC 2 Type II | ✅ Certified | [inngest.com/security](https://www.inngest.com/security) |
| GDPR | ✅ Compliant | DPA available |

**Key Security Features:**
- End-to-end encryption
- Signed webhooks for job verification
- Automatic retry with backoff
- Job payload encryption in transit

### SEC EDGAR (Public Data)

- US Government service
- Public data only (no authentication required)
- No PII transmitted
- HTTPS only

### Finnhub (Financial Data)

| Certification | Status |
|---------------|--------|
| SOC 2 | ✅ Certified |
| GDPR | ✅ Compliant |

- API key authentication
- Rate limiting enforced
- Public financial data only

---

## SSO/Okta Integration Path

### Current State

- Supabase Auth with email/password
- Session management via HTTP-only cookies
- Role-based access control implemented

### Integration Requirements

| Requirement | Supabase Support | Notes |
|-------------|------------------|-------|
| SAML 2.0 | ✅ Pro plan+ | Native support |
| Okta IdP | ✅ Supported | Standard SAML config |
| JIT Provisioning | ✅ Supported | Auto-create users on first login |
| SCIM | ❌ Not native | Requires custom implementation |
| Domain Enforcement | ✅ Supported | Force SSO for specific domains |

### Implementation Steps

1. **Upgrade Supabase Plan** (if not already Pro+)
2. **Configure SAML in Supabase Dashboard**
   - Add Okta metadata URL
   - Configure attribute mappings (email, name)
   - Set up redirect URLs
3. **Configure Okta Application**
   - Create SAML 2.0 application
   - Configure ACS URL and Entity ID
   - Map user attributes
4. **Update Application Auth Flow**
   - Add SSO login button
   - Implement domain-based SSO enforcement
   - Handle SAML response and user sync
5. **Testing**
   - Test with Okta sandbox environment
   - Verify user provisioning
   - Test role assignment

### Estimated Effort

- Configuration: 2-4 hours
- Testing: 2-4 hours
- Documentation: 1-2 hours

### Required Information from IT

- Okta tenant URL
- SAML metadata URL or XML
- Attribute mapping requirements
- User provisioning preferences (JIT vs. pre-provisioned)
- Domain(s) to enforce SSO

---

## Risk Assessment & Mitigations

### Identified Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Cross-tenant data exposure | High | Low | organizationId scoping on all queries, API validation |
| OAuth token compromise | High | Low | AES-256-GCM encryption, token rotation |
| Meeting transcript exposure | Medium | Low | Database encryption at rest, access controls |
| API key exposure | High | Low | Environment variables, server-side only access |
| Unauthorized data access | Medium | Low | RBAC, session validation, audit logging |

### Security Controls in Place

| Control | Implementation |
|---------|----------------|
| Input Validation | Zod schemas on all API inputs |
| SQL Injection Prevention | Prisma ORM (parameterized queries) |
| XSS Prevention | React's automatic escaping, CSP headers |
| CSRF Protection | SameSite cookies, origin validation |
| Rate Limiting | Vercel Edge, API-level limits |
| Error Handling | Generic error messages, no stack traces in production |

### Recommended Enhancements

| Enhancement | Priority | Effort | Description |
|-------------|----------|--------|-------------|
| Audit Logging | High | Medium | Log all data access and modifications |
| Field-Level Encryption | Medium | High | Encrypt PII fields (emails, phone numbers) |
| Data Retention Policy | Medium | Low | Automated cleanup of old data |
| Penetration Testing | High | External | Third-party security assessment |
| SIEM Integration | Low | Medium | Forward logs to security monitoring |

---

## Compliance Considerations

### GDPR Applicability

| Requirement | Status | Notes |
|-------------|--------|-------|
| Lawful Basis | ✅ | Legitimate business interest, consent |
| Data Minimization | ✅ | Only necessary data collected |
| Right to Access | ⚠️ | Manual process (can be automated) |
| Right to Deletion | ⚠️ | Manual process (can be automated) |
| Data Portability | ⚠️ | Export functionality needed |
| DPA with Processors | ✅ | Available from Supabase, Vercel, Google |

### SOX Considerations

| Requirement | Status | Notes |
|-------------|--------|-------|
| Access Controls | ✅ | RBAC implemented |
| Audit Trail | ⚠️ | Timestamps present, full audit log recommended |
| Change Management | ✅ | Git version control, PR reviews |
| Data Integrity | ✅ | Referential integrity, validation |

### Internal Policy Alignment

| Policy Area | Application Alignment |
|-------------|----------------------|
| Data Classification | Supports Confidential, Internal, Public |
| Access Control | Role-based with manager hierarchy |
| Encryption | TLS in transit, AES-256 at rest |
| Vendor Management | All vendors SOC 2 certified |
| Incident Response | Logging enabled, alerts configurable |

---

## Appendix: Environment Variables

### Required Variables

| Variable | Purpose | Sensitivity |
|----------|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection | Secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Limited |
| `GOOGLE_AI_API_KEY` | Gemini AI access | Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth | Secret |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Internal |
| `OAUTH_ENCRYPTION_KEY` | Token encryption key | Secret |
| `INNGEST_EVENT_KEY` | Background job events | Secret |
| `INNGEST_SIGNING_KEY` | Job signature verification | Secret |

### Optional Variables

| Variable | Purpose | Sensitivity |
|----------|---------|-------------|
| `FINNHUB_API_KEY` | Earnings data API | Secret |
| `API_NINJAS_KEY` | Earnings transcripts | Secret |
| `SEC_USER_AGENT` | SEC EDGAR requests | Public |
| `NEXT_PUBLIC_APP_URL` | Application domain | Public |

### Variable Security

- All secret variables stored in Vercel encrypted environment
- No secrets in source code or version control
- Secrets rotatable without code deployment
- Server-side only access (no `NEXT_PUBLIC_` prefix for secrets)

---

## Document Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Application Owner | | | |
| IT Security | | | |
| Data Privacy | | | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | | Initial document |

---

## Contact Information

For questions about this security overview:

- **Application Owner:** [Your Name]
- **Email:** [Your Email]
- **Repository:** [Internal Git URL]
