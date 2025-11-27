import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { taskPreferencesUpdateSchema } from "@/lib/validations/user";

export async function PATCH(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validation = taskPreferencesUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid preferences", details: validation.error },
        { status: 400 }
      );
    }

    // 4. Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        taskFilterPreference: validation.data.taskFilterPreference,
      },
      select: {
        id: true,
        taskFilterPreference: true,
      },
    });

    return NextResponse.json({
      preferences: {
        taskFilterPreference: updatedUser.taskFilterPreference,
      },
    });
  } catch (error) {
    console.error("Failed to update user preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get user preferences from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        taskFilterPreference: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      preferences: {
        taskFilterPreference: user.taskFilterPreference,
      },
    });
  } catch (error) {
    console.error("Failed to fetch user preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
