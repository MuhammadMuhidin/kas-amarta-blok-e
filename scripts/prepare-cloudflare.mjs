import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

const mode = process.argv[2];
const allowedModes = new Set(["deploy", "preview"]);

if (!allowedModes.has(mode)) {
  throw new Error("Usage: node scripts/prepare-cloudflare.mjs <deploy|preview>");
}

function clean(value) {
  return String(value || "").trim();
}

function firstValue(...values) {
  return values.find((value) => clean(value)) || "";
}

function localGitBranch() {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
  });

  return result.status === 0 ? clean(result.stdout) : "";
}

function normalizeBranch(value) {
  return clean(value)
    .replace(/^refs\/heads\//, "")
    .replace(/^origin\//, "");
}

const deploymentBranch = normalizeBranch(
  firstValue(
    process.env.WORKERS_CI_BRANCH,
    process.env.CF_PAGES_BRANCH,
    process.env.VERCEL_GIT_COMMIT_REF,
    process.env.BRANCH,
    process.env.GIT_BRANCH,
    localGitBranch(),
  ),
);

const explicitEnvironment = clean(
  firstValue(process.env.APP_ENV, process.env.NEXT_PUBLIC_APP_ENV),
).toLowerCase();

const isProduction = deploymentBranch
  ? deploymentBranch === "main"
  : ["production", "prod"].includes(explicitEnvironment);

const queueNames = isProduction
  ? {
      events: "amarta-notification-events",
      deadLetter: "amarta-notification-events-dlq",
    }
  : {
      events: "amarta-notification-events-development",
      deadLetter: "amarta-notification-events-development-dlq",
    };

const REQUIRED_QUEUES = [queueNames.events, queueNames.deadLetter];
const middlewarePath = "middleware.js";
const middlewareBackupPath = ".middleware.cloudflare-disabled.js";
const nextConfigPath = "next.config.js";
const wranglerConfigPath = "wrangler.jsonc";

let middlewareMoved = false;
let generatedNextConfig = false;
let originalWranglerConfig = null;

console.log("Cloudflare deployment target:", {
  branch: deploymentBranch || "unknown",
  environment: isProduction ? "production" : "development",
  queue: queueNames.events,
  deadLetterQueue: queueNames.deadLetter,
});

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

function configureCloudflareQueues() {
  if (!existsSync(wranglerConfigPath)) {
    throw new Error(`Wrangler config tidak ditemukan: ${wranglerConfigPath}`);
  }

  originalWranglerConfig = readFileSync(wranglerConfigPath, "utf8");
  const updatedConfig = originalWranglerConfig
    .replace(
      /("queue"\s*:\s*)"amarta-notification-events(?:-development)?"/,
      `$1"${queueNames.events}"`,
    )
    .replace(
      /("dead_letter_queue"\s*:\s*)"amarta-notification-events(?:-development)?-dlq"/,
      `$1"${queueNames.deadLetter}"`,
    );

  if (!updatedConfig.includes(`"queue": "${queueNames.events}"`)) {
    throw new Error(`Queue consumer tidak dapat dikonfigurasi ke ${queueNames.events}`);
  }

  if (!updatedConfig.includes(`"dead_letter_queue": "${queueNames.deadLetter}"`)) {
    throw new Error(`Dead-letter queue tidak dapat dikonfigurasi ke ${queueNames.deadLetter}`);
  }

  if (updatedConfig !== originalWranglerConfig) {
    writeFileSync(wranglerConfigPath, updatedConfig);
  }
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
  if (originalWranglerConfig !== null && existsSync(wranglerConfigPath)) {
    writeFileSync(wranglerConfigPath, originalWranglerConfig);
  }

  if (generatedNextConfig && existsSync(nextConfigPath)) {
    unlinkSync(nextConfigPath);
    console.log("Cloudflare build: temporary next.config.js removed");
  }

  if (middlewareMoved && existsSync(middlewareBackupPath)) {
    renameSync(middlewareBackupPath, middlewarePath);
    console.log("Cloudflare build: Next middleware restored");
  }
}

try {
  configureCloudflareQueues();

  if (mode === "deploy") {
    for (const queueName of REQUIRED_QUEUES) ensureCloudflareQueue(queueName);
  }

  prepareCloudflareBuild();
  runOpenNext(["build"]);
  runOpenNext([mode]);
} finally {
  restoreProjectFiles();
}
