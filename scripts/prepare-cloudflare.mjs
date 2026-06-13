import { existsSync, writeFileSync } from "node:fs";

const nextConfigPath = "next.config.js";

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

  console.log("Generated Cloudflare-only next.config.js");
} else {
  console.log("Existing next.config.js detected; leaving it unchanged");
}
