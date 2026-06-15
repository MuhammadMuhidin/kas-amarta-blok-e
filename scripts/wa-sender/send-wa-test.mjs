import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import process from "process";

const PHONE_NUMBER = String(process.env.WA_PHONE_NUMBER || "").replace(/\D/g, "");
const DATABASE_URL = process.env.NEONDB_URI || process.env.DATABASE_URL;
const SESSION_ID = process.env.WA_SESSION_ID || "main";
const AUTH_DIR = process.env.AUTH_DIR || "auth";
const JOB_ID = process.env.WA_JOB_ID || "manual";
const CHAT_ID = process.env.WA_CHAT_ID || "";
const MESSAGE_TEXT = process.env.WA_MESSAGE_TEXT || "";
const SOURCE = process.env.WA_SOURCE || "admin-test-whatsapp";
const PERIOD = process.env.WA_PERIOD || "";
const CALLBACK_URL = process.env.WA_CALLBACK_URL || "";
const CALLBACK_TOKEN = process.env.WA_CALLBACK_TOKEN || "";
const CONNECT_TIMEOUT_MS = Number(process.env.WA_CONNECT_TIMEOUT_MS || 180000);

if (!DATABASE_URL) throw new Error("NEONDB_URI wajib diisi.");
if (!CHAT_ID) throw new Error("WA_CHAT_ID wajib diisi.");
if (!MESSAGE_TEXT) throw new Error("WA_MESSAGE_TEXT wajib diisi.");
if (!CALLBACK_URL || !CALLBACK_TOKEN) throw new Error("Callback test WhatsApp belum tersedia.");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
  return String(code || "").match(/.{1,4}/g)?.join("-") || String(code || "");
}

async function emit(status, payload = {}) {
  const event = {
    status,
    sessionId: SESSION_ID,
    ...payload,
    timestamp: new Date().toISOString(),
  };

  console.log(`[${status}]`, payload.message || "");

  try {
    const response = await fetch(CALLBACK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CALLBACK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId: JOB_ID, event }),
    });

    if (!response.ok) {
      console.log(`Callback failed (${response.status}):`, await response.text());
    }
  } catch (error) {
    console.log("Callback failed:", error.message);
  }
}

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
    [JOB_ID, SESSION_ID, CHAT_ID, MESSAGE_TEXT, SOURCE, PERIOD, status, error, JSON.stringify(metadata)],
  );
}

async function uploadAuth() {
  if (!fs.existsSync(AUTH_DIR)) return;
  const data = {};

  for (const file of fs.readdirSync(AUTH_DIR)) {
    const filePath = path.join(AUTH_DIR, file);
    if (!fs.statSync(filePath).isFile()) continue;
    data[file] = fs.readFileSync(filePath).toString("base64");
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
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const result = await pool.query("SELECT data FROM wa_session WHERE id = $1", [SESSION_ID]);
  if (!result.rows.length) return 0;

  const data = typeof result.rows[0].data === "string"
    ? JSON.parse(result.rows[0].data)
    : result.rows[0].data;
  let restored = 0;

  for (const [file, value] of Object.entries(data || {})) {
    fs.writeFileSync(path.join(AUTH_DIR, file), Buffer.from(value, "base64"));
    restored += 1;
  }

  return restored;
}

async function clearAuth() {
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await pool.query("DELETE FROM wa_session WHERE id = $1", [SESSION_ID]);
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    browser: ["Ubuntu", "Chrome", "120.0.0"],
    printQRInTerminal: false,
    logger: silentLogger,
  });

  sock.ev.on("creds.update", async () => {
    await saveCreds();
    await uploadAuth();
  });

  const connectionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout menunggu koneksi WhatsApp."));
    }, CONNECT_TIMEOUT_MS);

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        clearTimeout(timeout);
        resolve(sock);
      }

      if (connection === "close") {
        clearTimeout(timeout);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const error = new Error(
          statusCode === DisconnectReason.loggedOut
            ? "SESSION_LOGGED_OUT"
            : "Koneksi WhatsApp terputus sebelum siap.",
        );
        error.statusCode = statusCode;
        reject(error);
      }
    });
  });

  if (!state.creds.registered) {
    if (!PHONE_NUMBER) throw new Error("Nomor WhatsApp wajib diisi untuk membuat pairing code.");
    await emit("PAIRING_REQUESTED", {
      message: "Session WhatsApp memerlukan pairing ulang.",
    });
    const code = await sock.requestPairingCode(PHONE_NUMBER);
    await emit("PAIRING_CODE", {
      code: formatPairingCode(code),
      message: "Masukkan pairing code melalui aplikasi WhatsApp.",
    });
  }

  return connectionPromise;
}

async function connectWithRecovery() {
  try {
    return await connect();
  } catch (error) {
    if (error.message !== "SESSION_LOGGED_OUT") throw error;

    await emit("SESSION_LOGGED_OUT", {
      message: "Session WhatsApp tidak lagi valid. Pairing ulang dimulai.",
    });
    await clearAuth();
    return connect();
  }
}

async function getTargetName(sock) {
  if (!CHAT_ID.endsWith("@g.us")) return "personal chat";
  try {
    const metadata = await sock.groupMetadata(CHAT_ID);
    return metadata?.subject || "group chat";
  } catch {
    return "group chat";
  }
}

async function close(sock) {
  try { await uploadAuth(); } catch {}
  try { sock?.ws?.close?.(); } catch {}
  try { sock?.end?.(); } catch {}
  try { await pool.end(); } catch {}
}

let socket = null;
try {
  await ensureTables();
  await saveJob("running", "", { startedAt: new Date().toISOString(), pairType: "CODE", mode: "SEND" });
  await emit("STARTED", { message: "Memulai pengujian WhatsApp." });

  const restored = await downloadAuth();
  await emit("AUTH_RESTORED", {
    restoredFiles: restored,
    message: restored > 0
      ? `Session WhatsApp dimuat (${restored} file autentikasi).`
      : "Session WhatsApp belum tersedia.",
  });

  socket = await connectWithRecovery();
  await emit("CONNECTED", { message: "WhatsApp berhasil terhubung." });

  const targetName = await getTargetName(socket);
  await socket.sendMessage(CHAT_ID, { text: MESSAGE_TEXT });
  await uploadAuth();
  await saveJob("sent", "", { sentAt: new Date().toISOString(), targetName });
  await emit("SENT", {
    targetName,
    message: `Pesan uji berhasil dikirim ke ${targetName}.`,
  });
  await close(socket);
  process.exit(0);
} catch (error) {
  const message = error?.message || "Gagal mengirim WhatsApp.";
  try { await saveJob("failed", message, { failedAt: new Date().toISOString() }); } catch {}
  await emit("FAILED", { message });
  await close(socket);
  process.exit(1);
}
