import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { dbTable } from "@/lib/dbTable";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const { data, error } = await supabase
      .from(ADMIN_ACTIVITIES_TABLE)
      .select("id,type,module,severity,message,metadata,actor,device_name,created_at")
      .in("module", ["settings-app", "settings-auth"])
      .order("created_at", {
        ascending: false,
      })
      .limit(5);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      changes: data || [],
    });
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
