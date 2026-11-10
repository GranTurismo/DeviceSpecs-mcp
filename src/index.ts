#!/usr/bin/env node
import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DeviceSpecsApi, loadConfig } from "./api.js";
import { createServer } from "./server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main(): Promise<void> {
  const cfg = loadConfig();
  const api = new DeviceSpecsApi(cfg);
  const server = createServer(version, api);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[devicespecs-mcp] v${version} ready on stdio (gateway: ${cfg.baseUrl}${cfg.apiKey ? ", key set" : cfg.usingDefaultGateway ? ", NO KEY: set DEVICESPECS_API_KEY" : ", no key"})`,
  );
}

main().catch((err) => {
  console.error(`[devicespecs-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
