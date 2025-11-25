// scripts/diagnose-centene-events.ts
// Diagnostic script to check Centene calendar events and matching

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('[Diagnose] Checking Centene account and calendar events...\n');

  try {
    // Find Centene account
    const centeneAccount = await prisma.account.findFirst({
      where: {
        name: { contains: 'Centene', mode: 'insensitive' },
      },
      include: {
        opportunities: {
          select: { id: true, name: true },
        },
      },
    });

    if (!centeneAccount) {
      console.log('❌ No Centene account found');
      return;
    }

    console.log('✓ Found Centene account:');
    console.log(`  - ID: ${centeneAccount.id}`);
    console.log(`  - Name: ${centeneAccount.name}`);
    console.log(`  - Website: ${centeneAccount.website || 'NOT SET'}`);
    console.log(`  - Opportunities: ${centeneAccount.opportunities.length}`);
    centeneAccount.opportunities.forEach((opp) => {
      console.log(`    - ${opp.name} (${opp.id})`);
    });

    // Check for calendar events with centene.com attendees
    const allEvents = await prisma.calendarEvent.findMany({
      select: {
        id: true,
        summary: true,
        startTime: true,
        attendees: true,
        opportunityId: true,
        accountId: true,
      },
    });

    const centeneEvents = allEvents.filter((event) =>
      event.attendees.some((email) => email.toLowerCase().includes('centene.com'))
    );

    console.log(`\n✓ Found ${centeneEvents.length} calendar events with @centene.com attendees:\n`);

    centeneEvents.forEach((event) => {
      console.log(`Event: "${event.summary}"`);
      console.log(`  - Date: ${event.startTime.toLocaleDateString()}`);
      console.log(`  - Attendees: ${event.attendees.join(', ')}`);
      console.log(`  - accountId: ${event.accountId || 'NULL'}`);
      console.log(`  - opportunityId: ${event.opportunityId || 'NULL'}`);
      console.log();
    });

    // Summary
    const linkedToAccount = centeneEvents.filter((e) => e.accountId === centeneAccount.id).length;
    const linkedToOpportunity = centeneEvents.filter((e) => e.opportunityId).length;
    const notLinked = centeneEvents.filter((e) => !e.accountId && !e.opportunityId).length;

    console.log('Summary:');
    console.log(`  - Total Centene events: ${centeneEvents.length}`);
    console.log(`  - Linked to Centene account: ${linkedToAccount}`);
    console.log(`  - Linked to an opportunity: ${linkedToOpportunity}`);
    console.log(`  - Not linked at all: ${notLinked}`);

    if (!centeneAccount.website) {
      console.log('\n⚠️  WARNING: Centene account has no website set!');
      console.log('   Domain matching cannot work without a website.');
      console.log('   Please update the Centene account to have website: https://www.centene.com');
    }
  } catch (error) {
    console.error('[Diagnose] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
