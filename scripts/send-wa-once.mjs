import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import process from "process";
import { randomUUID } from "crypto";

const PHONE_NUMBER = process.env.PHONE_NUMBER || process.env.WA_PHONE_NUMBER;
const PAIR_TYPE = String(process.env.PAIR_TYPE || process.env.WA_PAIR_TYPE || "QR").trim().toUpperCase();
const DATABASE_URL = process.env.NEONDB_URI || process.env.DATABASE_URL;
const SESSION_ID = process.env.WA_SESSION_ID || process.env.SESSION_ID || "main";
const AUTH_DIR = process.env.AUTH_DIR || "auth";
const JOB_ID = process.env.WA_JOB_ID || randomUUID();
const CHAT_ID = process.env.WA_CHAT_ID;
const MESSAGE_TEXT = process.env.WA_MESSAGE_TEXT;
const SOURCE = process.env.WA_SOURCE || "github-actions";
const PERIOD = process.env.WA_PERIOD || "";
const CONNECT_TIMEOUT_MS = Number(process.env.WA_CONNECT_TIMEOUT_MS || 180000);
const AFTER_CONNECT_WAIT_MS = Number(process.env.WA_AFTER_CONNECT_WAIT_MS || 2500);
const MODE = String(process.env.WA_MODE || "SEND").trim().toUpperCase().replace(/-/g, "_");
const isListGroupsMode = MODE === "LIST_GROUPS";

if (!DATABASE_URL) throw new Error("NEONDB_URI wajib diisi.");
if (!["SEND", "LIST_GROUPS"].includes(MODE)) throw new Error("WA_MODE hanya boleh SEND atau LIST_GROUPS.");
if (!isListGroupsMode && !CHAT_ID) throw new Error("WA_CHAT_ID wajib diisi.");
if (!isListGroupsMode && !MESSAGE_TEXT) throw new Error("WA_MESSAGE_TEXT wajib diisi.");
if (!["QR", "CODE"].includes(PAIR_TYPE)) throw new Error("PAIR_TYPE/WA_PAIR_TYPE hanya boleh QR atau CODE.");
if (PAIR_TYPE === "CODE" && !PHONE_NUMBER) throw new Error("PHONE_NUMBER/WA_PHONE_NUMBER wajib diisi untuk PAIR_TYPE=CODE.");

let sock = null;
let isConnected = false;
let isPairingRequested = false;
let shouldReconnect = true;
let shouldExit = false;

let lastConnectedAt = null;
let lastDisconnectAt = null;
let isLoggedOut = false;
let requiresRePair = false;

let uploadTimer = null;
let reconnectTimer = null;
let isUploading = false;
let connectResolve = null;
let connectReject = null;
let connectTimeout = null;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_session (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_send_jobs (
      job_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT,
      period TEXT,
      status TEXT NOT NULL,
      error TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function saveJob(status, error = "", metadata = {}) {
  await pool.query(
    `
    INSERT INTO wa_send_jobs (job_id, session_id, chat_id, message, source, period, status, error, metadata, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9::jsonb, NOW())
    ON CONFLICT (job_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      error = EXCLUDED.error,
      metadata = wa_send_jobs.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    `,
    [JOB_ID, SESSION_ID, CHAT_ID || "", MESSAGE_TEXT || "", SOURCE, PERIOD, status, error, JSON.stringify(metadata)],
  );
}

async function uploadAuth() {
  if (!fs.existsSync(AUTH_DIR)) return;

  const files = fs.readdirSync(AUTH_DIR);
  const data = {};

  for (const file of files) {
    const filePath = path.join(AUTH_DIR, file);
    if (!fs.statSync(filePath).isFile()) continue;

    const content = fs.readFileSync(filePath);
    data[file] = content.toString("base64");
  }

  await pool.query(
    `
    INSERT INTO wa_session (id, data)
    VALUES ($1, $2)
    ON CONFLICT (id)
    DO UPDATE SET data = $2, updated_at = NOW()
    `,
    [SESSION_ID, JSON.stringify(data)],
  );
}

async function downloadAuth() {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR);
    }

    const result = await pool.query("SELECT data FROM wa_session WHERE id = $1", [SESSION_ID]);

    if (result.rows.length === 0) {
      console.log("No existing auth in DB");
      return 0;
    }

    const data = typeof result.rows[0].data === "string" ? JSON.parse(result.rows[0].data) : result.rows[0].data;
    let restored = 0;

    for (const file in data) {
      const buffer = Buffer.from(data[file], "base64");
      fs.writeFileSync(path.join(AUTH_DIR, file), buffer);
      restored += 1;
    }

    return restored;
  } catch (err) {
    console.log("DB restore failed:", err.message);
    return 0;
  }
}

function scheduleUpload() {
  if (shouldExit || uploadTimer) return;

  uploadTimer = setTimeout(async () => {
    if (isUploading) return;

    try {
      isUploading = true;
      await uploadAuth();
    } catch (err) {
      console.log("Upload failed:", err.message);
    } finally {
      isUploading = false;
      uploadTimer = null;
    }
  }, 8000);
}

const silentLogger = {
  level: "silent",
  child() { return this; },
  info() {},
  error() {},
  warn() {},
  debug() {},
  trace() {},
  fatal() {},
};

function formatPairingCode(code) {
  return String(code || "").match(/.{1,4}/g)?.join("-") || code;
}

function finishConnect() {
  if (connectTimeout) clearTimeout(connectTimeout);
  connectTimeout = null;
  connectResolve?.();
  connectResolve = null;
  connectReject = null;
}

function failConnect(err) {
  if (connectTimeout) clearTimeout(connectTimeout);
  connectTimeout = null;
  connectReject?.(err);
  connectResolve = null;
  connectReject = null;
}

function handleConnectionUpdate(connection, lastDisconnect, reconnectFn) {
  if (connection === "open") {
    isConnected = true;
    isLoggedOut = false;
    requiresRePair = false;
    lastConnectedAt = Date.now();
    finishConnect();
  }

  if (connection === "close") {
    isConnected = false;
    lastDisconnectAt = Date.now();

    const status = lastDisconnect?.error?.output?.statusCode;

    if (status === DisconnectReason.loggedOut) {
      isLoggedOut = true;
      requiresRePair = true;
      console.log("Device unpaired (logged out)");
      failConnect(new Error("Device unpaired (logged out). Pairing ulang diperlukan."));
      return;
    }

    if (!shouldReconnect || shouldExit) return;

    reconnectTimer = setTimeout(reconnectFn, 3000);
  }
}

function waitUntilConnected() {
  if (isConnected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    connectResolve = resolve;
    connectReject = reject;
    connectTimeout = setTimeout(() => {
      reject(new Error("Timeout menunggu koneksi WhatsApp. Jika QR/code sudah muncul, selesaikan pairing lalu jalankan ulang jika pesan belum terkirim."));
    }, CONNECT_TIMEOUT_MS);
  });
}

async function initWithCode() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    browser: ["Ubuntu", "Chrome", "120.0.0"],
    printQRInTerminal: false,
    logger: silentLogger,
  });

  sock.ev.on("creds.update", async () => {
    await saveCreds();
    scheduleUpload();
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    handleConnectionUpdate(connection, lastDisconnect, initWithCode);
  });

  if (!state.creds.registered && !isPairingRequested) {
    isPairingRequested = true;

    setTimeout(async () => {
      if (shouldExit) return;
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log("Pairing code:", formatPairingCode(code));
      } catch (err) {
        isPairingRequested = false;
        console.log("Pairing code failed:", err.message);
      }
    }, 5000);
  }
}

async function initWithQR() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    browser: ["Windows", "Chrome", "120.0.0"],
    logger: silentLogger,
  });

  sock.ev.on("creds.update", async () => {
    await saveCreds();
    scheduleUpload();
  });

  sock.ev.on("connection.update", ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      console.log("QR pairing muncul. Scan dari WhatsApp > Perangkat tertaut > Tautkan perangkat.");
      qrcode.generate(qr, { small: true });
    }

    handleConnectionUpdate(connection, lastDisconnect, initWithQR);
  });
}

function assertReadyToSend() {
  if (!sock || !isConnected) {
    throw new Error("WhatsApp belum connected.");
  }

  if (requiresRePair || isLoggedOut) {
    throw new Error("Session WhatsApp perlu pairing ulang.");
  }
}

async function getChatDisplayName() {
  if (!String(CHAT_ID || "").endsWith("@g.us")) {
    return "personal chat";
  }

  try {
    const metadata = await sock.groupMetadata(CHAT_ID);
    return metadata?.subject || "group chat";
  } catch {
    return "group chat";
  }
}

async function sendMessage() {
  assertReadyToSend();
  const targetName = await getChatDisplayName();
  await sock.sendMessage(CHAT_ID, { text: MESSAGE_TEXT });
  console.log(`sent to ${targetName}`);
}

async function listGroups() {
  assertReadyToSend();

  const groups = await sock.groupFetchAllParticipating();

  Object.values(groups)
    .sort((a, b) => String(a.subject || "").localeCompare(String(b.subject || ""), "id-ID"))
    .forEach((group) => {
      console.log(`${group.id} ${group.subject || ""}`.trim());
    });
}

async function closeResources() {
  shouldExit = true;
  shouldReconnect = false;

  if (uploadTimer) clearTimeout(uploadTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (connectTimeout) clearTimeout(connectTimeout);

  uploadTimer = null;
  reconnectTimer = null;
  connectTimeout = null;

  try {
    await uploadAuth();
  } catch {}

  try {
    sock?.ws?.close?.();
  } catch {}

  try {
    sock?.end?.();
  } catch {}

  try {
    await pool.end();
  } catch {}
}

async function start() {
  await ensureTables();

  if (!isListGroupsMode) {
    await saveJob("running", "", { startedAt: new Date().toISOString(), pairType: PAIR_TYPE, mode: MODE });
  }

  const restored = await downloadAuth();
  console.log(`Auth restored from DB: ${restored} file(s)`);
  console.log(`Pair type: ${PAIR_TYPE}`);
  console.log(`Mode: ${MODE}`);

  if (PAIR_TYPE === "CODE") {
    await initWithCode();
  } else {
    await initWithQR();
  }

  await waitUntilConnected();
  await new Promise((resolve) => setTimeout(resolve, AFTER_CONNECT_WAIT_MS));

  if (isListGroupsMode) {
    await listGroups();
    await uploadAuth();
    return;
  }

  await sendMessage();
  await uploadAuth();

  await saveJob("sent", "", {
    sentAt: new Date().toISOString(),
    lastConnectedAt,
    lastDisconnectAt,
  });
}

try {
  await start();
  await closeResources();
  process.exit(0);
} catch (err) {
  const message = err?.message || "Gagal mengirim WhatsApp.";
  console.log("send error:", message);

  if (!isListGroupsMode) {
    try {
      await saveJob("failed", message, { failedAt: new Date().toISOString(), pairType: PAIR_TYPE, mode: MODE });
    } catch {}
  }

  await closeResources();
  process.exit(1);
}
