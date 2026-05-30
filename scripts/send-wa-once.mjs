import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import Pino from "pino";

const AUTH_DIR = path.resolve(process.cwd(), ".wa-auth");
const DATABASE_URL = process.env.NEONDB_URI || process.env.DATABASE_URL;
const JOB_ID = process.env.WA_JOB_ID || randomUUID();
const SESSION_ID = process.env.WA_SESSION_ID || "amarta-main";
const CHAT_ID = process.env.WA_CHAT_ID;
const MESSAGE_TEXT = process.env.WA_MESSAGE_TEXT;
const SOURCE = process.env.WA_SOURCE || "github-actions";
const PERIOD = process.env.WA_PERIOD || "";
const CONNECT_TIMEOUT_MS = Number(process.env.WA_CONNECT_TIMEOUT_MS || 180000);

if (!DATABASE_URL) throw new Error("NEONDB_URI atau DATABASE_URL wajib diisi.");
if (!CHAT_ID) throw new Error("WA_CHAT_ID wajib diisi.");
if (!MESSAGE_TEXT) throw new Error("WA_MESSAGE_TEXT wajib diisi.");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_baileys_auth (
      session_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (session_id, file_path)
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

function toSafeRelativePath(value) {
  const normalized = path.normalize(String(value || "")).replace(/^([/\\])+/, "");
  if (!normalized || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error(`Path auth tidak aman: ${value}`);
  }
  return normalized;
}

async function restoreAuth() {
  await fs.rm(AUTH_DIR, { recursive: true, force: true });
  await fs.mkdir(AUTH_DIR, { recursive: true });

  const result = await pool.query(
    "SELECT file_path, data_base64 FROM wa_baileys_auth WHERE session_id = $1",
    [SESSION_ID],
  );

  for (const row of result.rows) {
    const relativePath = toSafeRelativePath(row.file_path);
    const targetPath = path.join(AUTH_DIR, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, Buffer.from(row.data_base64, "base64"));
  }

  return result.rowCount;
}

async function listFiles(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath, baseDir)));
    if (entry.isFile()) {
      files.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath).split(path.sep).join("/"),
      });
    }
  }

  return files;
}

async function saveAuth() {
  const files = await listFiles(AUTH_DIR);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM wa_baileys_auth WHERE session_id = $1", [SESSION_ID]);

    for (const file of files) {
      const data = await fs.readFile(file.fullPath);
      await client.query(
        "INSERT INTO wa_baileys_auth (session_id, file_path, data_base64, updated_at) VALUES ($1, $2, $3, NOW())",
        [SESSION_ID, file.relativePath, data.toString("base64")],
      );
    }

    await client.query("COMMIT");
    return files.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    browser: ["Amarta WA Bot", "Chrome", "1.0.0"],
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout menunggu koneksi WhatsApp. Jika QR muncul, scan QR lalu jalankan ulang jika pesan belum terkirim.")), CONNECT_TIMEOUT_MS);

    sock.ev.on("connection.update", (update) => {
      if (update.qr) {
        console.log("QR pairing muncul di log ini. Buka WhatsApp > Perangkat tertaut > Tautkan perangkat, lalu scan QR tersebut.");
      }

      if (update.connection === "open") {
        clearTimeout(timeout);
        resolve();
      }

      if (update.connection === "close") {
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === 401) {
          clearTimeout(timeout);
          reject(new Error("Session WhatsApp logout. Pairing ulang diperlukan."));
        }
      }
    });
  });

  return { sock, saveCreds };
}

async function main() {
  try {
    await ensureTables();
    await saveJob("running", "", { startedAt: new Date().toISOString() });

    const restoredFiles = await restoreAuth();
    console.log(`Auth restored: ${restoredFiles} file(s)`);

    const { sock, saveCreds } = await connect();
    await sock.sendMessage(CHAT_ID, { text: MESSAGE_TEXT });
    await wait(2500);
    await saveCreds();

    const savedFiles = await saveAuth();
    await saveJob("sent", "", { sentAt: new Date().toISOString(), savedAuthFiles: savedFiles });

    sock.end?.();
    await pool.end();
  } catch (err) {
    const message = err?.message || "Gagal mengirim WhatsApp.";
    console.error(message);
    try {
      await saveJob("failed", message, { failedAt: new Date().toISOString() });
    } finally {
      await pool.end();
    }
    process.exitCode = 1;
  }
}

await main();
