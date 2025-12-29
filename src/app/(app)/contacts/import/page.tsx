// src/app/(app)/contacts/import/page.tsx
// Full page for importing contacts from parsed transcripts (Gong/Granola)

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuthOrRedirect } from "@/lib/auth";
import { ContactImportPageClient } from "@/components/contacts/ContactImportPageClient";
import type { PersonExtracted } from "@/lib/ai/parse-gong-transcript";

interface ContactImportPageProps {
  searchParams: Promise<{
    notificationId?: string;
    opportunityId?: string;
    gongCallId?: string;
    granolaNoteId?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ContactImportPage({ searchParams }: ContactImportPageProps) {
  const params = await searchParams;
  const { notificationId, opportunityId, gongCallId, granolaNoteId } = params;

  // Require authentication
  const user = await requireAuthOrRedirect();

  // We need at least an opportunityId and one of gongCallId/granolaNoteId
  if (!opportunityId || (!gongCallId && !granolaNoteId)) {
    // Try to get info from notification if provided
    if (notificationId) {
      const notification = await prisma.contactsReadyNotification.findFirst({
        where: {
          id: notificationId,
          userId: user.id,
        },
      });

      if (notification) {
        // Redirect with proper params from notification
        const redirectParams = new URLSearchParams({
          opportunityId: notification.opportunityId,
          ...(notification.gongCallId && { gongCallId: notification.gongCallId }),
          ...(notification.granolaNoteId && { granolaNoteId: notification.granolaNoteId }),
        });
        redirect(`/contacts/import?${redirectParams.toString()}`);
      }
    }

    // No valid params - show not found
    notFound();
  }

  // Verify opportunity exists and user has access
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId: user.organization.id,
    },
    select: {
      id: true,
      name: true,
      accountName: true,
    },
  });

  if (!opportunity) {
    notFound();
  }

  // Fetch the call/note data with parsed people
  let callTitle = "";
  let meetingDate: string | null = null;
  let parsedPeople: PersonExtracted[] = [];
  let sourceType: "gong" | "granola" = "gong";
  let sourceId = "";

  if (gongCallId) {
    const gongCall = await prisma.gongCall.findFirst({
      where: {
        id: gongCallId,
        opportunityId: opportunity.id,
        organizationId: user.organization.id,
      },
      select: {
        id: true,
        title: true,
        meetingDate: true,
        parsedPeople: true,
      },
    });

    if (!gongCall) {
      notFound();
    }

    callTitle = gongCall.title;
    meetingDate = gongCall.meetingDate.toISOString();
    parsedPeople = (gongCall.parsedPeople as unknown as PersonExtracted[]) || [];
    sourceType = "gong";
    sourceId = gongCall.id;
  } else if (granolaNoteId) {
    const granolaNote = await prisma.granolaNote.findFirst({
      where: {
        id: granolaNoteId,
        opportunityId: opportunity.id,
      },
      select: {
        id: true,
        title: true,
        meetingDate: true,
        parsedPeople: true,
      },
    });

    if (!granolaNote) {
      notFound();
    }

    callTitle = granolaNote.title;
    meetingDate = granolaNote.meetingDate.toISOString();
    parsedPeople = (granolaNote.parsedPeople as unknown as PersonExtracted[]) || [];
    sourceType = "granola";
    sourceId = granolaNote.id;
  }

  // Mark notification as read if provided
  if (notificationId) {
    await prisma.contactsReadyNotification.updateMany({
      where: {
        id: notificationId,
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  return (
    <ContactImportPageClient
      opportunity={{
        id: opportunity.id,
        name: opportunity.name,
        accountName: opportunity.accountName || undefined,
      }}
      callTitle={callTitle}
      meetingDate={meetingDate}
      parsedPeople={parsedPeople}
      sourceType={sourceType}
      sourceId={sourceId}
      notificationId={notificationId}
    />
  );
}
