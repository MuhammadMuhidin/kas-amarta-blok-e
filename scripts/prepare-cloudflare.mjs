import { spawnSync } from "node:child_process";
import {
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

const mode = process.argv[2];
const allowedModes = new Set(["deploy", "preview"]);
const REQUIRED_QUEUES = [
  "amarta-notification-events",
  "amarta-notification-events-dlq",
];

if (!allowedModes.has(mode)) {
  throw new Error("Usage: node scripts/prepare-cloudflare.mjs <deploy|preview>");
}

const middlewarePath = "middleware.js";
const middlewareBackupPath = ".middleware.cloudflare-disabled.js";
const nextConfigPath = "next.config.js";

let middlewareMoved = false;
let generatedNextConfig = false;

function executable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function runOpenNext(args) {
  const command = executable("opennextjs-cloudflare");
  const result = spawnSync(command, args, {
    env: {
      ...process.env,
      APP_PLATFORM: "cloudflare",
    },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`OpenNext command failed: ${command} ${args.join(" ")}`);
  }
}

function ensureCloudflareQueue(queueName) {
  const command = executable("wrangler");
  const result = spawnSync(command, ["queues", "create", queueName], {
    env: process.env,
    encoding: "utf8",
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  if (result.error) {
    console.warn(`Cloudflare queue check skipped for ${queueName}: ${result.error.message}`);
    return;
  }

  if (result.status === 0) {
    console.log(output || `Cloudflare queue ready: ${queueName}`);
    return;
  }

  if (/already exists|code\s*10003|queue.*exists/i.test(output)) {
    console.log(`Cloudflare queue already exists: ${queueName}`);
    return;
  }

  console.warn(`Unable to create/check Cloudflare queue ${queueName}. Deployment will verify the consumer binding.`);
  if (output) console.warn(output);
}

function prepareCloudflareBuild() {
  if (existsSync(middlewareBackupPath) && !existsSync(middlewarePath)) {
    renameSync(middlewareBackupPath, middlewarePath);
  }

  if (existsSync(middlewareBackupPath)) {
    throw new Error(`Temporary middleware backup already exists: ${middlewareBackupPath}`);
  }

  if (existsSync(middlewarePath)) {
    renameSync(middlewarePath, middlewareBackupPath);
    middlewareMoved = true;
    console.log("Cloudflare build: Next middleware temporarily disabled");
  }

  if (!existsSync(nextConfigPath)) {
    writeFileSync(
      nextConfigPath,
      `/** @type {import("next").NextConfig} */
const nextConfig = {
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };

    return config;
  },
};

module.exports = nextConfig;
`,
    );

    generatedNextConfig = true;
    console.log("Cloudflare build: temporary next.config.js generated");
  }
}

function restoreProjectFiles() {
  if (generatedNextConfig && existsSync(nextConfigPath)) {
    unlinkSync(nextConfigPath);
    console.log("Cloudflare build: temporary next.config.js removed");
  }

  if (middlewareMoved && existsSync(middlewareBackupPath)) {
    renameSync(middlewareBackupPath, middlewarePath);
    console.log("Cloudflare build: Next middleware restored");
  }
}

if (mode === "deploy") {
  for (const queueName of REQUIRED_QUEUES) ensureCloudflareQueue(queueName);
}

try {
  prepareCloudflareBuild();
  runOpenNext(["build"]);
} finally {
  restoreProjectFiles();
}

runOpenNext([mode]);
