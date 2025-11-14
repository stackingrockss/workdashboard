// scripts/set-org-domain.ts
// Set organization domain to enable external meeting detection

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setOrganizationDomain() {
  try {
    console.log('🔍 Finding your organization...');

    // Find the first organization (assuming single org for now)
    const org = await prisma.organization.findFirst();

    if (!org) {
      console.error('❌ No organization found in database');
      process.exit(1);
    }

    console.log(`📋 Found organization: ${org.name} (ID: ${org.id})`);
    console.log(`📧 Current domain: ${org.domain || '(not set)'}`);

    // Update domain to verifiable.com
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { domain: 'verifiable.com' },
    });

    console.log('✅ Organization domain updated successfully!');
    console.log(`📧 New domain: ${updated.domain}`);
    console.log('\n🎉 External meeting detection is now enabled!');
    console.log('   Meetings with non-@verifiable.com attendees will appear on your dashboard.');

  } catch (error) {
    console.error('❌ Error updating organization domain:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setOrganizationDomain();
