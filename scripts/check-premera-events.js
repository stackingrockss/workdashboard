require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find Premera opportunity with account info
  const opp = await prisma.opportunity.findFirst({
    where: { name: { contains: 'premera', mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      accountId: true,
      account: {
        select: {
          id: true,
          name: true,
          website: true
        }
      }
    }
  });

  if (!opp) {
    console.log('No Premera opportunity found');
    return;
  }

  console.log('=== Opportunity Details ===');
  console.log('Opportunity:', opp.name, '(ID:', opp.id, ')');
  console.log('Account:', opp.account?.name || 'NOT LINKED', opp.account ? `(ID: ${opp.account.id})` : '');
  console.log('Account Website:', opp.account?.website || 'NOT SET');
  console.log('');

  // Check contacts linked to this opportunity
  console.log('=== Contacts Linked to Premera Opportunity ===');
  const contacts = await prisma.contact.findMany({
    where: { opportunityId: opp.id },
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  console.log('Total contacts:', contacts.length);
  contacts.forEach(c => {
    console.log(`  - ${c.firstName} ${c.lastName} <${c.email}>`);
  });
  console.log('');

  // Get all calendar events for this opportunity
  const events = await prisma.calendarEvent.findMany({
    where: { opportunityId: opp.id },
    orderBy: { startTime: 'asc' },
    select: { id: true, summary: true, startTime: true, endTime: true }
  });

  console.log('=== Calendar Events LINKED to Premera ===');
  console.log('Total:', events.length);
  console.log('');
  events.forEach(e => {
    console.log(e.startTime.toISOString().split('T')[0], '-', e.summary);
  });

  // Now find ALL calendar events that contain "Premera" in summary (unlinked too)
  console.log('');
  console.log('=== ALL Calendar Events with "Premera" in title ===');
  const allPremeraEvents = await prisma.calendarEvent.findMany({
    where: { summary: { contains: 'premera', mode: 'insensitive' } },
    orderBy: { startTime: 'asc' },
    select: { id: true, summary: true, startTime: true, opportunityId: true }
  });

  console.log('Total:', allPremeraEvents.length);
  console.log('');
  allPremeraEvents.forEach(e => {
    const linked = e.opportunityId ? '✓' : '✗';
    console.log(`${linked} ${e.startTime.toISOString().split('T')[0]} - ${e.summary}`);
  });

  // Check the ONE linked event - how did it get linked?
  console.log('');
  console.log('=== The ONE Linked Event Details ===');
  const linkedEvent = await prisma.calendarEvent.findFirst({
    where: {
      summary: { contains: 'premera', mode: 'insensitive' },
      opportunityId: { not: null }
    },
    select: { id: true, summary: true, startTime: true, attendees: true, createdAt: true, updatedAt: true }
  });
  if (linkedEvent) {
    console.log(`${linkedEvent.startTime.toISOString().split('T')[0]} - ${linkedEvent.summary}`);
    console.log('  Attendees:', linkedEvent.attendees?.length ? linkedEvent.attendees.join(', ') : 'NONE');
    console.log('  Created:', linkedEvent.createdAt);
    console.log('  Updated:', linkedEvent.updatedAt);
  }

  // Check attendees on a few unlinked Premera events
  console.log('');
  console.log('=== Sample Unlinked Premera Events with Attendees ===');
  const unlinkedEvents = await prisma.calendarEvent.findMany({
    where: {
      summary: { contains: 'premera', mode: 'insensitive' },
      opportunityId: null
    },
    orderBy: { startTime: 'desc' },
    take: 5,
    select: { id: true, summary: true, startTime: true, attendees: true, createdAt: true }
  });

  unlinkedEvents.forEach(e => {
    console.log(`\n${e.startTime.toISOString().split('T')[0]} - ${e.summary}`);
    console.log('  Attendees:', e.attendees?.length ? e.attendees.join(', ') : 'NONE');
    console.log('  Created:', e.createdAt);
  });

  // Simulate what the domain matching would do
  console.log('');
  console.log('=== Domain Matching Simulation ===');
  const premeraAccount = await prisma.account.findFirst({
    where: { name: { contains: 'premera', mode: 'insensitive' } },
    select: { id: true, name: true, website: true }
  });
  if (premeraAccount?.website) {
    try {
      const url = new URL(premeraAccount.website.startsWith('http') ? premeraAccount.website : `https://${premeraAccount.website}`);
      const fullDomain = url.hostname.replace(/^www\./, '').toLowerCase();
      console.log('Account website:', premeraAccount.website);
      console.log('Extracted domain:', fullDomain);
      console.log('');
      console.log('Email jessica.spytek@premera.com → domain: premera.com');
      console.log('Match?', fullDomain === 'premera.com' ? 'YES' : 'NO');
    } catch (e) {
      console.log('Error parsing website:', e.message);
    }
  }

  // Also check total calendar events synced
  console.log('');
  console.log('=== Total Calendar Events in DB ===');
  const totalCount = await prisma.calendarEvent.count();
  console.log('Total events synced:', totalCount);

  // Get date range of synced events
  const oldest = await prisma.calendarEvent.findFirst({
    orderBy: { startTime: 'asc' },
    select: { startTime: true }
  });
  const newest = await prisma.calendarEvent.findFirst({
    orderBy: { startTime: 'desc' },
    select: { startTime: true }
  });

  if (oldest && newest) {
    console.log('Date range:', oldest.startTime.toISOString().split('T')[0], 'to', newest.startTime.toISOString().split('T')[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
