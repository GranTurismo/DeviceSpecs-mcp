// Dev-only smoke test: spawns the built server over stdio and exercises every tool.
// Usage: DEVICESPECS_BASE_URL=https://dsapi.gtgroup.dev/ node scripts/smoke.mjs
// Any stdio server with the same tool contract can be tested, e.g. the .NET build:
//   MCP_COMMAND=dotnet MCP_ARGS='["dotnet/DeviceSpecs.Mcp/bin/Release/net10.0/devicespecs-mcp.dll"]' node scripts/smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const baseUrl = process.env.DEVICESPECS_BASE_URL || "https://dsapi.gtgroup.dev/";
let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
  if (!cond) failures++;
};

async function withClient(env, fn) {
  const transport = new StdioClientTransport({
    command: process.env.MCP_COMMAND || process.execPath,
    args: process.env.MCP_ARGS ? JSON.parse(process.env.MCP_ARGS) : ["dist/index.js"],
    env: { ...process.env, ...env },
    stderr: "pipe",
  });
  const client = new Client({ name: "smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

const parse = (res) => {
  const text = res.content?.find((c) => c.type === "text")?.text ?? "";
  try {
    return { json: JSON.parse(text), isError: !!res.isError, structured: res.structuredContent };
  } catch {
    return { json: null, isError: !!res.isError, text };
  }
};

await withClient({ DEVICESPECS_BASE_URL: baseUrl, DEVICESPECS_API_KEY: "" }, async (client) => {
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  check("lists 7 tools", names.length === 7, names.join(", "));

  const resources = await client.listResources();
  check("lists filter resource", resources.resources.some((r) => r.uri === "devicespecs://filters"));
  const resource = await client.readResource({ uri: "devicespecs://filters" });
  check("resource is markdown", (resource.contents?.[0]?.text ?? "").startsWith("# Device Specs API"));

  let r = parse(await client.callTool({ name: "list_filter_properties", arguments: {} }));
  check("list_filter_properties", !r.isError && r.json?.operators?.length === 9 && r.json?.categories?.length >= 10, `${r.json?.operators?.length} operators, ${r.json?.categories?.length} categories`);

  r = parse(await client.callTool({ name: "get_phone_specs", arguments: { manufacturer: "Google", model: "Pixel 9 Pro" } }));
  check("get_phone_specs full", !r.isError && r.json?.found === true && r.json?.device?.model === "Pixel 9 Pro", r.json?.device?.chipset);
  check("get_phone_specs cleans entities", !JSON.stringify(r.json).includes("&amp;") && !JSON.stringify(r.json).includes("<sup>"));

  r = parse(await client.callTool({ name: "get_phone_specs", arguments: { manufacturer: "Google", model: "Pixel 9 Pro", compact: true } }));
  check("get_phone_specs compact", !r.isError && r.json?.device?.refresh_rate_hz === 120 && Array.isArray(r.json?.device?.ram_gb), JSON.stringify(r.json?.device).slice(0, 160));

  r = parse(await client.callTool({ name: "get_phone_specs", arguments: { manufacturer: "Google", model: "Pixel 99 Ultra" } }));
  check("get_phone_specs not found", !r.isError && r.json?.found === false);

  r = parse(await client.callTool({ name: "search_phones", arguments: { filters: { ram_gte: 16, refresh_rate_gte: 144 }, limit: 5 } }));
  check("search_phones", !r.isError && r.json?.returned === 5 && r.json?.total >= 5, `total=${r.json?.total} first=${r.json?.devices?.[0]?.manufacturer} ${r.json?.devices?.[0]?.model}`);

  r = parse(await client.callTool({ name: "search_phones", arguments: { filters: {} } }));
  check("search_phones rejects empty filters", r.isError === true);

  r = parse(await client.callTool({ name: "list_phones_by_manufacturer", arguments: { manufacturer: "Google", limit: 10, offset: 5 } }));
  check("list_phones_by_manufacturer", !r.isError && r.json?.returned === 10 && r.json?.total > 15, `total=${r.json?.total}`);

  r = parse(await client.callTool({ name: "list_phones_by_chipset", arguments: { chipset: "Google Tensor G4", limit: 10 } }));
  check("list_phones_by_chipset", !r.isError && r.json?.returned > 0, `returned=${r.json?.returned} total=${r.json?.total}`);

  r = parse(await client.callTool({ name: "lookup_model_number", arguments: { model_number: "SM-S928B", compact: true } }));
  check("lookup_model_number", !r.isError && r.json?.found === true && r.json?.model === "Galaxy S24 Ultra" && r.json?.device?.model === "Galaxy S24 Ultra", r.json?.chipset);

  r = parse(await client.callTool({ name: "compare_phones", arguments: { phones: [{ manufacturer: "Google", model: "Pixel 9 Pro" }, { manufacturer: "Samsung", model: "Galaxy S24 Ultra" }] } }));
  check("compare_phones", !r.isError && r.json?.devices?.length === 2 && Object.keys(r.json?.differences ?? {}).length > 3, `differs on: ${Object.keys(r.json?.differences ?? {}).join(", ")}`);
});

// No-key error path against the default RapidAPI gateway.
await withClient({ DEVICESPECS_BASE_URL: "", DEVICESPECS_API_KEY: "" }, async (client) => {
  const r = parse(await client.callTool({ name: "get_phone_specs", arguments: { manufacturer: "Google", model: "Pixel 9 Pro" } }));
  check("no-key path returns isError with key URL", r.isError === true && JSON.stringify(r.json).includes("rapidapi.com/controller2042000"), r.json?.error?.slice(0, 80));
  const ref = parse(await client.callTool({ name: "list_filter_properties", arguments: {} }));
  check("list_filter_properties works without key", !ref.isError);
});

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
