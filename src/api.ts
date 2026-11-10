/**
 * Minimal HTTP client for the Device Specs API.
 * Configured entirely from environment variables so it works under any MCP host.
 */
import type { ApiDevice } from "./projection.js";

export const DEFAULT_BASE_URL = "https://deviceultraparser.p.rapidapi.com/";
export const DEFAULT_API_HOST = "deviceultraparser.p.rapidapi.com";
export const GET_KEY_URL = "https://rapidapi.com/controller2042000/api/deviceultraparser";

const PATHS = {
  devices: "api/values/clean/devices",
  byManufacturer: "api/values/clean/getdevices",
  byChipset: "api/values/clean/devicesbychipset",
  specs: "api/values/clean/getspecs",
  byModelNumber: "api/values/clean/devicebymodelnumber",
  catalog: "api/values/clean/catalog",
} as const;

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  apiHost: string;
  usingDefaultGateway: boolean;
}

export class DeviceSpecsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `Device Specs API returned HTTP ${status}`);
    this.name = "DeviceSpecsApiError";
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      [
        "No API key configured.",
        `Set the DEVICESPECS_API_KEY environment variable to your RapidAPI key.`,
        `Get a free key (no card required) at ${GET_KEY_URL}`,
        "Advanced: set DEVICESPECS_BASE_URL to point at a self-hosted gateway that does not need a key.",
      ].join(" "),
    );
    this.name = "MissingApiKeyError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  let baseUrl = (env.DEVICESPECS_BASE_URL || DEFAULT_BASE_URL).trim();
  if (!baseUrl.endsWith("/")) baseUrl += "/";
  const usingDefaultGateway = baseUrl === DEFAULT_BASE_URL;
  const apiHost = (env.DEVICESPECS_API_HOST || (usingDefaultGateway ? DEFAULT_API_HOST : new URL(baseUrl).host)).trim();
  return {
    apiKey: (env.DEVICESPECS_API_KEY || "").trim(),
    baseUrl,
    apiHost,
    usingDefaultGateway,
  };
}

export interface ListResult<T> {
  items: T[];
  /** Total from X-Total-Count when the server supports it, else null. */
  total: number | null;
  /** True when limit/offset were honoured server-side. */
  paginatedByServer: boolean;
}

export interface ModelNumberIdentity {
  modelName: string;
  manufacturer: string;
  socName: string;
}

export class DeviceSpecsApi {
  constructor(private readonly cfg: ApiConfig = loadConfig()) {}

  get config(): ApiConfig {
    return this.cfg;
  }

  private ensureKey(): void {
    if (this.cfg.usingDefaultGateway && !this.cfg.apiKey) throw new MissingApiKeyError();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json", "User-Agent": "devicespecs-mcp" };
    if (this.cfg.apiKey) {
      h["x-rapidapi-key"] = this.cfg.apiKey;
      h["x-rapidapi-host"] = this.cfg.apiHost;
    }
    return h;
  }

  private url(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const u = new URL(path, this.cfg.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === "") continue;
        u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  private async request(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<Response> {
    this.ensureKey();
    const url = this.url(path, query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(url, { method: "GET", headers: this.headers(), signal: controller.signal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new DeviceSpecsApiError(0, "", `Network error calling ${url}: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async json<T>(res: Response, url: string): Promise<T | null> {
    const text = await res.text();
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) {
      let hint = "";
      if (res.status === 401 || res.status === 403) hint = ` Check DEVICESPECS_API_KEY (get one at ${GET_KEY_URL}).`;
      if (res.status === 429) hint = " Rate limit or monthly quota exceeded on your RapidAPI plan.";
      throw new DeviceSpecsApiError(res.status, text, `Device Specs API returned HTTP ${res.status} for ${url}.${hint}`);
    }
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new DeviceSpecsApiError(res.status, text, `Device Specs API returned non-JSON for ${url}`);
    }
  }

  private async list(path: string, query: Record<string, string | number | boolean | undefined>, limit?: number, offset?: number): Promise<ListResult<ApiDevice>> {
    const res = await this.request(path, { ...query, limit, offset });
    const items = (await this.json<ApiDevice[]>(res, path)) ?? [];
    const totalHeader = res.headers.get("x-total-count");
    const total = totalHeader !== null && totalHeader !== "" && Number.isFinite(Number(totalHeader)) ? Number(totalHeader) : null;
    if (total !== null) return { items, total, paginatedByServer: true };
    // Old deployment: server ignored limit/offset, paginate client-side.
    const start = Math.max(0, offset ?? 0);
    const sliced = limit !== undefined ? items.slice(start, start + limit) : items.slice(start);
    return { items: sliced, total: items.length, paginatedByServer: false };
  }

  async getSpecs(manufacturer: string, model: string): Promise<ApiDevice | null> {
    const path = `${PATHS.specs}/${encodeURIComponent(manufacturer.trim())}/${encodeURIComponent(model.trim())}`;
    const res = await this.request(path);
    const data = await this.json<ApiDevice | ApiDevice[]>(res, path);
    if (Array.isArray(data)) return data[0] ?? null;
    return data && typeof data === "object" && Object.keys(data).length > 0 ? data : null;
  }

  searchDevices(filters: Record<string, string | number | boolean>, limit?: number, offset?: number): Promise<ListResult<ApiDevice>> {
    return this.list(PATHS.devices, filters, limit, offset);
  }

  devicesByManufacturer(manufacturer: string, limit?: number, offset?: number): Promise<ListResult<ApiDevice>> {
    return this.list(`${PATHS.byManufacturer}/${encodeURIComponent(manufacturer.trim())}`, {}, limit, offset);
  }

  devicesByChipset(chipset: string, limit?: number, offset?: number): Promise<ListResult<ApiDevice>> {
    return this.list(`${PATHS.byChipset}/${encodeURIComponent(chipset.trim())}`, {}, limit, offset);
  }

  async deviceByModelNumber(modelNumber: string): Promise<ModelNumberIdentity | null> {
    const path = `${PATHS.byModelNumber}/${encodeURIComponent(modelNumber.trim())}`;
    const res = await this.request(path);
    const data = await this.json<ModelNumberIdentity>(res, path);
    return data && data.modelName ? data : null;
  }
}
