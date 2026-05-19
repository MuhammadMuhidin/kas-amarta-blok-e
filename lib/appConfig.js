import { supabase } from "@/lib/supabase";

const REQUIRED_KEYS = [
  "monthly_fee",
  "trash_fee",
  "start_monitoring_date",
];

export async function getAppConfig() {
  const { data, error } = await supabase
    .from("app_config")
    .select("key,value")
    .in("key", REQUIRED_KEYS);

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
  };
}

export async function updateAppConfig(key, value) {
  if (!REQUIRED_KEYS.includes(key)) {
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

  const { error } = await supabase.from("app_config").upsert(
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