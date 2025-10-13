import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { companySettingsSchema } from "@/lib/validations/company-settings";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();

    const settings = await prisma.companySettings.findUnique({
      where: { userId: user.id },
    });

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        settings: {
          companyName: null,
          companyWebsite: null,
          fiscalYearStartMonth: 1,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = companySettingsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Upsert settings (create if doesn't exist, update if it does)
    const settings = await prisma.companySettings.upsert({
      where: { userId: user.id },
      update: {
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
      },
      create: {
        userId: user.id,
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
