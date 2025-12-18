/**
 * Re-match unlinked calendar events to accounts/opportunities
 *
 * This script finds all calendar events that don't have an opportunityId or accountId
 * and attempts to match them using:
 * 1. Contact email matching (attendee email → contact → opportunity)
 * 2. Domain matching (attendee email domain → account website domain → opportunity)
 *
 * Run with: node scripts/rematch-calendar-events.js
 * Dry run:  node scripts/rematch-calendar-events.js --dry-run
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Extract base domain from a full domain (removes subdomains)
 * e.g., "usa.twinhealth.com" → "twinhealth.com"
 */
function extractBaseDomain(domain) {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join('.');
}

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain || null;
}

/**
 * Build lookup maps for matching
 */
async function buildMatchingMaps(organizationId) {
  // Fetch all accounts with websites
  const allAccounts = await prisma.account.findMany({
    where: {
      organizationId,
      website: { not: null },
    },
    select: {
      id: true,
      name: true,
      website: true,
      opportunities: {
        select: {
          id: true,
          name: true,
          domain: true,
        },
      },
    },
  });

  // Fetch all opportunities with domains (for direct matching)
  const opportunitiesWithDomains = await prisma.opportunity.findMany({
    where: {
      organizationId,
      domain: { not: null },
    },
    select: {
      id: true,
      name: true,
      domain: true,
      accountId: true,
    },
  });

  // Fetch all contacts with emails
  const allContacts = await prisma.contact.findMany({
    where: {
      opportunity: { organizationId },
      email: { not: null },
    },
    select: {
      email: true,
      opportunityId: true,
      accountId: true,
    },
  });

  // Build lookup maps
  const emailToOpportunityMap = new Map();
  const emailToAccountMap = new Map();
  const domainToAccountsMap = new Map();
  const domainToOpportunityMap = new Map();

  // Map contact emails
  for (const contact of allContacts) {
    if (contact.email) {
      const email = contact.email.toLowerCase();
      if (contact.opportunityId) {
        emailToOpportunityMap.set(email, contact.opportunityId);
      }
      if (contact.accountId) {
        emailToAccountMap.set(email, contact.accountId);
      }
    }
  }

  // Map opportunity domains directly (highest priority)
  for (const opp of opportunitiesWithDomains) {
    if (opp.domain) {
      const normalizedDomain = opp.domain.toLowerCase().replace(/^www\./, '');
      if (!domainToOpportunityMap.has(normalizedDomain)) {
        domainToOpportunityMap.set(normalizedDomain, {
          id: opp.id,
          name: opp.name,
          accountId: opp.accountId,
        });
      }
    }
  }

  // Map account domains
  for (const account of allAccounts) {
    if (account.website) {
      try {
        const url = new URL(account.website.startsWith('http') ? account.website : `https://${account.website}`);
        const fullDomain = url.hostname.replace(/^www\./, '').toLowerCase();
        const baseDomain = extractBaseDomain(fullDomain);

        // Add to full domain map
        if (!domainToAccountsMap.has(fullDomain)) {
          domainToAccountsMap.set(fullDomain, []);
        }
        domainToAccountsMap.get(fullDomain).push(account);

        // Also add to base domain map if different
        if (baseDomain !== fullDomain) {
          if (!domainToAccountsMap.has(baseDomain)) {
            domainToAccountsMap.set(baseDomain, []);
          }
          const existingAccounts = domainToAccountsMap.get(baseDomain);
          if (!existingAccounts.some(a => a.id === account.id)) {
            existingAccounts.push(account);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return { emailToOpportunityMap, emailToAccountMap, domainToAccountsMap, domainToOpportunityMap };
}

/**
 * Match a calendar event to opportunity/account
 */
async function matchEvent(event, maps) {
  const { emailToOpportunityMap, emailToAccountMap, domainToAccountsMap, domainToOpportunityMap } = maps;

  let matchedOpportunityId = null;
  let matchedAccountId = null;
  let matchedBy = null;

  const attendees = event.attendees || [];

  // Strategy 1: Match by contact email
  for (const attendeeEmail of attendees) {
    const email = attendeeEmail.toLowerCase();

    if (emailToOpportunityMap.has(email)) {
      matchedOpportunityId = emailToOpportunityMap.get(email);

      // Get the account from the opportunity
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: matchedOpportunityId },
        select: { accountId: true },
      });
      if (opportunity?.accountId) {
        matchedAccountId = opportunity.accountId;
      }

      matchedBy = 'contact';
      break;
    }

    if (!matchedAccountId && emailToAccountMap.has(email)) {
      matchedAccountId = emailToAccountMap.get(email);
      matchedBy = 'contact';
    }
  }

  // Strategy 2: Match by opportunity domain (direct match - highest priority for domains)
  if (!matchedOpportunityId) {
    for (const attendeeEmail of attendees) {
      const domain = extractDomainFromEmail(attendeeEmail);
      if (!domain) continue;

      const baseDomain = extractBaseDomain(domain);
      const domainsToTry = [domain];
      if (baseDomain !== domain) {
        domainsToTry.push(baseDomain);
      }

      for (const domainToMatch of domainsToTry) {
        if (domainToOpportunityMap.has(domainToMatch)) {
          const opp = domainToOpportunityMap.get(domainToMatch);
          matchedOpportunityId = opp.id;
          if (opp.accountId) {
            matchedAccountId = opp.accountId;
          }
          matchedBy = 'opportunity_domain';
          break;
        }
      }

      if (matchedOpportunityId) break;
    }
  }

  // Strategy 3: Match by account domain
  if (!matchedOpportunityId && !matchedAccountId) {
    for (const attendeeEmail of attendees) {
      const domain = extractDomainFromEmail(attendeeEmail);
      if (!domain) continue;

      const baseDomain = extractBaseDomain(domain);
      const domainsToTry = [domain];
      if (baseDomain !== domain) {
        domainsToTry.push(baseDomain);
      }

      let matchedAccounts = null;

      for (const domainToMatch of domainsToTry) {
        if (domainToAccountsMap.has(domainToMatch)) {
          matchedAccounts = domainToAccountsMap.get(domainToMatch);
          break;
        }
      }

      if (matchedAccounts) {
        // Prioritize accounts with opportunities
        const accountsWithOpps = matchedAccounts.filter(a => a.opportunities.length > 0);
        const accountToUse = accountsWithOpps.length > 0 ? accountsWithOpps[0] : matchedAccounts[0];

        matchedAccountId = accountToUse.id;

        // If exactly one opportunity, link to it
        if (accountToUse.opportunities.length === 1) {
          matchedOpportunityId = accountToUse.opportunities[0].id;
        }
        // If multiple, try to match by meeting title
        else if (accountToUse.opportunities.length > 1) {
          const meetingTitle = (event.summary || '').toLowerCase();
          const matchedOpp = accountToUse.opportunities.find(opp =>
            meetingTitle.includes(opp.name.toLowerCase()) ||
            opp.name.toLowerCase().includes(meetingTitle)
          );
          if (matchedOpp) {
            matchedOpportunityId = matchedOpp.id;
          }
        }

        matchedBy = 'domain';
        break;
      }
    }
  }

  return { opportunityId: matchedOpportunityId, accountId: matchedAccountId, matchedBy };
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===');
  console.log('');

  // Get all organizations
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true }
  });

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const org of organizations) {
    console.log(`\nProcessing organization: ${org.name}`);

    // Build matching maps for this org
    const maps = await buildMatchingMaps(org.id);

    console.log(`  - ${maps.domainToOpportunityMap.size} opportunity domains mapped`);
    console.log(`  - ${maps.domainToAccountsMap.size} account domains mapped`);
    console.log(`  - ${maps.emailToOpportunityMap.size} contact emails mapped`);

    // Find unlinked calendar events for this org's users
    const unlinkedEvents = await prisma.calendarEvent.findMany({
      where: {
        user: { organizationId: org.id },
        opportunityId: null,
        attendees: { isEmpty: false }, // Only events with attendees can be matched
      },
      select: {
        id: true,
        summary: true,
        startTime: true,
        attendees: true,
        accountId: true,
      },
    });

    console.log(`  - ${unlinkedEvents.length} unlinked events with attendees`);

    let orgUpdated = 0;
    const matches = [];

    for (const event of unlinkedEvents) {
      const match = await matchEvent(event, maps);

      if (match.opportunityId || match.accountId) {
        matches.push({
          event,
          ...match,
        });

        if (!DRY_RUN) {
          await prisma.calendarEvent.update({
            where: { id: event.id },
            data: {
              opportunityId: match.opportunityId,
              accountId: match.accountId || event.accountId,
            },
          });
        }

        orgUpdated++;
      }
    }

    if (matches.length > 0) {
      console.log(`\n  Matches found:`);
      for (const m of matches.slice(0, 10)) { // Show first 10
        const oppName = m.opportunityId
          ? (await prisma.opportunity.findUnique({ where: { id: m.opportunityId }, select: { name: true } }))?.name
          : null;
        console.log(`    ${m.event.startTime.toISOString().split('T')[0]} - ${m.event.summary?.substring(0, 40)}`);
        console.log(`      → Opp: ${oppName || 'none'} (matched by ${m.matchedBy})`);
      }
      if (matches.length > 10) {
        console.log(`    ... and ${matches.length - 10} more`);
      }
    }

    totalUpdated += orgUpdated;
    totalSkipped += unlinkedEvents.length - orgUpdated;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Events matched: ${totalUpdated}`);
  console.log(`Events not matchable: ${totalSkipped}`);

  if (DRY_RUN) {
    console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
