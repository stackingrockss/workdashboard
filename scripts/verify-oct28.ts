// scripts/verify-oct28.ts
// Verify Oct 28 events are now in the database

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('Checking events on Oct 28, 2025...\n');

  const events = await prisma.calendarEvent.findMany({
    where: {
      startTime: {
        gte: new Date('2025-10-28T00:00:00Z'),
        lte: new Date('2025-10-29T23:59:59Z'),
      },
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      summary: true,
      startTime: true,
      isExternal: true,
      attendees: true,
      opportunityId: true,
      accountId: true,
    },
  });

  console.log(`Found ${events.length} events on Oct 28-29, 2025:\n`);

  const externalEvents = events.filter((e) => e.isExternal);
  console.log(`External events: ${externalEvents.length}\n`);

  externalEvents.forEach((e, i) => {
    console.log(`${i + 1}. "${e.summary}"`);
    console.log(`   Time: ${e.startTime.toISOString()}`);
    console.log(`   Opp ID: ${e.opportunityId || 'None'}`);
    console.log(`   Account ID: ${e.accountId || 'None'}`);
    console.log(`   Attendees: ${e.attendees.slice(0, 5).join(', ')}`);
    console.log();
  });

  // Check specifically for Centene
  console.log('\n--- Searching for Centene-related events ---\n');
  const centeneEvents = events.filter(
    (e) =>
      e.summary.toLowerCase().includes('centene') ||
      e.attendees.some((a) => a.includes('centene.com'))
  );

  if (centeneEvents.length > 0) {
    console.log(`Found ${centeneEvents.length} Centene event(s):`);
    centeneEvents.forEach((e, i) => {
      console.log(`${i + 1}. "${e.summary}"`);
      console.log(`   Opp ID: ${e.opportunityId || 'NOT LINKED'}`);
      console.log(`   Attendees: ${e.attendees.filter((a) => a.includes('centene')).join(', ')}`);
    });
  } else {
    console.log('No Centene events found on Oct 28');
  }

  // Check NHPRI
  console.log('\n--- Searching for NHPRI-related events ---\n');
  const nhpriEvents = events.filter(
    (e) =>
      e.summary.toLowerCase().includes('nhpri') ||
      e.attendees.some((a) => a.includes('nhpri.org'))
  );

  if (nhpriEvents.length > 0) {
    console.log(`Found ${nhpriEvents.length} NHPRI event(s):`);
    nhpriEvents.forEach((e, i) => {
      console.log(`${i + 1}. "${e.summary}"`);
      console.log(`   Opp ID: ${e.opportunityId || 'NOT LINKED'}`);
      console.log(`   Attendees: ${e.attendees.filter((a) => a.includes('nhpri')).join(', ')}`);
    });
  } else {
    console.log('No NHPRI events found on Oct 28');
  }

  await prisma.$disconnect();
}

verify();