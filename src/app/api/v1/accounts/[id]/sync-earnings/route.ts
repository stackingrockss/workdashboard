import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  getNextEarningsDate as getFinnhubEarningsDate,
  isFinnhubConfigured,
} from "@/lib/integrations/finnhub";
import { estimateNextEarningsDate as getSecEdgarEstimate } from "@/lib/integrations/sec-edgar";

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

    let earningsResult: {
      date: Date;
      isEstimate: boolean;
      source: string;
    } | null = null;

    // Try Finnhub first (more accurate, has actual earnings calendar)
    if (isFinnhubConfigured()) {
      try {
        earningsResult = await getFinnhubEarningsDate(account.ticker);
      } catch (error) {
        console.warn(`Finnhub earnings fetch failed for ${account.ticker}:`, error);
      }
    }

    // Fall back to SEC EDGAR estimate if Finnhub unavailable or failed
    if (!earningsResult) {
      try {
        earningsResult = await getSecEdgarEstimate(account.ticker);
      } catch (error) {
        console.warn(`SEC EDGAR estimate failed for ${account.ticker}:`, error);
      }
    }

    // Update account with earnings date
    let updatedAccount = account;
    if (earningsResult) {
      updatedAccount = await prisma.account.update({
        where: { id: account.id },
        data: {
          nextEarningsDate: earningsResult.date,
          earningsDateSource: earningsResult.isEstimate
            ? `${earningsResult.source}-estimate`
            : earningsResult.source,
          lastEarningsSync: new Date(),
        },
      });
    } else {
      // No earnings data found, clear the date
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
        earningsDateSource: updatedAccount.earningsDateSource,
        lastEarningsSync: updatedAccount.lastEarningsSync,
      },
      earningsInfo: earningsResult
        ? {
            date: earningsResult.date,
            isEstimate: earningsResult.isEstimate,
            source: earningsResult.source,
          }
        : null,
    });
  } catch (error) {
    console.error("Error syncing earnings dates:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync earnings dates",
      },
      { status: 500 }
    );
  }
}
