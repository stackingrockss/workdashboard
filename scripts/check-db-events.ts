// scripts/check-db-events.ts
// Check what calendar events are stored in the database

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDbEvents() {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        googleEventId: true,
        summary: true,
        startTime: true,
        isExternal: true,
        attendees: true,
        opportunityId: true,
        accountId: true,
      },
    });

    console.log('Total calendar events in DB:', events.length);
    console.log('\nAll events:');
    events.forEach((e, i) => {
      const dateStr = e.startTime.toISOString().split('T')[0];
      console.log(`${i + 1}. "${e.summary || 'No title'}" - ${dateStr}`);
      console.log(`   External: ${e.isExternal}`);
      console.log(`   Opp ID: ${e.opportunityId || 'None'}`);
      console.log(`   Attendees: ${e.attendees.slice(0, 3).join(', ')}${e.attendees.length > 3 ? '...' : ''}`);
      console.log();
    });

    // Check date range
    if (events.length > 0) {
      const earliest = events[0].startTime;
      const latest = events[events.length - 1].startTime;
      console.log(`\nDate range in DB: ${earliest.toISOString().split('T')[0]} to ${latest.toISOString().split('T')[0]}`);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDbEvents();