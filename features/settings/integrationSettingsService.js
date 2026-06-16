import { recordAdminActivity } from "@/lib/adminActivity";
import { dbTable } from "@/lib/dbTable";
import {
  getIntegrationConfigEnvironmentFallback,
  getStoredIntegrationConfigRows,
  isConfiguredIntegrationValue,
} from "@/lib/integrationConfig";
import {
  INTEGRATION_CONFIG_DEFINITION_MAP,
  INTEGRATION_CONFIG_DEFINITIONS,
} from "@/lib/integrationConfigDefinitions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE = dbTable("integration_config");
const APP_CONFIG_TABLE = dbTable("app_config");
const DEFAULTS = {
  WA_SESSION_ID: "main",
  WEBAUTH_RP_NAME: "Amarta Residence",
};

const clean = (value) => String(value ?? "").trim();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  return clean(value).toLowerCase() === "true";
}

function normalizeUrl(value, key) {
  const text = clean(value);
  if (!text) throw new Error(`${key} wajib diisi`);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${key} harus berupa URL yang valid`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${key} hanya mendukung HTTP atau HTTPS`);
  }
  return text.replace(/\/$/, "");
}

function normalizeEmailList(value) {
  const items = Array.isArray(value)
    ? value
    : String(value || "").split(/[\n,;]+/);
  const emails = [...new Set(items.map(clean).filter(Boolean))];
  if (!emails.length) throw new Error("ALERT_EMAIL_TO wajib memiliki minimal satu penerima");
  if (emails.some((email) => !emailPattern.test(email))) {
    throw new Error("ALERT_EMAIL_TO memiliki alamat email yang tidak valid");
  }
  return emails;
}

function normalizeValue(definition, value) {
  if (!definition) throw new Error("Config key tidak diizinkan");

  if (definition.type === "boolean") {
    if (value === true || clean(value).toLowerCase() === "true") return true;
    if (value === false || clean(value).toLowerCase() === "false") return false;
    throw new Error(`${definition.key} harus bernilai true atau false`);
  }

  if (definition.type === "email-list") return normalizeEmailList(value);
  if (definition.type === "url") return normalizeUrl(value, definition.key);

  const text = clean(value);
  if (!text) throw new Error(`${definition.key} wajib diisi`);
  if (text.length > 500) throw new Error(`${definition.key} terlalu panjang`);

  if (definition.type === "email" && !emailPattern.test(text)) {
    throw new Error(`${definition.key} harus berupa alamat email yang valid`);
  }
  if (definition.type === "select" && !definition.options.includes(text)) {
    throw new Error(`${definition.key} tidak valid`);
  }
  if (definition.key === "R2_BUCKET_NAME" && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(text)) {
    throw new Error("R2_BUCKET_NAME tidak valid");
  }
  if (definition.key === "TELEGRAM_CHAT_ID" && !/^-?\d{1,30}$/.test(text)) {
    throw new Error("TELEGRAM_CHAT_ID harus berupa ID numerik");
  }
  if (definition.key === "WA_SESSION_ID" && !/^[A-Za-z0-9._-]{1,80}$/.test(text)) {
    throw new Error("WA_SESSION_ID hanya boleh berisi huruf, angka, titik, garis bawah, atau strip");
  }

  return text;
}

async function getLegacyEmailSetting() {
  const { data, error } = await getSupabaseAdmin()
    .from(APP_CONFIG_TABLE)
    .select("value")
    .eq("key", "email_notifications_enabled")
    .maybeSingle();
  if (error) return undefined;
  if (data?.value === undefined || data?.value === null || data?.value === "") return undefined;
  return parseBoolean(data.value);
}

function displayValue(value, definition) {
  if (definition.type === "email-list") {
    if (Array.isArray(value)) return value.join(", ");
    return clean(value);
  }
  if (definition.type === "boolean") return parseBoolean(value);
  return clean(value);
}

export async function getIntegrationSettings() {
  const keys = INTEGRATION_CONFIG_DEFINITIONS.map((item) => item.key);
  const storedRows = await getStoredIntegrationConfigRows(keys);
  const legacyEmailValue = await getLegacyEmailSetting();

  const fields = INTEGRATION_CONFIG_DEFINITIONS.map((definition) => {
    const row = storedRows[definition.key];
    const storedValue = row?.is_active !== false && isConfiguredIntegrationValue(row?.value)
      ? row.value
      : undefined;
    const envValue = getIntegrationConfigEnvironmentFallback(definition.key);
    const defaultValue = DEFAULTS[definition.key];

    let resolvedValue;
    let source = "missing";

    if (isConfiguredIntegrationValue(storedValue)) {
      resolvedValue = storedValue;
      source = "supabase";
    } else if (definition.key === "EMAIL_NOTIFICATIONS_ENABLED" && legacyEmailValue !== undefined) {
      resolvedValue = legacyEmailValue;
      source = "legacy_supabase";
    } else if (isConfiguredIntegrationValue(envValue)) {
      resolvedValue = envValue;
      source = "env";
    } else if (isConfiguredIntegrationValue(defaultValue)) {
      resolvedValue = defaultValue;
      source = "default";
    } else {
      resolvedValue = definition.type === "boolean" ? false : "";
    }

    return {
      ...definition,
      value: displayValue(resolvedValue, definition),
      stored_value: isConfiguredIntegrationValue(storedValue)
        ? displayValue(storedValue, definition)
        : null,
      source,
      env_configured: isConfiguredIntegrationValue(envValue),
      version: Number(row?.version || 0),
      updated_at: row?.updated_at || null,
      updated_by: row?.updated_by || null,
    };
  });

  return { ok: true, fields };
}

export async function updateIntegrationSetting({ req, key, value }) {
  const definition = INTEGRATION_CONFIG_DEFINITION_MAP[clean(key)];
  const normalizedValue = normalizeValue(definition, value);
  const client = getSupabaseAdmin();
  const currentRows = await getStoredIntegrationConfigRows([definition.key]);
  const oldValue = currentRows[definition.key]?.value;

  const payload = {
    key: definition.key,
    category: definition.category,
    value: normalizedValue,
    value_type: definition.valueType,
    description: definition.description,
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: "admin",
  };

  const { error } = await client.from(TABLE).upsert(payload, { onConflict: "key" });
  if (error) throw new Error(error.message || `Gagal menyimpan ${definition.key}`);

  await recordAdminActivity(req, {
    type: "update",
    module: "settings-integrations",
    severity: "success",
    message: `Update integration config ${definition.key}`,
    metadata: {
      key: definition.key,
      old_value: oldValue ?? null,
      new_value: normalizedValue,
      source: "supabase",
    },
  });

  return { ok: true };
}

export async function resetIntegrationSetting({ req, key }) {
  const definition = INTEGRATION_CONFIG_DEFINITION_MAP[clean(key)];
  if (!definition) throw new Error("Config key tidak diizinkan");

  const currentRows = await getStoredIntegrationConfigRows([definition.key]);
  const oldValue = currentRows[definition.key]?.value;
  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .delete()
    .eq("key", definition.key);
  if (error) throw new Error(error.message || `Gagal mereset ${definition.key}`);

  await recordAdminActivity(req, {
    type: "update",
    module: "settings-integrations",
    severity: "success",
    message: `Reset integration config ${definition.key} to fallback`,
    metadata: {
      key: definition.key,
      old_value: oldValue ?? null,
      new_source: "fallback",
    },
  });

  return { ok: true };
}
