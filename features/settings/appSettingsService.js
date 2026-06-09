import { getAppConfig, updateAppConfig } from "@/lib/appConfig";
import { recordAdminActivity } from "@/lib/adminActivity";

export async function getAppSettings() {
  const config = await getAppConfig();

  return {
    ok: true,
    config,
  };
}

export async function updateAppSetting({ req, key, value }) {
  const currentConfig = await getAppConfig();
  const oldValue = currentConfig?.[key];

  await updateAppConfig(key, value);

  const updatedConfig = await getAppConfig();
  const newValue = updatedConfig?.[key];

  await recordAdminActivity(req, {
    type: "update",
    module: "settings-app",
    severity: "success",
    message: `Update app config ${key}`,
    metadata: {
      key,
      old_value: oldValue,
      new_value: newValue,
    },
  });

  return { ok: true };
}
