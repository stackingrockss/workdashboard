// scripts/recalculate-external-flags.ts
// Recalculates isExternal flags for all calendar events using fixed domain normalization logic

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Determines if an event is external based on attendee domains
 * Matches the fixed logic in google-calendar.ts
 */
function isExternalEvent(
  attendees: string[],
  organizationDomain: string,
  currentUserEmail: string
): boolean {
  // Early validation
  if (!organizationDomain || attendees.length === 0) {
    return false;
  }

  // Normalize organization domain by removing www. prefix
  const orgDomain = organizationDomain.toLowerCase().replace(/^www\./, '');

  // Filter out current user's email
  const otherAttendees = attendees.filter(
    (email) => email.toLowerCase() !== currentUserEmail.toLowerCase()
  );

  // If only the user is in the meeting, it's not external
  if (otherAttendees.length === 0) {
    return false;
  }

  // Check if any other attendee has a different domain
  const externalAttendees = otherAttendees.filter((email) => {
    const rawEmailDomain = email.split('@')[1]?.toLowerCase();
    if (!rawEmailDomain) {
      return false;
    }

    // Normalize email domain
    const emailDomain = rawEmailDomain.replace(/^www\./, '');

    // Exact match or subdomain match
    const isExternal = emailDomain !== orgDomain && !emailDomain.endsWith(`.${orgDomain}`);
    return isExternal;
  });

  return externalAttendees.length > 0;
}

async function recalculateExternalFlags() {
  console.log('🔄 Recalculating isExternal flags for all calendar events\n');

  // Get all organizations with domains
  const organizations = await prisma.organization.findMany({
    where: {
      domain: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      domain: true,
    },
  });

  console.log(`Found ${organizations.length} organizations with domains configured\n`);

  let totalEvents = 0;
  let updatedEvents = 0;

  for (const org of organizations) {
    console.log(`Processing: ${org.name} (domain: ${org.domain})`);

    // Get all users in this organization
    const users = await prisma.user.findMany({
      where: { organizationId: org.id },
      select: { id: true, email: true },
    });

    for (const user of users) {
      // Get all calendar events for this user
      const events = await prisma.calendarEvent.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          summary: true,
          attendees: true,
          isExternal: true,
        },
      });

      for (const event of events) {
        totalEvents++;

        // Recalculate isExternal flag
        const attendeeEmails = (event.attendees || []) as string[];
        const correctIsExternal = isExternalEvent(
          attendeeEmails,
          org.domain!,
          user.email
        );

        // Update if flag is incorrect
        if (event.isExternal !== correctIsExternal) {
          await prisma.calendarEvent.update({
            where: { id: event.id },
            data: { isExternal: correctIsExternal },
          });

          updatedEvents++;

          console.log(
            `  ✅ Updated "${event.summary}": ${event.isExternal ? 'EXTERNAL' : 'INTERNAL'} → ${correctIsExternal ? 'EXTERNAL' : 'INTERNAL'}`
          );
        }
      }
    }

    console.log('');
  }

  console.log('\n📊 Summary:');
  console.log(`  Total events processed: ${totalEvents}`);
  console.log(`  Events updated: ${updatedEvents}`);
  console.log(`  Events unchanged: ${totalEvents - updatedEvents}`);
  console.log('\n✅ Recalculation complete');
}

recalculateExternalFlags()
  .catch((error) => {
    console.error('Error during recalculation:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
