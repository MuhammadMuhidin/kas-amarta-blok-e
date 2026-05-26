import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function safeGit(command) {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function firstValue(...values) {
  return values.find((value) => String(value || "").trim()) || null;
}

function detectPlatform() {
  if (process.env.RENDER) return "render";
  if (process.env.VERCEL) return "vercel";
  if (process.env.NETLIFY) return "netlify";

  return firstValue(process.env.APP_ENV, process.env.NEXT_PUBLIC_APP_ENV) || "local";
}

const platform = detectPlatform();

const commit =
  firstValue(
    process.env.RENDER_GIT_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.COMMIT_REF,
    process.env.GIT_COMMIT,
  ) ||
  safeGit("git rev-parse HEAD") ||
  "unknown";

const branch =
  firstValue(
    process.env.RENDER_GIT_BRANCH,
    process.env.VERCEL_GIT_COMMIT_REF,
    process.env.BRANCH,
    process.env.HEAD,
    process.env.GIT_BRANCH,
  ) ||
  safeGit("git rev-parse --abbrev-ref HEAD") ||
  "unknown";

const commitMessage =
  firstValue(
    process.env.VERCEL_GIT_COMMIT_MESSAGE,
    process.env.COMMIT_MESSAGE,
    process.env.RENDER_GIT_COMMIT_MESSAGE,
  ) ||
  safeGit("git log -1 --pretty=%s") ||
  "unknown";

const environment =
  firstValue(
    process.env.APP_ENV,
    process.env.NEXT_PUBLIC_APP_ENV,
    process.env.VERCEL_ENV,
    process.env.CONTEXT,
    process.env.NODE_ENV,
  ) || "unknown";

const deployId =
  firstValue(
    process.env.RENDER_SERVICE_ID,
    process.env.VERCEL_DEPLOYMENT_ID,
    process.env.DEPLOY_ID,
    process.env.BUILD_ID,
  ) || "local";

const deployUrl =
  firstValue(
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL,
    process.env.DEPLOY_URL,
    process.env.URL,
  ) || "";

const buildInfo = {
  platform,
  branch,
  commit,
  commitShort: commit === "unknown" ? "unknown" : commit.slice(0, 7),
  commitMessage,
  environment,
  deployId,
  deployUrl,
  buildTime: new Date().toISOString(),
};

const outputDir = path.join(process.cwd(), "lib", "generated");
const outputPath = path.join(outputDir, "build-info.json");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`);

console.log("Build info generated:", buildInfo);
