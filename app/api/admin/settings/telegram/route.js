import { NextResponse } from "next/server";
import { recordAdminActivity } from "@/lib/adminActivity";
import { getAllowedAdminModules } from "@/lib/adminAccessMatrix";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { forbidden, unauthorized, validateCSRF } from "@/lib/auth";
import { formatJakartaDateTime } from "@/lib/localDate";
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
import { getAuthConfigs } from "@/lib/webauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_ACTIONS = new Set(["test_direct", "test_queue"]);
const ADMIN_ONLY_ACTIONS = new Set(["register_webhook", "remove_webhook"]);
const VALID_ACTIONS = new Set([...TEST_ACTIONS, ...ADMIN_ONLY_ACTIONS]);

async function authorizeMonitoring(req) {
  const session = await getCurrentAdminSession(req);
  if (!session) return { response: unauthorized() };

  const modules = await getAllowedAdminModules(session.access_role);
  if (!modules.includes("monitoring")) {
    return {
      response: forbidden("Anda tidak memiliki akses ke Monitoring"),
    };
  }

  return { session };
}

async function integrationStatus(session) {
  const [config, authConfig, queue] = await Promise.all([
    telegramConfigSummary(),
    getAuthConfigs(),
    getNotificationQueueRuntimeStatus(),
  ]);
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

  return {
    ok: true,
    config,
    queue,
    webhook,
    webhook_error: webhookError,
    permissions: {
      can_run_tests: true,
      can_manage_webhook: session?.access_role === "admin",
    },
    auth_config: {
      telegram_notifications_enabled: authConfig.telegramNotificationsEnabled === true,
      telegram_approval_actions_enabled: authConfig.telegramActionsConfigured === true,
    },
  };
}

export async function GET(req) {
  try {
    const authorization = await authorizeMonitoring(req);
    if (authorization.response) return authorization.response;

    return NextResponse.json(await integrationStatus(authorization.session));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Gagal membaca status Telegram" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const authorization = await authorizeMonitoring(req);
    if (authorization.response) return authorization.response;
    if (!validateCSRF(req)) return NextResponse.json({ error: "CSRF tidak valid" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Telegram action tidak valid" }, { status: 400 });
    }

    if (ADMIN_ONLY_ACTIONS.has(action) && authorization.session.access_role !== "admin") {
      return forbidden("Pengelolaan webhook Telegram hanya dapat dilakukan Administrator");
    }

    if (TEST_ACTIONS.has(action)) {
      const config = await telegramConfigSummary();
      if (!config.bot_token_configured || !config.chat_id_configured) {
        return NextResponse.json(
          { error: "Bot Token atau Chat ID Telegram belum dikonfigurasi" },
          { status: 422 },
        );
      }
    }

    let result;
    if (action === "register_webhook") {
      result = await registerTelegramWebhook();
    } else if (action === "remove_webhook") {
      result = await removeTelegramWebhook();
    } else if (action === "test_direct") {
      const timestamp = `${formatJakartaDateTime(new Date().toISOString(), "id-ID")} WIB`;
      result = await sendTelegramMessage({
        text: [
          "<b>Uji Telegram Langsung</b>",
          "",
          "<b>Status:</b> Berhasil",
          "<b>Keterangan:</b> Konfigurasi Telegram berhasil digunakan.",
          `<b>Waktu:</b> ${timestamp}`,
        ].join("\n"),
      });
    } else {
      result = await queueTelegramTestNotification();
      if (!result.queued) throw new Error(result.reason || "Event test gagal dimasukkan ke Queue");
    }

    await recordAdminActivity(req, {
      type: "update",
      module: "settings-telegram",
      severity: "success",
      message: `Telegram integration action ${action}`,
      metadata: {
        action,
        access_role: authorization.session.access_role,
        queue_provider: result?.provider || "",
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Gagal memproses konfigurasi Telegram" }, { status: 500 });
  }
}
