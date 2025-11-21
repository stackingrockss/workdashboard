/**
 * Check the date range of events in database vs what should be there
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDateRange() {
  console.log('🗓️  Checking Event Date Range\n');
  console.log('='.repeat(60));

  const now = new Date();
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get earliest and latest events
  const earliest = await prisma.calendarEvent.findFirst({
    orderBy: { startTime: 'asc' },
    select: { startTime: true, summary: true }
  });

  const latest = await prisma.calendarEvent.findFirst({
    orderBy: { startTime: 'desc' },
    select: { startTime: true, summary: true }
  });

  console.log('\n📊 Database Event Range:');
  if (earliest && latest) {
    console.log(`  Earliest: ${earliest.startTime.toLocaleString()}`);
    console.log(`    "${earliest.summary}"`);
    console.log(`  Latest: ${latest.startTime.toLocaleString()}`);
    console.log(`    "${latest.summary}"`);
  }

  console.log('\n📅 Expected Date Range (90 days past to 90 days future):');
  const expectedStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const expectedEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  console.log(`  Should start: ${expectedStart.toLocaleDateString()}`);
  console.log(`  Should end: ${expectedEnd.toLocaleDateString()}`);

  console.log('\n🎯 Target Range (Next 7 Days):');
  console.log(`  Today: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  console.log(`  7 days from now: ${sevenDaysAhead.toLocaleDateString()}`);

  // Check for events in next 7 days
  const upcomingAll = await prisma.calendarEvent.findMany({
    where: {
      startTime: {
        gte: now,
        lte: sevenDaysAhead
      }
    },
    orderBy: { startTime: 'asc' },
    select: {
      summary: true,
      startTime: true,
      isExternal: true,
      attendees: true
    }
  });

  console.log(`\n📌 Events in Next 7 Days: ${upcomingAll.length} total`);

  if (upcomingAll.length > 0) {
    const external = upcomingAll.filter(e => e.isExternal);
    const internal = upcomingAll.filter(e => !e.isExternal);

    console.log(`  ✓ External: ${external.length}`);
    console.log(`  ○ Internal: ${internal.length}`);

    if (external.length > 0) {
      console.log('\n✅ External Events Found:');
      external.slice(0, 10).forEach((e, i) => {
        console.log(`\n  ${i + 1}. ${e.summary}`);
        console.log(`     When: ${e.startTime.toLocaleString()}`);
        console.log(`     Attendees: ${e.attendees.join(', ')}`);
      });
    } else {
      console.log('\n⚠️  All upcoming events are marked as INTERNAL');
      console.log('    Showing first few:');
      upcomingAll.slice(0, 5).forEach((e, i) => {
        console.log(`\n  ${i + 1}. ${e.summary}`);
        console.log(`     When: ${e.startTime.toLocaleString()}`);
        console.log(`     Attendees: ${e.attendees.length > 0 ? e.attendees.join(', ') : 'None'}`);
      });
    }
  } else {
    console.log('\n❌ No events found in next 7 days in database');
    console.log('\n💡 Possible reasons:');
    console.log('  1. Sync hasn\'t pulled latest events yet');
    console.log('  2. Google Calendar events are outside the sync window');
    console.log('  3. Need to click "Sync Now" again');
  }

  // Check last sync time
  const lastUpdated = await prisma.calendarEvent.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true }
  });

  if (lastUpdated) {
    const minutesAgo = Math.floor((now.getTime() - lastUpdated.updatedAt.getTime()) / 60000);
    console.log(`\n⏰ Last Sync: ${minutesAgo} minutes ago`);
    if (minutesAgo > 5) {
      console.log('   → Consider clicking "Sync Now" to fetch latest events');
    }
  }

  await prisma.$disconnect();
}

checkDateRange().catch(console.error);