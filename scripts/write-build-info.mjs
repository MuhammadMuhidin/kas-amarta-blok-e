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

const platform = process.env.VERCEL
  ? "vercel"
  : process.env.NETLIFY
    ? "netlify"
    : "local";

const commit =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  safeGit("git rev-parse HEAD") ||
  "unknown";

const branch =
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.BRANCH ||
  process.env.HEAD ||
  safeGit("git rev-parse --abbrev-ref HEAD") ||
  "unknown";

const commitMessage =
  process.env.VERCEL_GIT_COMMIT_MESSAGE ||
  process.env.COMMIT_MESSAGE ||
  safeGit("git log -1 --pretty=%s") ||
  "unknown";

const environment =
  process.env.VERCEL_ENV ||
  process.env.CONTEXT ||
  process.env.NODE_ENV ||
  "unknown";

const deployId =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.DEPLOY_ID ||
  process.env.BUILD_ID ||
  "local";

const deployUrl =
  process.env.VERCEL_URL ||
  process.env.DEPLOY_URL ||
  process.env.URL ||
  "";

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
