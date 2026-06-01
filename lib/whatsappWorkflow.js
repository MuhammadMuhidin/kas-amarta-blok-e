import { randomUUID } from "crypto";

const WA_CHAT_ID = process.env.WA_CHAT_ID || process.env.WAHA_CHAT_ID;
const WA_SESSION_ID = process.env.WA_SESSION_ID || process.env.WAHA_SESSION || "main";
const WA_TARGET_ENV = process.env.WA_TARGET_ENV || "development";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "MuhammadMuhidin";
const GITHUB_REPO = process.env.GITHUB_REPO || "kas-amarta-blok-e";
const GITHUB_WORKFLOW_ID = process.env.GITHUB_WORKFLOW_ID || "send-wa-once.yml";
const GITHUB_WORKFLOW_REF = process.env.GITHUB_WORKFLOW_REF || "development";
const GITHUB_ACTIONS_TOKEN = process.env.GITHUB_ACTIONS_TOKEN;

export function getWhatsAppWorkflowDefaults() {
  return {
    chatId: WA_CHAT_ID || "",
    sessionId: WA_SESSION_ID,
    targetEnv: WA_TARGET_ENV,
    workflowRef: GITHUB_WORKFLOW_REF,
  };
}

export async function triggerWhatsAppWorkflow({
  jobId = randomUUID(),
  chatId = WA_CHAT_ID,
  message,
  period = "-",
  sessionId = WA_SESSION_ID,
  targetEnv = WA_TARGET_ENV,
  source = "admin",
} = {}) {
  if (!GITHUB_ACTIONS_TOKEN) {
    throw new Error("GITHUB_ACTIONS_TOKEN belum dikonfigurasi.");
  }

  if (!chatId) {
    throw new Error("WA_CHAT_ID belum dikonfigurasi.");
  }

  if (!message) {
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
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: GITHUB_WORKFLOW_REF,
        inputs: {
          jobId,
          sessionId,
          targetEnv,
          chatId,
          message,
          period,
          source,
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
