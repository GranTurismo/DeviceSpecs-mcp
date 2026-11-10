/**
 * Reference data for the Device Specs API "deep query" filter language.
 * Mirrors DeviceSpecs.Api/Utils/DeviceFilterHelper.cs. No network required.
 */

export interface FilterOperator {
  suffix: string;
  name: string;
  appliesTo: string;
  description: string;
  example: string;
}

export interface FilterAlias {
  /** Canonical query key (use any alias in the `aliases` list). */
  key: string;
  aliases: string[];
  type: "number" | "number[]" | "string" | "string[]" | "boolean";
  jsonPath: string;
  description: string;
}

export interface FilterCategory {
  category: string;
  properties: FilterAlias[];
}

export const OPERATORS: FilterOperator[] = [
  { suffix: "", name: "eq", appliesTo: "number, string, boolean, arrays", description: "Exact match (default when no suffix is given). Case-insensitive for strings. For array properties, matches if any element equals the value.", example: "manufacturer=Samsung  |  ram=12  |  nfc=true" },
  { suffix: "_gt", name: "gt", appliesTo: "number, number[]", description: "Greater than.", example: "battery_gt=4500" },
  { suffix: "_gte", name: "gte", appliesTo: "number, number[]", description: "Greater than or equal.", example: "refresh_rate_gte=120" },
  { suffix: "_lt", name: "lt", appliesTo: "number, number[]", description: "Less than.", example: "weight_lt=180" },
  { suffix: "_lte", name: "lte", appliesTo: "number, number[]", description: "Less than or equal.", example: "price_usd_lte=500" },
  { suffix: "_contains", name: "contains", appliesTo: "string, string[]", description: "Case-insensitive substring match.", example: "chipset_contains=Snapdragon" },
  { suffix: "_in", name: "in", appliesTo: "number, string, arrays", description: "Matches any value in a comma-separated list.", example: "manufacturer_in=Samsung,Google,Apple  |  ram_in=8,12,16" },
  { suffix: "_between", name: "between", appliesTo: "number, number[]", description: "Inclusive range given as min,max.", example: "price_usd_between=300,600" },
  { suffix: "_has", name: "has", appliesTo: "boolean", description: "Boolean capability check; value optional (defaults to true).", example: "wireless_charging_has=true" },
];

export const FILTER_CATEGORIES: FilterCategory[] = [
  {
    category: "Root / identity",
    properties: [
      { key: "id", aliases: ["id"], type: "number", jsonPath: "id", description: "Internal device id." },
      { key: "manufacturer", aliases: ["manufacturer"], type: "string", jsonPath: "manufacturer", description: "Brand name, e.g. Samsung, Apple, Xiaomi, vivo." },
      { key: "model", aliases: ["model"], type: "string", jsonPath: "model", description: "Marketing model name, e.g. Galaxy S24 Ultra." },
      { key: "network", aliases: ["network"], type: "string", jsonPath: "network", description: "Network technologies string, e.g. GSM / HSPA / LTE / 5G." },
      { key: "announcedate", aliases: ["announcedate"], type: "string", jsonPath: "announceDate", description: "Announcement date string, e.g. \"2024, August 13\". Use _contains=2024 for a year." },
      { key: "status", aliases: ["status"], type: "string", jsonPath: "status", description: "Availability text, e.g. \"Available. Released 2024, September 09\" or \"Discontinued\"." },
      { key: "chipset", aliases: ["chipset"], type: "string", jsonPath: "chipset", description: "SoC name, e.g. \"Qualcomm SM8650-AC Snapdragon 8 Gen 3\". Prefer _contains." },
      { key: "androidversion", aliases: ["androidversion", "android"], type: "string", jsonPath: "androidVersion", description: "OS string, e.g. \"Android 14, upgradable to Android 16\" or \"iOS 18\"." },
      { key: "gpu", aliases: ["gpu"], type: "string", jsonPath: "gpu", description: "GPU name, e.g. Adreno 750." },
      { key: "price_usd", aliases: ["price_usd", "price"], type: "number", jsonPath: "price_usd", description: "Launch price in USD (0 when unknown; filter with _gt=0 to require a price)." },
      { key: "price_eur", aliases: ["price_eur"], type: "number", jsonPath: "price_eur", description: "Launch price in EUR." },
      { key: "price_gbp", aliases: ["price_gbp"], type: "number", jsonPath: "price_gbp", description: "Launch price in GBP." },
      { key: "colors", aliases: ["colors"], type: "string[]", jsonPath: "colors", description: "Available colour names. Use _contains." },
    ],
  },
  {
    category: "Display",
    properties: [
      { key: "display.size_inches", aliases: ["display.size_inches", "display.size", "displaysize"], type: "number", jsonPath: "normalized_specs.display.size_inches", description: "Diagonal screen size in inches." },
      { key: "display.panel_type", aliases: ["display.panel_type", "display.panel", "panel_type"], type: "string", jsonPath: "normalized_specs.display.panel_type", description: "Panel technology, e.g. AMOLED, LTPO OLED, IPS LCD. Use _contains." },
      { key: "display.refresh_rate_hz", aliases: ["display.refresh_rate_hz", "display.refresh_rate", "refreshrate", "refresh_rate"], type: "number", jsonPath: "normalized_specs.display.refresh_rate_hz", description: "Maximum refresh rate in Hz." },
      { key: "display.peak_brightness_nits", aliases: ["display.peak_brightness_nits", "display.brightness", "brightness"], type: "number", jsonPath: "normalized_specs.display.peak_brightness_nits", description: "Peak brightness in nits." },
      { key: "display.protection_type", aliases: ["display.protection_type"], type: "string", jsonPath: "normalized_specs.display.protection_type", description: "Glass protection, e.g. Gorilla Glass Victus 2. Use _contains." },
    ],
  },
  {
    category: "Processor",
    properties: [
      { key: "processor.total_cores", aliases: ["processor.total_cores", "processor.cores", "cores", "cpu_cores"], type: "number", jsonPath: "normalized_specs.processor.total_cores", description: "CPU core count." },
      { key: "processor.max_clock_speed_ghz", aliases: ["processor.max_clock_speed_ghz", "processor.speed", "clock_speed"], type: "number", jsonPath: "normalized_specs.processor.max_clock_speed_ghz", description: "Highest CPU clock in GHz." },
    ],
  },
  {
    category: "Memory & storage",
    properties: [
      { key: "memory.available_ram_gb", aliases: ["memory.available_ram_gb", "memory.ram", "ram"], type: "number[]", jsonPath: "normalized_specs.memory_options.available_ram_gb", description: "RAM options in GB (matches if any variant satisfies the comparison)." },
      { key: "memory.available_storage_gb", aliases: ["memory.available_storage_gb", "memory.storage", "storage"], type: "number[]", jsonPath: "normalized_specs.memory_options.available_storage_gb", description: "Storage options in GB (1024 = 1 TB)." },
      { key: "memory.has_card_slot", aliases: ["memory.has_card_slot", "memory.card_slot", "card_slot", "cardslot"], type: "boolean", jsonPath: "normalized_specs.memory_options.has_card_slot", description: "microSD slot present." },
      { key: "memory.storage_technology", aliases: ["memory.storage_technology"], type: "string", jsonPath: "normalized_specs.memory_options.storage_technology", description: "Storage tech, e.g. UFS 4.0. Use _contains." },
    ],
  },
  {
    category: "Battery & charging",
    properties: [
      { key: "power.capacities_mah", aliases: ["power.capacities_mah", "power.battery", "battery", "battery_capacity"], type: "number[]", jsonPath: "normalized_specs.battery_and_charging.capacities_mah", description: "Battery capacity options in mAh." },
      { key: "power.max_wired_charging_w", aliases: ["power.max_wired_charging_w", "power.charging", "charging"], type: "number", jsonPath: "normalized_specs.battery_and_charging.max_wired_charging_w", description: "Maximum wired charging power in watts." },
      { key: "power.has_wireless_charging", aliases: ["power.has_wireless_charging", "power.wireless_charging", "wireless_charging", "wirelesscharging"], type: "boolean", jsonPath: "normalized_specs.battery_and_charging.has_wireless_charging", description: "Wireless charging supported." },
    ],
  },
  {
    category: "Cameras",
    properties: [
      { key: "cameras.main_lenses_count", aliases: ["cameras.main_lenses_count", "main_camera_lenses"], type: "number", jsonPath: "normalized_specs.cameras.main_lenses_count", description: "Number of rear camera lenses." },
      { key: "cameras.max_main_resolution_mp", aliases: ["cameras.max_main_resolution_mp", "main_camera_mp"], type: "number", jsonPath: "normalized_specs.cameras.max_main_resolution_mp", description: "Highest rear camera resolution in megapixels." },
      { key: "cameras.selfie_lenses_count", aliases: ["cameras.selfie_lenses_count", "selfie_camera_lenses"], type: "number", jsonPath: "normalized_specs.cameras.selfie_lenses_count", description: "Number of front camera lenses." },
    ],
  },
  {
    category: "Physical",
    properties: [
      { key: "physical.height_mm", aliases: ["physical.height_mm"], type: "number", jsonPath: "normalized_specs.physical.height_mm", description: "Height in mm." },
      { key: "physical.width_mm", aliases: ["physical.width_mm"], type: "number", jsonPath: "normalized_specs.physical.width_mm", description: "Width in mm." },
      { key: "physical.thickness_mm", aliases: ["physical.thickness_mm"], type: "number", jsonPath: "normalized_specs.physical.thickness_mm", description: "Thickness in mm." },
      { key: "physical.weight_g", aliases: ["physical.weight_g", "weight"], type: "number", jsonPath: "normalized_specs.physical.weight_g", description: "Weight in grams." },
      { key: "physical.build_materials", aliases: ["physical.build_materials"], type: "string[]", jsonPath: "normalized_specs.physical.build_materials", description: "Build materials, e.g. Glass front, Aluminum frame. Use _contains." },
      { key: "physical.sim_options", aliases: ["physical.sim_options"], type: "string[]", jsonPath: "normalized_specs.physical.sim_options", description: "SIM options, e.g. Nano-SIM, eSIM, Dual SIM. Use _contains." },
      { key: "physical.ip_rating", aliases: ["physical.ip_rating", "ip_rating", "iprating"], type: "string", jsonPath: "normalized_specs.physical.ip_rating", description: "Ingress protection rating, e.g. IP68. Use _contains." },
      { key: "physical.is_water_resistant", aliases: ["physical.is_water_resistant", "physical.water_resistant", "water_resistant", "waterresistant"], type: "boolean", jsonPath: "normalized_specs.physical.is_water_resistant", description: "Any water resistance rating present." },
    ],
  },
  {
    category: "Sound",
    properties: [
      { key: "sound.has_stereo_speakers", aliases: ["sound.has_stereo_speakers", "sound.stereo_speakers", "stereo_speakers", "stereospeakers"], type: "boolean", jsonPath: "normalized_specs.sound.has_stereo_speakers", description: "Stereo speakers." },
      { key: "sound.has_jack_35mm", aliases: ["sound.has_jack_35mm", "sound.jack_35mm", "jack_35mm", "headphone_jack"], type: "boolean", jsonPath: "normalized_specs.sound.has_jack_35mm", description: "3.5 mm headphone jack present." },
      { key: "sound.audio_quality_features", aliases: ["sound.audio_quality_features"], type: "string[]", jsonPath: "normalized_specs.sound.audio_quality_features", description: "Audio features, e.g. Dolby Atmos, Hi-Res. Use _contains." },
    ],
  },
  {
    category: "Connectivity",
    properties: [
      { key: "connectivity.wlan_features", aliases: ["connectivity.wlan_features"], type: "string[]", jsonPath: "normalized_specs.connectivity.wlan_features", description: "Wi-Fi standards/features. Use _contains (e.g. Wi-Fi 7)." },
      { key: "connectivity.bluetooth_version", aliases: ["connectivity.bluetooth_version"], type: "number", jsonPath: "normalized_specs.connectivity.bluetooth_version", description: "Bluetooth version as a number, e.g. 5.3." },
      { key: "connectivity.bluetooth_features", aliases: ["connectivity.bluetooth_features"], type: "string[]", jsonPath: "normalized_specs.connectivity.bluetooth_features", description: "Bluetooth profiles, e.g. A2DP, LE, aptX. Use _contains." },
      { key: "connectivity.positioning_tech", aliases: ["connectivity.positioning_tech"], type: "string[]", jsonPath: "normalized_specs.connectivity.positioning_tech", description: "GNSS systems, e.g. GPS, GLONASS, GALILEO. Use _contains." },
      { key: "connectivity.has_nfc", aliases: ["connectivity.has_nfc", "connectivity.nfc", "nfc"], type: "boolean", jsonPath: "normalized_specs.connectivity.has_nfc", description: "NFC present." },
      { key: "connectivity.has_infrared", aliases: ["connectivity.has_infrared", "connectivity.infrared", "infrared"], type: "boolean", jsonPath: "normalized_specs.connectivity.has_infrared", description: "Infrared blaster present." },
      { key: "connectivity.has_radio", aliases: ["connectivity.has_radio", "connectivity.radio", "radio"], type: "boolean", jsonPath: "normalized_specs.connectivity.has_radio", description: "FM radio present." },
      { key: "connectivity.usb_type", aliases: ["connectivity.usb_type"], type: "string", jsonPath: "normalized_specs.connectivity.usb_type", description: "USB port type, e.g. USB Type-C 3.2. Use _contains." },
      { key: "connectivity.usb_has_otg", aliases: ["connectivity.usb_has_otg", "usb_otg"], type: "boolean", jsonPath: "normalized_specs.connectivity.usb_has_otg", description: "USB OTG supported." },
    ],
  },
  {
    category: "Benchmarks (measured)",
    properties: [
      { key: "benchmarks.antutu_score", aliases: ["benchmarks.antutu_score", "antutu"], type: "string", jsonPath: "normalized_specs.benchmarks.antutu_score", description: "AnTuTu score string, e.g. \"1150000 (v10)\". String: use _contains." },
      { key: "benchmarks.geekbench_score", aliases: ["benchmarks.geekbench_score", "geekbench"], type: "string", jsonPath: "normalized_specs.benchmarks.geekbench_score", description: "Geekbench score string. Use _contains." },
      { key: "benchmarks.measured_display_brightness_nits", aliases: ["benchmarks.measured_display_brightness_nits"], type: "number", jsonPath: "normalized_specs.benchmarks.measured_display_brightness_nits", description: "Measured display brightness in nits." },
      { key: "benchmarks.measured_loudspeaker_lufs", aliases: ["benchmarks.measured_loudspeaker_lufs"], type: "number", jsonPath: "normalized_specs.benchmarks.measured_loudspeaker_lufs", description: "Measured loudspeaker loudness in LUFS (negative numbers; closer to 0 is louder)." },
      { key: "benchmarks.measured_battery_active_use_hours", aliases: ["benchmarks.measured_battery_active_use_hours"], type: "number", jsonPath: "normalized_specs.benchmarks.measured_battery_active_use_hours", description: "Measured active-use battery life in hours." },
    ],
  },
  {
    category: "EU energy label",
    properties: [
      { key: "eulabel.energy_class", aliases: ["eulabel.energy_class"], type: "string", jsonPath: "normalized_specs.eu_label.energy_class", description: "EU energy efficiency class, A to G." },
      { key: "eulabel.battery_endurance", aliases: ["eulabel.battery_endurance"], type: "string", jsonPath: "normalized_specs.eu_label.battery_endurance", description: "EU label battery endurance string, e.g. 84h." },
      { key: "eulabel.battery_endurance_hours", aliases: ["eulabel.battery_endurance_hours"], type: "number", jsonPath: "normalized_specs.eu_label.battery_endurance_hours", description: "EU label battery endurance in hours." },
      { key: "eulabel.free_fall_class", aliases: ["eulabel.free_fall_class"], type: "string", jsonPath: "normalized_specs.eu_label.free_fall_class", description: "EU label drop-resistance class." },
      { key: "eulabel.repairability_class", aliases: ["eulabel.repairability_class"], type: "string", jsonPath: "normalized_specs.eu_label.repairability_class", description: "EU label repairability class." },
    ],
  },
];

export const FILTER_NOTES: string[] = [
  "Combine any number of filters in one request; all must match (logical AND).",
  "Keys are case-insensitive and tolerate dots/underscores being omitted (ram_gte, memory.ram_gte and memoryram_gte are equivalent).",
  "Array properties (ram, storage, battery) match when ANY option satisfies the comparison.",
  "Unknown keys are ignored, so a typo silently returns an unfiltered list. Check the alias table.",
  "A property that is empty/zero for a device never matches, so price filters implicitly exclude phones without a known price.",
  "Newer deployments accept limit and offset on list endpoints and return X-Total-Count.",
];

export const FILTER_EXAMPLES: { goal: string; filters: Record<string, string | number | boolean> }[] = [
  { goal: "Samsung phones with 12 GB+ RAM and 120 Hz", filters: { manufacturer: "Samsung", ram_gte: 12, refresh_rate_gte: 120 } },
  { goal: "Phones with a headphone jack and 5000 mAh+", filters: { headphone_jack: true, battery_gte: 5000 } },
  { goal: "Compact phones under 170 g with an OLED panel", filters: { weight_lte: 170, panel_type_contains: "OLED" } },
  { goal: "Snapdragon 8 Gen 3 phones announced in 2024", filters: { chipset_contains: "Snapdragon 8 Gen 3", announcedate_contains: "2024" } },
  { goal: "Phones between $300 and $600 with NFC and microSD", filters: { price_usd_between: "300,600", nfc: true, card_slot: true } },
  { goal: "Any of three brands with 1 TB storage", filters: { manufacturer_in: "Apple,Samsung,Xiaomi", storage_gte: 1024 } },
];

export function filterReference() {
  return {
    syntax: "<property>[_<operator>]=<value>   e.g. ram_gte=12&refresh_rate_gte=120&manufacturer=Samsung",
    endpoint: "GET /api/values/clean/devices",
    operators: OPERATORS,
    categories: FILTER_CATEGORIES,
    notes: FILTER_NOTES,
    examples: FILTER_EXAMPLES,
  };
}

export function filterReferenceMarkdown(): string {
  const lines: string[] = [];
  lines.push("# Device Specs API — deep query filter reference", "");
  lines.push("Endpoint: `GET /api/values/clean/devices?<filters>`", "");
  lines.push("Syntax: `<property>[_<operator>]=<value>`. Multiple filters are ANDed.", "");
  lines.push("## Operators", "", "| Suffix | Applies to | Description | Example |", "|---|---|---|---|");
  for (const op of OPERATORS) {
    lines.push(`| \`${op.suffix || "(none)"}\` | ${op.appliesTo} | ${op.description} | \`${op.example}\` |`);
  }
  lines.push("");
  for (const cat of FILTER_CATEGORIES) {
    lines.push(`## ${cat.category}`, "", "| Key (aliases) | Type | JSON path | Description |", "|---|---|---|---|");
    for (const p of cat.properties) {
      lines.push(`| \`${p.aliases.join("`, `")}\` | ${p.type} | \`${p.jsonPath}\` | ${p.description} |`);
    }
    lines.push("");
  }
  lines.push("## Notes", "", ...FILTER_NOTES.map((n) => `- ${n}`), "");
  lines.push("## Examples", "");
  for (const ex of FILTER_EXAMPLES) {
    const qs = Object.entries(ex.filters).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
    lines.push(`- ${ex.goal}: \`?${qs}\``);
  }
  return lines.join("\n");
}
