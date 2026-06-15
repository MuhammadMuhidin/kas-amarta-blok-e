import { NextResponse } from "next/server";
import { verifyAdminRolePin } from "@/lib/adminRoleCredentials";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdministrator, unauthorized, validateCSRF } from "@/lib/auth";
import {
  clearRateLimit,
  enforceFailureRateLimit,
  enforceRateLimit,
  RATE_LIMIT_SCOPES,
  recordRateLimitFailure,
} from "@/lib/rateLimit";
import {
  getTelegramWebhookInfo,
  registerTelegramWebhook,
  removeTelegramWebhook,
  sendTelegramMessage,
  telegramConfigSummary,
} from "@/lib/telegramClient";
import { queueTelegramTestNotification } from "@/lib/notificationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function integrationStatus() {
  const config = telegramConfigSummary();
  let webhook = null;
  let webhookError = "";

  if (config.bot_token_configured) {
    try {
      const info = await getTelegramWebhookInfo();
      webhook = {
        url: info?.url || "",
        pending_update_count: Number(info?.pending_update_count || 0),
        last_error_date: info?.last_error_date || null,
        last_error_message: info?.last_error_message || "",
      };
    } catch (error) {
      webhookError = error instanceof Error ? error.message : "Gagal membaca webhook Telegram";
    }
  }

  return { ok: true, config, webhook, webhook_error: webhookError };
}

export async function GET(req) {
  try {
    if (!(await isAdministrator(req))) return unauthorized();
    return NextResponse.json(await integrationStatus());
  } catch (error) {
    return NextResponse.json({ error: error.message || "Gagal membaca status Telegram" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!(await isAdministrator(req))) return unauthorized();
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const settingsLimit = await enforceRateLimit(req, RATE_LIMIT_SCOPES.settingsUpdate, { identity: "session" });
    if (settingsLimit) return settingsLimit;

    const pinLimit = await enforceFailureRateLimit(req, RATE_LIMIT_SCOPES.settingsPinFailed, { identity: "session" });
    if (pinLimit) return pinLimit;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();

    if (!(await verifyAdminRolePin("admin", body.pin))) {
      await recordRateLimitFailure(req, RATE_LIMIT_SCOPES.settingsPinFailed, { identity: "session" });
      return NextResponse.json({ error: "PIN tidak valid" }, { status: 403 });
    }

    await clearRateLimit(req, RATE_LIMIT_SCOPES.settingsPinFailed, { identity: "session" });

    let result;
    if (action === "register_webhook") {
      result = await registerTelegramWebhook();
    } else if (action === "remove_webhook") {
      result = await removeTelegramWebhook();
    } else if (action === "test_direct") {
      result = await sendTelegramMessage({
        text: [
          "<b>Telegram Direct Test</b>",
          "",
          "Bot Token, Chat ID, dan koneksi Telegram berhasil digunakan.",
          `<b>Waktu:</b> ${new Date().toISOString()}`,
        ].join("\n"),
      });
    } else if (action === "test_queue") {
      result = await queueTelegramTestNotification();
      if (!result.queued) throw new Error(result.reason || "Event test gagal dimasukkan ke Queue");
    } else {
      return NextResponse.json({ error: "Telegram action tidak valid" }, { status: 400 });
    }

    await recordAdminActivity(req, {
      type: "update",
      module: "settings-telegram",
      severity: "success",
      message: `Telegram integration action ${action}`,
      metadata: { action },
    });

    return NextResponse.json({ ok: true, result, status: await integrationStatus() });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Gagal memproses konfigurasi Telegram" }, { status: 500 });
  }
}
