/**
 * Find ALL events with @nhpri.org attendees
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find ALL events with @nhpri.org in attendees
  const allEvents = await prisma.$queryRaw<{ id: string; summary: string; startTime: Date; opportunityId: string | null; attendees: string[] }[]>`
    SELECT id, summary, "startTime", "opportunityId", attendees
    FROM opportunity_tracker."CalendarEvent"
    WHERE EXISTS (
      SELECT 1 FROM unnest(attendees) AS email
      WHERE lower(email) LIKE '%@nhpri.org'
    )
    ORDER BY "startTime" ASC
  `;

  console.log(`All events with @nhpri.org attendees (${allEvents.length} total):`);
  console.log('='.repeat(70));

  for (const e of allEvents) {
    const nhpriAttendees = e.attendees.filter(a => a.toLowerCase().includes('@nhpri.org'));
    console.log('');
    console.log(`Event: ${e.summary}`);
    console.log(`  Date: ${e.startTime}`);
    console.log(`  Linked to opp: ${e.opportunityId || 'None'}`);
    console.log(`  NHPRI attendees: ${nhpriAttendees.join(', ')}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());