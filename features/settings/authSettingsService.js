import { getAuthConfigs, updateAuthConfig } from "@/lib/webauth";
import { recordAdminActivity } from "@/lib/adminActivity";

const allowedDurations = new Set([
  "3600",
  "21600",
  "43200",
  "86400",
  "259200",
  "604800",
  "2592000",
]);

const BOOLEAN_KEYS = new Set([
  "WEB_AUTH_ENABLED",
  "PIN_ENABLED",
  "WA_SERVICES_ENABLED",
  "TELEGRAM_NOTIFICATIONS_ENABLED",
  "TELEGRAM_ACTIONS_ENABLED",
]);

function normalizeAuthValue(key, value) {
  if (key === "SESSION_DURATION") {
    const normalized = String(value || "");

    if (!allowedDurations.has(normalized)) {
      throw new Error("Session duration tidak valid");
    }

    return normalized;
  }

  if (!BOOLEAN_KEYS.has(key)) {
    throw new Error("Config key tidak diizinkan");
  }

  return value ? "true" : "false";
}

function getPreviousValue(config, key) {
  if (key === "WEB_AUTH_ENABLED") return config.webAuthEnabled;
  if (key === "PIN_ENABLED") return config.pinEnabled;
  if (key === "WA_SERVICES_ENABLED") return config.whatsappServicesEnabled;
  if (key === "TELEGRAM_NOTIFICATIONS_ENABLED") return config.telegramNotificationsEnabled;
  if (key === "TELEGRAM_ACTIONS_ENABLED") return config.telegramActionsEnabled;
  if (key === "SESSION_DURATION") return config.sessionDuration;
  return null;
}

export async function getAuthSettings() {
  const config = await getAuthConfigs();

  return {
    ok: true,
    config,
  };
}

export async function updateAuthSetting({ req, key, value }) {
  const currentConfig = await getAuthConfigs();
  const oldValue = getPreviousValue(currentConfig, key);
  const normalizedValue = normalizeAuthValue(key, value);

  if (
    key === "TELEGRAM_ACTIONS_ENABLED" &&
    normalizedValue === "true" &&
    currentConfig.telegramNotificationsEnabled !== true
  ) {
    throw new Error("Aktifkan Telegram Notification Alerts terlebih dahulu");
  }

  await updateAuthConfig(key, normalizedValue);

  let telegramActionsAutoDisabled = false;
  if (key === "TELEGRAM_NOTIFICATIONS_ENABLED" && normalizedValue === "false") {
    await updateAuthConfig("TELEGRAM_ACTIONS_ENABLED", "false");
    telegramActionsAutoDisabled = currentConfig.telegramActionsEnabled === true;
  }

  await recordAdminActivity(req, {
    type: "update",
    module: "settings-auth",
    severity: "success",
    message: `Update auth setting ${key}`,
    metadata: {
      key,
      old_value: oldValue,
      new_value: normalizedValue,
      telegram_actions_auto_disabled: telegramActionsAutoDisabled,
    },
  });

  return { ok: true };
}
