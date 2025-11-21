/**
 * Diagnostic script to check calendar event external detection issue
 *
 * Run with: npx tsx scripts/diagnose-calendar.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseCalendarEvents() {
  console.log('🔍 Diagnosing Calendar Event External Detection\n');
  console.log('='.repeat(60));

  try {
    // 1. Check if organization domain is configured
    console.log('\n📋 Step 1: Checking Organization Domain');
    console.log('-'.repeat(60));

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        _count: {
          select: {
            users: true,
            opportunities: true
          }
        }
      }
    });

    if (orgs.length === 0) {
      console.log('❌ No organizations found in database');
      return;
    }

    orgs.forEach((org) => {
      console.log(`\nOrganization: ${org.name} (${org.id})`);
      console.log(`  Domain: ${org.domain || '⚠️  NOT SET'}`);
      console.log(`  Users: ${org._count.users}`);
      console.log(`  Opportunities: ${org._count.opportunities}`);

      if (!org.domain) {
        console.log('  ⚠️  WARNING: No domain configured - external events cannot be detected!');
      }
    });

    // 2. Check CalendarEvent table
    console.log('\n\n📅 Step 2: Analyzing Calendar Events');
    console.log('-'.repeat(60));

    const eventStats = await prisma.calendarEvent.groupBy({
      by: ['isExternal'],
      _count: {
        _all: true
      }
    });

    if (eventStats.length === 0) {
      console.log('ℹ️  No calendar events found in database');
      return;
    }

    console.log('\nEvent Statistics:');
    eventStats.forEach((stat) => {
      console.log(`  ${stat.isExternal ? '✓ External' : '○ Internal'}: ${stat._count._all} events`);
    });

    // 3. Sample recent events
    console.log('\n\n📊 Step 3: Sample of Recent Events');
    console.log('-'.repeat(60));

    const recentEvents = await prisma.calendarEvent.findMany({
      take: 10,
      orderBy: { startTime: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            organization: {
              select: {
                domain: true
              }
            }
          }
        }
      }
    });

    if (recentEvents.length === 0) {
      console.log('No events found');
    } else {
      recentEvents.forEach((event, idx) => {
        console.log(`\n${idx + 1}. ${event.summary}`);
        console.log(`   Start: ${event.startTime.toLocaleString()}`);
        console.log(`   Is External: ${event.isExternal ? '✓ YES' : '✗ NO'}`);
        console.log(`   Attendees: ${event.attendees.length > 0 ? event.attendees.join(', ') : 'None'}`);
        console.log(`   Org Domain: ${event.user.organization?.domain || '⚠️  NOT SET'}`);

        // Manual check if it should be external
        if (event.user.organization?.domain && event.attendees.length > 0) {
          const orgDomain = event.user.organization.domain.toLowerCase();
          const userEmail = event.user.email.toLowerCase();
          const otherAttendees = event.attendees.filter(e => e.toLowerCase() !== userEmail);

          const shouldBeExternal = otherAttendees.some((email) => {
            const emailDomain = email.split('@')[1]?.toLowerCase();
            return emailDomain && emailDomain !== orgDomain && !emailDomain.endsWith(`.${orgDomain}`);
          });

          if (shouldBeExternal !== event.isExternal) {
            console.log(`   ⚠️  MISMATCH: Should be ${shouldBeExternal ? 'external' : 'internal'} but marked as ${event.isExternal ? 'external' : 'internal'}`);
          }
        }
      });
    }

    // 4. Upcoming external events (next 7 days)
    console.log('\n\n🔜 Step 4: Upcoming External Events (Next 7 Days)');
    console.log('-'.repeat(60));

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingExternal = await prisma.calendarEvent.findMany({
      where: {
        isExternal: true,
        startTime: {
          gte: now,
          lte: sevenDaysFromNow
        }
      },
      orderBy: { startTime: 'asc' },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    if (upcomingExternal.length === 0) {
      console.log('❌ No upcoming external events found');
      console.log('\nPossible reasons:');
      console.log('  1. Organization domain is not configured');
      console.log('  2. Events were synced before domain was set');
      console.log('  3. All events only have internal attendees');
      console.log('  4. Calendar is not connected or synced');
    } else {
      console.log(`✓ Found ${upcomingExternal.length} upcoming external events:`);
      upcomingExternal.forEach((event) => {
        console.log(`\n  • ${event.summary}`);
        console.log(`    When: ${event.startTime.toLocaleString()}`);
        console.log(`    User: ${event.user.name || event.user.email}`);
        console.log(`    Attendees: ${event.attendees.join(', ')}`);
      });
    }

    // 5. Summary and recommendations
    console.log('\n\n💡 Summary & Recommendations');
    console.log('='.repeat(60));

    const orgWithoutDomain = orgs.filter(o => !o.domain);
    const allEventsInternal = eventStats.every(s => !s.isExternal);

    if (orgWithoutDomain.length > 0) {
      console.log('\n🔴 CRITICAL ISSUE:');
      console.log(`   ${orgWithoutDomain.length} organization(s) missing domain configuration`);
      console.log('   → Go to /settings/organization and set your organization domain');
    }

    if (allEventsInternal && eventStats.length > 0) {
      console.log('\n🟡 WARNING:');
      console.log('   All calendar events marked as internal (isExternal=false)');
      console.log('   → Events may have been synced before domain was configured');
      console.log('   → Solution: Recalculate isExternal for existing events');
    }

    if (upcomingExternal.length === 0 && eventStats.length > 0) {
      console.log('\n🟠 ISSUE:');
      console.log('   No upcoming external meetings detected');
      console.log('   → Check if domain is configured correctly');
      console.log('   → Verify calendar OAuth connection in /settings/integrations');
      console.log('   → Consider running event recalculation');
    }

    console.log('\n✓ Diagnosis complete!\n');

  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the diagnostic
diagnoseCalendarEvents().catch(console.error);
