import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getEarningsCalendar } from "@/lib/integrations/financial-modeling-prep";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // Verify account belongs to user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (!account.ticker) {
      return NextResponse.json(
        { error: "Account does not have a stock ticker symbol" },
        { status: 400 }
      );
    }

    // Fetch earnings calendar from Financial Modeling Prep API
    const earningsData = await getEarningsCalendar(account.ticker);

    if (!earningsData || earningsData.length === 0) {
      return NextResponse.json(
        { error: "No earnings data found for this ticker" },
        { status: 404 }
      );
    }

    // Filter for future earnings dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEarnings = earningsData
      .filter((earnings) => new Date(earnings.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get the next earnings date
    const nextEarnings = upcomingEarnings[0] || null;

    // Update account with next earnings date
    let updatedAccount = account;
    if (nextEarnings) {
      updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: {
          nextEarningsDate: new Date(nextEarnings.date),
          earningsDateSource: "api",
          lastEarningsSync: new Date(),
        },
      });
    } else {
      // No upcoming earnings found, clear the date
      updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: {
          nextEarningsDate: null,
          lastEarningsSync: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: updatedAccount.id,
        name: updatedAccount.name,
        ticker: updatedAccount.ticker,
        nextEarningsDate: updatedAccount.nextEarningsDate,
        lastEarningsSync: updatedAccount.lastEarningsSync,
      },
      nextEarnings,
      upcomingCount: upcomingEarnings.length,
    });
  } catch (error) {
    console.error("Error syncing earnings dates:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to sync earnings dates" },
      { status: 500 }
    );
  }
}
