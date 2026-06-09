import { dbTable } from "@/lib/dbTable";
import { supabase } from "@/lib/supabase";

const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");

export async function listSettingsHistory() {
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

  return data || [];
}
