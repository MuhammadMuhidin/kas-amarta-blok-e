import { dbTable } from "@/lib/dbTable";
import { supabase } from "@/lib/supabase";

const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");

export function createAdminActivitiesQuery(sort) {
  return supabase
    .from(ADMIN_ACTIVITIES_TABLE)
    .select(
      "id,type,module,severity,message,metadata,actor,device_name,ip,location,created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: sort === "asc" });
}

export async function fetchAdminActivities(query, from, to) {
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    data: data || [],
    count: count || 0,
  };
}
