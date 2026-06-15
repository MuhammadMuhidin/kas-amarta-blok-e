import { NextResponse } from "next/server";
import { recordAdminActivity } from "@/lib/adminActivity";
import { isAdministrator, unauthorized, validateCSRF } from "@/lib/auth";
import {
  getTelegramWebhookInfo,
  registerTelegramWebhook,
  removeTelegramWebhook,
  sendTelegramMessage,
  telegramConfigSummary,
} from "@/lib/telegramClient";
import {
  getNotificationQueueRuntimeStatus,
  queueTelegramTestNotification,
} from "@/lib/notificationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function integrationStatus() {
  const config = await telegramConfigSummary();
  const queue = getNotificationQueueRuntimeStatus();
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

  return { ok: true, config, queue, webhook, webhook_error: webhookError };
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

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();

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
      metadata: { action, queue_provider: result?.provider || "" },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Gagal memproses konfigurasi Telegram" }, { status: 500 });
  }
}
