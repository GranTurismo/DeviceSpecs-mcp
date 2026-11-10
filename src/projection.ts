/**
 * Compact projections and text clean-up for Device Specs API payloads.
 */

// Raw API device shape (snake_case, as returned by the service). Only the
// fields we touch are typed; everything else is passed through untouched.
export interface ApiDevice {
  id?: number;
  manufacturer?: string;
  model?: string;
  network?: string;
  announceDate?: string;
  status?: string;
  chipset?: string;
  androidVersion?: string;
  gpu?: string;
  price_usd?: number;
  price_eur?: number;
  price_gbp?: number;
  imageUrl?: string;
  colors?: string[];
  variants?: { id?: number; model_number?: string }[];
  normalized_specs?: {
    display?: { size_inches?: number; panel_type?: string; refresh_rate_hz?: number; peak_brightness_nits?: number; protection_type?: string };
    processor?: { total_cores?: number; max_clock_speed_ghz?: number };
    memory_options?: { available_ram_gb?: number[]; available_storage_gb?: number[]; has_card_slot?: boolean; storage_technology?: string };
    battery_and_charging?: { capacities_mah?: number[]; max_wired_charging_w?: number; has_wireless_charging?: boolean };
    cameras?: { main_lenses_count?: number; max_main_resolution_mp?: number; selfie_lenses_count?: number };
    physical?: { height_mm?: number; width_mm?: number; thickness_mm?: number; weight_g?: number; build_materials?: string[]; sim_options?: string[]; ip_rating?: string; is_water_resistant?: boolean };
    sound?: { has_stereo_speakers?: boolean; has_jack_35mm?: boolean; audio_quality_features?: string[] };
    connectivity?: { wlan_features?: string[]; bluetooth_version?: number; bluetooth_features?: string[]; positioning_tech?: string[]; has_nfc?: boolean; has_infrared?: boolean; has_radio?: boolean; usb_type?: string; usb_has_otg?: boolean };
    benchmarks?: Record<string, unknown>;
    eu_label?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface CompactDevice {
  manufacturer: string;
  model: string;
  announce_date: string;
  status: string;
  chipset: string;
  display_size_inches: number | null;
  refresh_rate_hz: number | null;
  panel_type: string;
  ram_gb: number[];
  storage_gb: number[];
  battery_mah: number | null;
  max_wired_charging_w: number | null;
  weight_g: number | null;
  main_camera_mp: number | null;
  price_usd: number | null;
  has_nfc: boolean | null;
  has_jack_35mm: boolean | null;
  has_wireless_charging: boolean | null;
  ip_rating: string;
  image_url: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  times: "×",
  ndash: "–",
  mdash: "—",
};

/** Decode common HTML entities and strip tags such as <sup>2</sup>. */
export function cleanText(value: string): string {
  let s = value;
  // Strip tags but keep their inner text (cm<sup>2</sup> -> cm2).
  s = s.replace(/<\/?[a-z][^>]*>/gi, "");
  // Decode entities, possibly double-encoded (&amp;amp;).
  for (let i = 0; i < 2; i++) {
    s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === "#") {
        const num = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(num) ? String.fromCodePoint(num) : m;
      }
      const rep = ENTITIES[code.toLowerCase()];
      return rep !== undefined ? rep : m;
    });
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Recursively clean every string in a JSON value. */
export function cleanDeep<T>(value: T): T {
  if (typeof value === "string") return cleanText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => cleanDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cleanDeep(v);
    return out as T;
  }
  return value;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v !== 0 ? v : null;
}
function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function str(v: unknown): string {
  return typeof v === "string" ? cleanText(v) : "";
}
function nums(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
}

export function toCompact(d: ApiDevice): CompactDevice {
  const n = d.normalized_specs ?? {};
  const caps = nums(n.battery_and_charging?.capacities_mah);
  return {
    manufacturer: str(d.manufacturer),
    model: str(d.model),
    announce_date: str(d.announceDate),
    status: str(d.status),
    chipset: str(d.chipset),
    display_size_inches: num(n.display?.size_inches),
    refresh_rate_hz: num(n.display?.refresh_rate_hz),
    panel_type: str(n.display?.panel_type),
    ram_gb: nums(n.memory_options?.available_ram_gb),
    storage_gb: nums(n.memory_options?.available_storage_gb),
    battery_mah: caps.length ? Math.max(...caps) : null,
    max_wired_charging_w: num(n.battery_and_charging?.max_wired_charging_w),
    weight_g: num(n.physical?.weight_g),
    main_camera_mp: num(n.cameras?.max_main_resolution_mp),
    price_usd: num(d.price_usd),
    has_nfc: bool(n.connectivity?.has_nfc),
    has_jack_35mm: bool(n.sound?.has_jack_35mm),
    has_wireless_charging: bool(n.battery_and_charging?.has_wireless_charging),
    ip_rating: str(n.physical?.ip_rating),
    image_url: str(d.imageUrl),
  };
}

/** Fields whose values differ across a set of compact devices. */
export function differences(devices: CompactDevice[]): Record<string, (string | number | boolean | number[] | null)[]> {
  const out: Record<string, (string | number | boolean | number[] | null)[]> = {};
  if (devices.length < 2) return out;
  const keys = Object.keys(devices[0]) as (keyof CompactDevice)[];
  for (const key of keys) {
    if (key === "image_url") continue;
    const values = devices.map((d) => d[key]);
    const serialized = values.map((v) => JSON.stringify(v));
    if (new Set(serialized).size > 1) out[key] = values;
  }
  return out;
}
