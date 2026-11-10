import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DeviceSpecsApi, DeviceSpecsApiError, MissingApiKeyError, GET_KEY_URL } from "./api.js";
import { filterReference, filterReferenceMarkdown } from "./filters.js";
import { cleanDeep, differences, toCompact, type ApiDevice, type CompactDevice } from "./projection.js";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function ok(result: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
}

function fail(message: string, extra?: Record<string, unknown>): ToolResult {
  const payload = { error: message, ...(extra ?? {}) };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

function describeError(err: unknown): ToolResult {
  if (err instanceof MissingApiKeyError) {
    return fail(err.message, { get_key_url: GET_KEY_URL, env: ["DEVICESPECS_API_KEY", "DEVICESPECS_BASE_URL", "DEVICESPECS_API_HOST"] });
  }
  if (err instanceof DeviceSpecsApiError) {
    return fail(err.message, { http_status: err.status, body: err.body.slice(0, 500) });
  }
  const msg = err instanceof Error ? err.message : String(err);
  return fail(`Unexpected error: ${msg}`);
}

function project(devices: ApiDevice[], compact: boolean): (CompactDevice | ApiDevice)[] {
  return compact ? devices.map(toCompact) : devices.map((d) => cleanDeep(d));
}

const compactParam = (def: boolean) =>
  z.boolean().default(def).describe(
    def
      ? "true (default) returns a short projection of ~20 key fields per phone to save tokens; false returns the full raw API JSON."
      : "false (default) returns the full raw API JSON (raw spec strings, cameras, sensors, variants, normalized_specs); true returns a short projection of ~20 key fields.",
  );

const limitParam = (def: number) =>
  z.number().int().min(1).max(200).default(def).describe(`Maximum number of phones to return (1-200, default ${def}).`);

const offsetParam = z.number().int().min(0).default(0).describe("Number of phones to skip, for paging through large result sets.");

const filterValue = z.union([z.string(), z.number(), z.boolean()]);

export function createServer(version: string, api: DeviceSpecsApi = new DeviceSpecsApi()): McpServer {
  const server = new McpServer(
    { name: "devicespecs", version },
    {
      instructions: [
        "Device Specs API: normalized hardware specifications for 10,000+ smartphones (Apple, Samsung, Google, Xiaomi, OnePlus, vivo, Oppo, Motorola, Sony, Nothing and 25+ more brands, 1995 to today).",
        "Use get_phone_specs when the user names a phone. Use search_phones to find phones by hardware criteria; call list_filter_properties first if unsure which filter keys exist.",
        "Model names must match the catalog spelling (e.g. 'Galaxy S24 Ultra', 'iPhone 15 Pro', 'Pixel 9 Pro'); if a lookup returns not_found, try list_phones_by_manufacturer and pick the closest model, or lookup_model_number for codes like SM-S928B.",
        "Prices (price_usd) are launch prices and are only known for a subset of phones; 0 or null means unknown.",
      ].join(" "),
    },
  );

  server.registerTool(
    "get_phone_specs",
    {
      title: "Get phone specifications",
      description:
        "Return the specification sheet for one smartphone by manufacturer and model name. Includes display (size, panel, refresh rate, brightness), chipset/CPU/GPU, RAM and storage options, battery capacity and charging, cameras, dimensions and weight, IP rating, connectivity (NFC, Bluetooth, USB, Wi-Fi), sound, benchmark scores, EU energy label, launch prices, colours and hardware model numbers. Model names follow catalog spelling, e.g. manufacturer='Samsung' model='Galaxy S24 Ultra', manufacturer='Apple' model='iPhone 15 Pro', manufacturer='Google' model='Pixel 9 Pro'.",
      inputSchema: {
        manufacturer: z.string().min(1).describe("Brand name, e.g. Samsung, Apple, Google, Xiaomi, OnePlus, vivo, Oppo, Motorola, Sony, Nothing."),
        model: z.string().min(1).describe("Model name as marketed, without the brand, e.g. 'Galaxy S24 Ultra', 'iPhone 15 Pro', 'Pixel 9 Pro', 'Redmi Note 13 Pro+'."),
        compact: compactParam(false),
      },
      annotations: READ_ONLY,
    },
    async ({ manufacturer, model, compact }) => {
      try {
        const device = await api.getSpecs(manufacturer, model);
        if (!device) {
          return ok({
            found: false,
            manufacturer,
            model,
            hint: "No phone with that exact model name. Try list_phones_by_manufacturer to see available model names, or lookup_model_number if you have a hardware code such as SM-S928B.",
          });
        }
        return ok({ found: true, device: compact ? toCompact(device) : cleanDeep(device) });
      } catch (err) {
        return describeError(err);
      }
    },
  );

  server.registerTool(
    "search_phones",
    {
      title: "Search phones by hardware filters",
      description:
        "Find smartphones matching hardware criteria using the API's filter language: keys are '<property>[_<operator>]' and values are strings, numbers or booleans. Operators: (none)=equals, _gt, _gte, _lt, _lte, _contains, _in (comma list), _between ('min,max'), _has. Common properties: manufacturer, model, chipset, ram (GB), storage (GB), battery (mAh), refresh_rate (Hz), displaysize (inches), panel_type, brightness (nits), charging (W), wireless_charging, weight (g), ip_rating, nfc, headphone_jack, card_slot, stereo_speakers, infrared, price_usd, announcedate, android. Example: {\"manufacturer\":\"Samsung\",\"ram_gte\":12,\"refresh_rate_gte\":120,\"battery_gte\":5000}. All filters are ANDed. Call list_filter_properties for the complete list of properties and aliases. Results come back in catalog order (roughly newest first within a brand).",
      inputSchema: {
        filters: z
          .record(z.string(), filterValue)
          .describe("Map of filter key to value, e.g. {\"chipset_contains\":\"Snapdragon 8 Gen 3\",\"ram_gte\":12,\"headphone_jack\":true}. Unknown keys are ignored by the API."),
        limit: limitParam(25),
        offset: offsetParam,
        compact: compactParam(true),
      },
      annotations: READ_ONLY,
    },
    async ({ filters, limit, offset, compact }) => {
      try {
        if (!filters || Object.keys(filters).length === 0) {
          return fail("Provide at least one filter, e.g. {\"manufacturer\":\"Google\"} or {\"battery_gte\":5000}. Unfiltered listing is not allowed because it returns 10,000+ phones.");
        }
        const res = await api.searchDevices(filters, limit, offset);
        return ok({
          total: res.total,
          returned: res.items.length,
          offset,
          limit,
          filters,
          devices: project(res.items, compact),
        });
      } catch (err) {
        return describeError(err);
      }
    },
  );

  server.registerTool(
    "list_phones_by_manufacturer",
    {
      title: "List phones by manufacturer",
      description:
        "List every phone in the catalog from one brand, with key specs for each. Useful to discover exact model names before calling get_phone_specs, or to browse a brand's line-up. Large brands have hundreds of models (Samsung ~1,500), so use limit/offset to page.",
      inputSchema: {
        manufacturer: z.string().min(1).describe("Brand name, e.g. Samsung, Apple, Google, Xiaomi, OnePlus, vivo, Oppo, Realme, Honor, Motorola, Sony, Nokia, Asus, Nothing, Huawei, ZTE, Lenovo, TCL, Tecno, Infinix."),
        limit: limitParam(50),
        offset: offsetParam,
        compact: compactParam(true),
      },
      annotations: READ_ONLY,
    },
    async ({ manufacturer, limit, offset, compact }) => {
      try {
        const res = await api.devicesByManufacturer(manufacturer, limit, offset);
        return ok({ manufacturer, total: res.total, returned: res.items.length, offset, limit, devices: project(res.items, compact) });
      } catch (err) {
        return describeError(err);
      }
    },
  );

  server.registerTool(
    "list_phones_by_chipset",
    {
      title: "List phones by chipset",
      description:
        "List phones powered by a given system-on-chip. The chipset must match the catalog string exactly (case-insensitive), e.g. 'Google Tensor G4', 'Apple A17 Pro', 'Qualcomm SM8650-AC Snapdragon 8 Gen 3', 'Mediatek Dimensity 9300'. If you only know part of the name, use search_phones with {\"chipset_contains\":\"Snapdragon 8 Gen 3\"} instead.",
      inputSchema: {
        chipset: z.string().min(1).describe("Full chipset name as it appears in the catalog, e.g. 'Google Tensor G4'."),
        limit: limitParam(50),
        offset: offsetParam,
        compact: compactParam(true),
      },
      annotations: READ_ONLY,
    },
    async ({ chipset, limit, offset, compact }) => {
      try {
        const res = await api.devicesByChipset(chipset, limit, offset);
        const result: Record<string, unknown> = { chipset, total: res.total, returned: res.items.length, offset, limit, devices: project(res.items, compact) };
        if (res.items.length === 0) {
          result.hint = "No exact chipset match. Try search_phones with a chipset_contains filter, e.g. {\"chipset_contains\":\"Snapdragon 8 Gen 3\"}.";
        }
        return ok(result);
      } catch (err) {
        return describeError(err);
      }
    },
  );

  server.registerTool(
    "lookup_model_number",
    {
      title: "Identify a phone from its model number",
      description:
        "Resolve a hardware model/variant code (the string printed on the device or returned by Android's Build.MODEL, e.g. 'SM-S928B', 'A3106', 'GP8GD', '2201116SG', 'TA-1004') to its marketing name, manufacturer and chipset, and return the full specification sheet when found.",
      inputSchema: {
        model_number: z.string().min(1).describe("Hardware model number or variant code, e.g. SM-S928B."),
        compact: compactParam(false),
      },
      annotations: READ_ONLY,
    },
    async ({ model_number, compact }) => {
      try {
        const identity = await api.deviceByModelNumber(model_number);
        if (!identity) {
          return ok({ found: false, model_number, hint: "Model number not in the catalog. Codes are matched exactly; check for typos or regional suffixes (e.g. SM-S928B vs SM-S928U)." });
        }
        let device: ApiDevice | null = null;
        try {
          device = await api.getSpecs(identity.manufacturer, identity.modelName);
        } catch (err) {
          console.error(`[devicespecs-mcp] specs lookup after model-number match failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return ok({
          found: true,
          model_number,
          manufacturer: identity.manufacturer,
          model: identity.modelName,
          chipset: identity.socName,
          device: device ? (compact ? toCompact(device) : cleanDeep(device)) : null,
        });
      } catch (err) {
        return describeError(err);
      }
    },
  );

  server.registerTool(
    "compare_phones",
    {
      title: "Compare phones side by side",
      description:
        "Fetch two to four phones and return their key specs side by side plus a 'differences' map containing only the fields whose values differ, which is the quickest way to answer 'X vs Y' questions. Each phone is given as manufacturer + model in catalog spelling.",
      inputSchema: {
        phones: z
          .array(
            z.object({
              manufacturer: z.string().min(1).describe("Brand, e.g. Samsung."),
              model: z.string().min(1).describe("Model name, e.g. Galaxy S24 Ultra."),
            }),
          )
          .min(2)
          .max(4)
          .describe("Two to four phones to compare."),
      },
      annotations: READ_ONLY,
    },
    async ({ phones }) => {
      try {
        const fetched = await Promise.all(phones.map((p) => api.getSpecs(p.manufacturer, p.model)));
        const missing = phones.filter((_, i) => !fetched[i]).map((p) => `${p.manufacturer} ${p.model}`);
        const found = fetched.filter((d): d is ApiDevice => d !== null).map(toCompact);
        const result: Record<string, unknown> = {
          compared: found.map((d) => `${d.manufacturer} ${d.model}`),
          not_found: missing,
          devices: found,
          differences: differences(found),
        };
        if (missing.length) result.hint = "Some phones were not found; check model spelling with list_phones_by_manufacturer.";
        return ok(result);
      } catch (err) {
        return describeError(err);
      }
    },
  );

  server.registerTool(
    "list_filter_properties",
    {
      title: "Filter language reference",
      description:
        "Return the complete reference for the search_phones filter language: all operators (_gt, _gte, _lt, _lte, _contains, _in, _between, _has), every filterable property with its aliases, type and JSON path, usage notes and worked examples. No network call. Use it before composing a non-trivial search.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => ok(filterReference()),
  );

  server.registerResource(
    "filter-reference",
    "devicespecs://filters",
    {
      title: "Device Specs API filter reference",
      description: "Operators, properties and aliases accepted by the /devices search endpoint, as Markdown.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: filterReferenceMarkdown() }],
    }),
  );

  return server;
}
