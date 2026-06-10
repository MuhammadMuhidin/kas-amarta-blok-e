import { dbTable } from "@/lib/dbTable";
import { supabase } from "@/lib/supabase";

const ADMIN_ACTIVITIES_TABLE = dbTable("admin_activities");
const SETTINGS_MODULES = ["settings-app", "settings-auth", "settings-access-matrix"];

export async function listSettingsHistory() {
  const { data, error } = await supabase
    .from(ADMIN_ACTIVITIES_TABLE)
    .select("id,type,module,severity,message,metadata,actor,device_name,created_at")
    .in("module", SETTINGS_MODULES)
    .order("created_at", {
      ascending: false,
    })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}
