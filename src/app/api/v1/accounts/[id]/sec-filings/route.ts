import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { secFilingCreateSchema } from "@/lib/validations/sec-filing";
import { getCikFromTicker, getCompanyFilings, getFilingViewerUrl } from "@/lib/integrations/sec-edgar";
import { inngest } from "@/lib/inngest/client";
import { FilingProcessingStatus } from "@prisma/client";

// GET /api/v1/accounts/[id]/sec-filings - List all SEC filings for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: accountId } = await params;

    // Verify account exists and belongs to user's organization
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const filingType = searchParams.get("filingType") || undefined;
    const fiscalYear = searchParams.get("fiscalYear")
      ? parseInt(searchParams.get("fiscalYear")!)
      : undefined;
    const processingStatus = searchParams.get("processingStatus") as FilingProcessingStatus | undefined;

    // Fetch SEC filings with optional filters
    const filings = await prisma.secFiling.findMany({
      where: {
        accountId,
        organizationId: user.organization.id,
        ...(filingType && { filingType }),
        ...(fiscalYear && { fiscalYear }),
        ...(processingStatus && { processingStatus }),
      },
      orderBy: {
        filingDate: "desc",
      },
    });

    return NextResponse.json({ filings });
  } catch (error) {
    console.error("Error fetching SEC filings:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch SEC filings" },
      { status: 500 }
    );
  }
}

// POST /api/v1/accounts/[id]/sec-filings - Fetch and process new SEC filing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: accountId } = await params;
    const body = await request.json();

    // Verify account exists and belongs to user's organization
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = secFilingCreateSchema.parse(body);

    // Get ticker from account (required)
    if (!account.ticker) {
      return NextResponse.json(
        {
          error:
            "Account ticker is required. Please add a ticker symbol to the account before fetching SEC filings.",
        },
        { status: 400 }
      );
    }

    // Step 1: Get company CIK from ticker
    let cik: string;
    try {
      cik = await getCikFromTicker(account.ticker);
    } catch (error) {
      return NextResponse.json(
        {
          error: `Failed to find company with ticker "${account.ticker}" in SEC database`,
        },
        { status: 404 }
      );
    }

    // Step 2: Fetch filing metadata from SEC
    let filings;
    try {
      filings = await getCompanyFilings(cik, validatedData.filingType);
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to fetch filings from SEC EDGAR" },
        { status: 500 }
      );
    }

    if (filings.length === 0) {
      return NextResponse.json(
        {
          error: `No ${validatedData.filingType} filings found for ${account.ticker}`,
        },
        { status: 404 }
      );
    }

    // Filter by fiscal year if provided
    const targetFiling = validatedData.fiscalYear
      ? filings.find((f) => {
          const filingYear = new Date(f.filingDate).getFullYear();
          return filingYear === validatedData.fiscalYear;
        })
      : filings[0]; // Default to most recent filing

    if (!targetFiling) {
      return NextResponse.json(
        {
          error: `No ${validatedData.filingType} filing found for fiscal year ${validatedData.fiscalYear}`,
        },
        { status: 404 }
      );
    }

    // Step 3: Check if this filing already exists
    const existingFiling = await prisma.secFiling.findUnique({
      where: {
        accountId_accessionNumber: {
          accountId,
          accessionNumber: targetFiling.accessionNumber,
        },
      },
    });

    if (existingFiling) {
      return NextResponse.json(
        {
          error: "This filing already exists for this account",
          filing: existingFiling,
        },
        { status: 409 }
      );
    }

    // Step 4: Create SecFiling record
    const filing = await prisma.secFiling.create({
      data: {
        accountId,
        organizationId: user.organization.id,
        filingType: validatedData.filingType,
        filingDate: new Date(targetFiling.filingDate),
        fiscalYear: validatedData.fiscalYear || new Date(targetFiling.reportDate).getFullYear(),
        fiscalPeriod: validatedData.fiscalPeriod,
        accessionNumber: targetFiling.accessionNumber,
        filingUrl: getFilingViewerUrl(cik, targetFiling.accessionNumber),
        cik,
        processingStatus: FilingProcessingStatus.pending,
      },
    });

    // Step 5: Trigger background job to fetch, parse, and summarize
    await inngest.send({
      name: "sec/filing.process",
      data: { filingId: filing.id },
    });

    return NextResponse.json({ filing }, { status: 201 });
  } catch (error) {
    console.error("Error creating SEC filing:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create SEC filing" },
      { status: 500 }
    );
  }
}
