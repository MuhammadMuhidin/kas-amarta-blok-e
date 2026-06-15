import { dbTable } from "@/lib/dbTable";
import { getIntegrationConfigValue } from "@/lib/integrationConfig";
import { supabase } from "@/lib/supabase";

const APP_CONFIG_TABLE = dbTable("app_config");

const REQUIRED_KEYS = [
  "monthly_fee",
  "trash_fee",
  "start_monitoring_date",
];
const OPTIONAL_KEYS = [
  "email_notifications_enabled",
];
const ALLOWED_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).trim().toLowerCase() === "true";
}

async function readIntegrationEmailSetting() {
  const value = await getIntegrationConfigValue("EMAIL_NOTIFICATIONS_ENABLED", null);
  if (value === undefined || value === null || value === "") return null;
  return parseBoolean(value, true);
}

export async function isEmailNotificationsEnabled() {
  const integrationValue = await readIntegrationEmailSetting();
  if (integrationValue !== null) return integrationValue;

  const { data, error } = await supabase
    .from(APP_CONFIG_TABLE)
    .select("value")
    .eq("key", "email_notifications_enabled")
    .maybeSingle();

  if (error) throw new Error("Gagal membaca konfigurasi notifikasi email");
  return parseBoolean(data?.value, true);
}

export async function getAppConfig() {
  const { data, error } = await supabase
    .from(APP_CONFIG_TABLE)
    .select("key,value")
    .in("key", ALLOWED_KEYS);

  if (error) {
    throw new Error("Gagal membaca konfigurasi kas");
  }

  const config = Object.fromEntries(
    (data || []).map((item) => [
      item.key,
      item.value,
    ]),
  );

  for (const key of REQUIRED_KEYS) {
    if (config[key] === undefined || config[key] === null) {
      throw new Error(`Konfigurasi ${key} belum tersedia`);
    }
  }

  const monthly_fee = Number(config.monthly_fee);
  const trash_fee = Number(config.trash_fee);
  const start_monitoring_date = String(
    config.start_monitoring_date,
  ).slice(0, 7);
  const integrationEmailSetting = await readIntegrationEmailSetting();
  const email_notifications_enabled = integrationEmailSetting !== null
    ? integrationEmailSetting
    : parseBoolean(config.email_notifications_enabled, true);

  if (!Number.isFinite(monthly_fee)) {
    throw new Error("monthly_fee tidak valid");
  }

  if (!Number.isFinite(trash_fee)) {
    throw new Error("trash_fee tidak valid");
  }

  if (!/^\d{4}-\d{2}$/.test(start_monitoring_date)) {
    throw new Error("start_monitoring_date tidak valid");
  }

  return {
    monthly_fee,
    trash_fee,
    start_monitoring_date,
    email_notifications_enabled,
  };
}

export async function updateAppConfig(key, value) {
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error("Config tidak diizinkan");
  }

  let nextValue = value;

  if (key === "monthly_fee" || key === "trash_fee") {
    nextValue = Number(value);

    if (!Number.isFinite(nextValue) || nextValue < 0) {
      throw new Error("Nominal tidak valid");
    }
  }

  if (key === "start_monitoring_date") {
    nextValue = String(value).slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(nextValue)) {
      throw new Error("Tanggal monitoring tidak valid");
    }
  }

  if (key === "email_notifications_enabled") {
    nextValue = value === true || String(value).trim().toLowerCase() === "true"
      ? "true"
      : "false";
  }

  const { error } = await supabase.from(APP_CONFIG_TABLE).upsert(
    {
      key,
      value: nextValue,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "key",
    },
  );

  if (error) {
    throw new Error("Gagal menyimpan konfigurasi kas");
  }
}
