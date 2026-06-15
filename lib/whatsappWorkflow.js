import { randomUUID } from "crypto";

const WA_REPORT_CHAT_ID = process.env.WA_REPORT_CHAT_ID || process.env.WA_CHAT_ID;
const WA_ALERT_CHAT_ID = process.env.WA_ALERT_CHAT_ID || process.env.WA_ERROR_CHAT_ID;
const WA_SESSION_ID = process.env.WA_SESSION_ID || process.env.WAHA_SESSION || "main";
const WA_TARGET_ENV = process.env.WA_TARGET_ENV || "development";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "MuhammadMuhidin";
const GITHUB_REPO = process.env.GITHUB_REPO || "kas-amarta-blok-e";
const GITHUB_WORKFLOW_ID = process.env.GITHUB_WORKFLOW_ID || "send-wa-once.yml";
const GITHUB_WORKFLOW_REF = process.env.GITHUB_WORKFLOW_REF || "development";
const GITHUB_ACTIONS_TOKEN = process.env.GITHUB_ACTIONS_TOKEN;

export function getWhatsAppWorkflowDefaults() {
  return {
    reportChatId: WA_REPORT_CHAT_ID || "",
    alertChatId: WA_ALERT_CHAT_ID || "",
    sessionId: WA_SESSION_ID,
    targetEnv: WA_TARGET_ENV,
    workflowRef: GITHUB_WORKFLOW_REF,
  };
}

export async function triggerWhatsAppWorkflow({
  jobId = randomUUID(),
  chatId,
  message,
  period = "-",
  sessionId = WA_SESSION_ID,
  targetEnv = WA_TARGET_ENV,
  source = "admin",
  mode = "send",
  pairType = "QR",
  phoneNumber = "",
} = {}) {
  if (!GITHUB_ACTIONS_TOKEN) {
    throw new Error("GITHUB_ACTIONS_TOKEN belum dikonfigurasi.");
  }

  if (!chatId && mode === "send") {
    throw new Error("Chat ID WhatsApp belum dikonfigurasi.");
  }

  if (!message && mode === "send") {
    throw new Error("Message WhatsApp belum tersedia.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_ID}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_ACTIONS_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "kas-amarta-blok-e",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: GITHUB_WORKFLOW_REF,
        inputs: {
          mode,
          jobId,
          sessionId,
          targetEnv,
          chatId: chatId || "",
          message: message || "",
          period,
          source,
          pairType,
          phoneNumber,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gagal trigger GitHub Actions (${response.status}): ${detail}`);
  }

  return { ok: true, status: response.status, jobId };
}
