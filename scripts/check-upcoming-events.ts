/**
 * Check for upcoming external events in next 7 days
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUpcoming() {
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  console.log('Current time:', now.toISOString());
  console.log('7 days from now:', sevenDays.toISOString());
  console.log('\nQuerying for external events between these dates...\n');

  const events = await prisma.calendarEvent.findMany({
    where: {
      isExternal: true,
      startTime: {
        gte: now,
        lte: sevenDays
      }
    },
    orderBy: { startTime: 'asc' },
    take: 10
  });

  console.log(`Found ${events.length} external events in next 7 days`);

  if (events.length > 0) {
    events.forEach((e, i) => {
      console.log(`${i+1}. ${e.summary}`);
      console.log(`   Start: ${e.startTime.toLocaleString()}`);
      console.log(`   Attendees: ${e.attendees.join(', ')}`);
      console.log();
    });
  } else {
    console.log('\n❌ No external events found in the next 7 days.');
    console.log('\nChecking all external events to see date range...');

    const allExternal = await prisma.calendarEvent.findMany({
      where: { isExternal: true },
      orderBy: { startTime: 'desc' },
      take: 5,
      select: { summary: true, startTime: true }
    });

    console.log('\nMost recent external events:');
    allExternal.forEach(e => {
      console.log(`  - ${e.summary}: ${e.startTime.toLocaleString()}`);
    });

    // Check if there are future external events
    const futureExternal = await prisma.calendarEvent.findMany({
      where: {
        isExternal: true,
        startTime: { gte: now }
      },
      orderBy: { startTime: 'asc' },
      take: 5,
      select: { summary: true, startTime: true }
    });

    if (futureExternal.length > 0) {
      console.log('\n✅ Next upcoming external events (beyond 7 days):');
      futureExternal.forEach(e => {
        const daysAway = Math.ceil((e.startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  - ${e.summary}: ${e.startTime.toLocaleString()} (in ${daysAway} days)`);
      });
    }
  }

  await prisma.$disconnect();
}

checkUpcoming().catch(console.error);