// scripts/diagnose-calendar-filtering.ts
// Diagnostic script to investigate why internal meetings are showing as external

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseCalendarFiltering() {
  console.log('🔍 Starting Calendar Filtering Diagnostics\n');

  // 1. Check organization domain
  console.log('1️⃣ Checking Organization Domain Configuration...');
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      domain: true,
    },
  });

  console.log('Organizations found:', organizations.length);
  organizations.forEach((org) => {
    console.log(`  - ${org.name} (${org.id}): domain = "${org.domain || 'NOT SET'}"`);
  });
  console.log('');

  if (organizations.length === 0) {
    console.log('❌ No organizations found in database');
    return;
  }

  // 2. Check calendar events for each organization
  for (const org of organizations) {
    console.log(`\n2️⃣ Checking Calendar Events for ${org.name}...`);

    // Get upcoming events (next 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: {
          in: (
            await prisma.user.findMany({
              where: { organizationId: org.id },
              select: { id: true },
            })
          ).map((u) => u.id),
        },
        startTime: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      select: {
        id: true,
        summary: true,
        startTime: true,
        isExternal: true,
        attendees: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 20,
    });

    console.log(`Found ${events.length} upcoming events in next 7 days\n`);

    // Analyze each event
    events.forEach((event, index) => {
      console.log(`Event ${index + 1}: "${event.summary}"`);
      console.log(`  Start: ${event.startTime.toISOString()}`);
      console.log(`  Current isExternal flag: ${event.isExternal}`);
      console.log(`  User email: ${event.user.email}`);
      console.log(`  Attendees: ${JSON.stringify(event.attendees, null, 2)}`);

      // Manual check: should this be external?
      const attendeeEmails = (event.attendees || []) as string[];
      const userEmail = event.user.email.toLowerCase();
      // Normalize org domain by removing www. prefix
      const orgDomain = org.domain?.toLowerCase().replace(/^www\./, '');

      // Filter out user's own email
      const otherAttendees = attendeeEmails.filter(
        (email) => email.toLowerCase() !== userEmail
      );

      if (!orgDomain) {
        console.log(`  ⚠️  Organization domain not set - cannot determine external status`);
      } else if (otherAttendees.length === 0) {
        console.log(`  ℹ️  Only user in meeting - should be INTERNAL`);
      } else {
        // Check if any attendee has external domain
        const externalAttendees = otherAttendees.filter((email) => {
          const rawEmailDomain = email.split('@')[1]?.toLowerCase();
          if (!rawEmailDomain) return false;

          // Normalize email domain
          const emailDomain = rawEmailDomain.replace(/^www\./, '');

          const isExternal =
            emailDomain !== orgDomain && !emailDomain.endsWith(`.${orgDomain}`);
          return isExternal;
        });

        const shouldBeExternal = externalAttendees.length > 0;

        console.log(`  Other attendees (excluding user): ${otherAttendees.length}`);
        console.log(`  External attendees: ${externalAttendees.length}`);
        console.log(`  Attendee domains: ${otherAttendees.map((e) => e.split('@')[1]).join(', ')}`);
        console.log(`  Organization domain: ${orgDomain}`);
        console.log(`  ✅ Should be EXTERNAL: ${shouldBeExternal}`);

        if (event.isExternal !== shouldBeExternal) {
          console.log(
            `  ❌ MISMATCH! Database says ${event.isExternal ? 'EXTERNAL' : 'INTERNAL'} but should be ${shouldBeExternal ? 'EXTERNAL' : 'INTERNAL'}`
          );
        } else {
          console.log(`  ✅ Flag is correct`);
        }
      }

      console.log('');
    });

    // Summary statistics
    const totalEvents = await prisma.calendarEvent.count({
      where: {
        userId: {
          in: (
            await prisma.user.findMany({
              where: { organizationId: org.id },
              select: { id: true },
            })
          ).map((u) => u.id),
        },
        startTime: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    });

    const externalEvents = await prisma.calendarEvent.count({
      where: {
        userId: {
          in: (
            await prisma.user.findMany({
              where: { organizationId: org.id },
              select: { id: true },
            })
          ).map((u) => u.id),
        },
        startTime: {
          gte: now,
          lte: sevenDaysFromNow,
        },
        isExternal: true,
      },
    });

    console.log(`\n📊 Summary for ${org.name}:`);
    console.log(`  Total upcoming events: ${totalEvents}`);
    console.log(`  Marked as external: ${externalEvents}`);
    console.log(`  Marked as internal: ${totalEvents - externalEvents}`);
  }

  console.log('\n✅ Diagnostic complete');
}

diagnoseCalendarFiltering()
  .catch((error) => {
    console.error('Error during diagnosis:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
