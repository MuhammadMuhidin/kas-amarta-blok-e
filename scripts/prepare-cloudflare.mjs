import { spawnSync } from "node:child_process";
import {
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

const mode = process.argv[2];
const allowedModes = new Set(["deploy", "preview"]);

if (!allowedModes.has(mode)) {
  throw new Error("Usage: node scripts/prepare-cloudflare.mjs <deploy|preview>");
}

const middlewarePath = "middleware.js";
const middlewareBackupPath = ".middleware.cloudflare-disabled.js";
const nextConfigPath = "next.config.js";

let middlewareMoved = false;
let generatedNextConfig = false;

function runOpenNext(args) {
  const command = process.platform === "win32"
    ? "opennextjs-cloudflare.cmd"
    : "opennextjs-cloudflare";

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

try {
  prepareCloudflareBuild();
  runOpenNext(["build"]);
} finally {
  restoreProjectFiles();
}

runOpenNext([mode]);
