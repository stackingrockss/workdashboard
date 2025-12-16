/**
 * Check NHPRI opportunity and its activity linking
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Search for NHPRI opportunity
  const opps = await prisma.opportunity.findMany({
    where: {
      OR: [
        { name: { contains: 'NHPRI', mode: 'insensitive' } },
        { name: { contains: 'Neighborhood', mode: 'insensitive' } },
      ]
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          website: true,
        }
      },
      contacts: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    }
  });

  console.log('Found opportunities:');
  for (const opp of opps) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Opportunity: ${opp.name}`);
    console.log(`ID: ${opp.id}`);
    console.log(`Account: ${opp.account?.name || 'None'}`);
    console.log(`Account ID: ${opp.accountId || 'None'}`);
    console.log(`Account Website: ${opp.account?.website || 'None'}`);

    // Show contacts
    console.log(`\n--- Contacts (${opp.contacts.length}) ---`);
    for (const c of opp.contacts) {
      console.log(`  - ${c.firstName} ${c.lastName}: ${c.email || 'No email'}`);
    }

    // Check activity linked to this opportunity
    console.log('\n--- Activity Count ---');

    const calendarEvents = await prisma.calendarEvent.count({
      where: { opportunityId: opp.id }
    });
    console.log(`Calendar events linked: ${calendarEvents}`);

    const gongCalls = await prisma.gongCall.count({
      where: { opportunityId: opp.id }
    });
    console.log(`Gong calls linked: ${gongCalls}`);

    const granolaNotes = await prisma.granolaNote.count({
      where: { opportunityId: opp.id }
    });
    console.log(`Granola notes linked: ${granolaNotes}`);

    // Show the actual linked calendar events
    const linkedEvents = await prisma.calendarEvent.findMany({
      where: { opportunityId: opp.id },
      select: {
        id: true,
        summary: true,
        startTime: true,
        attendees: true,
        isExternal: true,
      },
      orderBy: { startTime: 'desc' },
    });
    console.log(`\n--- Linked Calendar Events ---`);
    for (const e of linkedEvents) {
      console.log(`  - ${e.summary}`);
      console.log(`    Date: ${e.startTime}`);
      console.log(`    External: ${e.isExternal}`);
      console.log(`    Attendees: ${e.attendees.join(', ')}`);
    }

    // Check domain from account website
    let accountDomain: string | null = null;
    if (opp.account?.website) {
      try {
        const url = new URL(opp.account.website.startsWith('http') ? opp.account.website : `https://${opp.account.website}`);
        accountDomain = url.hostname.replace(/^www\./, '').toLowerCase();
        console.log(`\n--- Domain Analysis ---`);
        console.log(`Parsed domain from website: ${accountDomain}`);

        // Check for calendar events with this domain in attendees
        const eventsWithDomain = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM opportunity_tracker."CalendarEvent"
          WHERE EXISTS (
            SELECT 1 FROM unnest(attendees) AS email
            WHERE lower(email) LIKE ${'%@' + accountDomain}
          )
        `;
        console.log(`Calendar events with @${accountDomain} attendees: ${eventsWithDomain[0]?.count || 0}`);

        // Show sample events with this domain
        const sampleEvents = await prisma.$queryRaw<{ id: string; summary: string; startTime: Date; opportunityId: string | null; attendees: string[] }[]>`
          SELECT id, summary, "startTime", "opportunityId", attendees
          FROM opportunity_tracker."CalendarEvent"
          WHERE EXISTS (
            SELECT 1 FROM unnest(attendees) AS email
            WHERE lower(email) LIKE ${'%@' + accountDomain}
          )
          ORDER BY "startTime" DESC
          LIMIT 5
        `;

        if (sampleEvents.length > 0) {
          console.log(`\nSample events with @${accountDomain} attendees:`);
          for (const e of sampleEvents) {
            const matchingAttendees = e.attendees.filter(a => a.toLowerCase().includes(accountDomain!));
            console.log(`  - ${e.summary}`);
            console.log(`    Date: ${e.startTime}`);
            console.log(`    Linked to opp: ${e.opportunityId || 'None'}`);
            console.log(`    Matching attendees: ${matchingAttendees.join(', ')}`);
          }
        }

        // Show ALL unlinked events with this domain
        const allUnlinkedEvents = await prisma.$queryRaw<{ id: string; summary: string; startTime: Date; opportunityId: string | null; attendees: string[] }[]>`
          SELECT id, summary, "startTime", "opportunityId", attendees
          FROM opportunity_tracker."CalendarEvent"
          WHERE EXISTS (
            SELECT 1 FROM unnest(attendees) AS email
            WHERE lower(email) LIKE ${'%@' + accountDomain}
          )
          AND ("opportunityId" IS NULL OR "opportunityId" != ${opp.id})
          ORDER BY "startTime" DESC
        `;

        if (allUnlinkedEvents.length > 0) {
          console.log(`\n*** UNLINKED EVENTS with @${accountDomain} (${allUnlinkedEvents.length} total) ***`);
          for (const e of allUnlinkedEvents) {
            const matchingAttendees = e.attendees.filter(a => a.toLowerCase().includes(accountDomain!));
            console.log(`  - ${e.summary}`);
            console.log(`    Date: ${e.startTime}`);
            console.log(`    Currently linked to: ${e.opportunityId || 'None'}`);
            console.log(`    NHPRI attendees: ${matchingAttendees.join(', ')}`);
          }
        } else {
          console.log(`\n✅ No unlinked events with @${accountDomain} - all are linked!`);
        }
      } catch (err) {
        console.log(`\n--- Domain Analysis ---`);
        console.log(`Could not parse domain from website: ${opp.account.website}`);
      }
    } else {
      console.log(`\n--- Domain Analysis ---`);
      console.log(`No account website set - cannot match by domain!`);
    }

    // Check contact email matching
    const contactEmails = opp.contacts.filter(c => c.email).map(c => c.email!.toLowerCase());
    if (contactEmails.length > 0) {
      console.log(`\n--- Contact Email Matching ---`);
      console.log(`Contact emails: ${contactEmails.join(', ')}`);

      for (const email of contactEmails) {
        const eventsWithEmail = await prisma.calendarEvent.count({
          where: {
            attendees: { has: email }
          }
        });
        console.log(`Events with ${email}: ${eventsWithEmail}`);
      }
    } else {
      console.log(`\n--- Contact Email Matching ---`);
      console.log(`No contact emails - cannot match by contact!`);
    }
  }

  // If no opportunities found, list available ones
  if (opps.length === 0) {
    console.log('No NHPRI opportunities found. Available opportunities:');
    const allOpps = await prisma.opportunity.findMany({
      select: { id: true, name: true, accountId: true },
      take: 20,
    });
    allOpps.forEach(opp => console.log(`  - ${opp.id}: ${opp.name} (account: ${opp.accountId || 'None'})`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
