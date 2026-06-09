import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSettingsHistory } from "@/features/settings/settingsHistoryService";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const result = await getSettingsHistory();

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Failed to load settings history",
      },
      {
        status: 500,
      },
    );
  }
}
