using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DeviceSpecs.Mcp;

public sealed record FilterOperator(string Suffix, string Name, string AppliesTo, string Description, string Example);

public sealed record FilterAlias(string Key, string[] Aliases, string Type, string JsonPath, string Description);

public sealed record FilterCategory(string Category, FilterAlias[] Properties);

public sealed record FilterExample(string Goal, Dictionary<string, object> Filters);

/// <summary>
/// Reference data for the Device Specs API "deep query" filter language.
/// Mirrors DeviceSpecs.Api/Utils/DeviceFilterHelper.cs and the TypeScript server's filters.ts. No network required.
/// </summary>
public static class FilterReference
{
    private static readonly JsonSerializerOptions CamelCase = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static readonly FilterOperator[] Operators =
    [
        new("", "eq", "number, string, boolean, arrays", "Exact match (default when no suffix is given). Case-insensitive for strings. For array properties, matches if any element equals the value.", "manufacturer=Samsung  |  ram=12  |  nfc=true"),
        new("_gt", "gt", "number, number[]", "Greater than.", "battery_gt=4500"),
        new("_gte", "gte", "number, number[]", "Greater than or equal.", "refresh_rate_gte=120"),
        new("_lt", "lt", "number, number[]", "Less than.", "weight_lt=180"),
        new("_lte", "lte", "number, number[]", "Less than or equal.", "price_usd_lte=500"),
        new("_contains", "contains", "string, string[]", "Case-insensitive substring match.", "chipset_contains=Snapdragon"),
        new("_in", "in", "number, string, arrays", "Matches any value in a comma-separated list.", "manufacturer_in=Samsung,Google,Apple  |  ram_in=8,12,16"),
        new("_between", "between", "number, number[]", "Inclusive range given as min,max.", "price_usd_between=300,600"),
        new("_has", "has", "boolean", "Boolean capability check; value optional (defaults to true).", "wireless_charging_has=true"),
    ];

    public static readonly FilterCategory[] Categories =
    [
        new("Root / identity",
        [
            new("id", ["id"], "number", "id", "Internal device id."),
            new("manufacturer", ["manufacturer"], "string", "manufacturer", "Brand name, e.g. Samsung, Apple, Xiaomi, vivo."),
            new("model", ["model"], "string", "model", "Marketing model name, e.g. Galaxy S24 Ultra."),
            new("network", ["network"], "string", "network", "Network technologies string, e.g. GSM / HSPA / LTE / 5G."),
            new("announcedate", ["announcedate"], "string", "announceDate", "Announcement date string, e.g. \"2024, August 13\". Use _contains=2024 for a year."),
            new("status", ["status"], "string", "status", "Availability text, e.g. \"Available. Released 2024, September 09\" or \"Discontinued\"."),
            new("chipset", ["chipset"], "string", "chipset", "SoC name, e.g. \"Qualcomm SM8650-AC Snapdragon 8 Gen 3\". Prefer _contains."),
            new("androidversion", ["androidversion", "android"], "string", "androidVersion", "OS string, e.g. \"Android 14, upgradable to Android 16\" or \"iOS 18\"."),
            new("gpu", ["gpu"], "string", "gpu", "GPU name, e.g. Adreno 750."),
            new("price_usd", ["price_usd", "price"], "number", "price_usd", "Launch price in USD (0 when unknown; filter with _gt=0 to require a price)."),
            new("price_eur", ["price_eur"], "number", "price_eur", "Launch price in EUR."),
            new("price_gbp", ["price_gbp"], "number", "price_gbp", "Launch price in GBP."),
            new("colors", ["colors"], "string[]", "colors", "Available colour names. Use _contains."),
        ]),
        new("Display",
        [
            new("display.size_inches", ["display.size_inches", "display.size", "displaysize"], "number", "normalized_specs.display.size_inches", "Diagonal screen size in inches."),
            new("display.panel_type", ["display.panel_type", "display.panel", "panel_type"], "string", "normalized_specs.display.panel_type", "Panel technology, e.g. AMOLED, LTPO OLED, IPS LCD. Use _contains."),
            new("display.refresh_rate_hz", ["display.refresh_rate_hz", "display.refresh_rate", "refreshrate", "refresh_rate"], "number", "normalized_specs.display.refresh_rate_hz", "Maximum refresh rate in Hz."),
            new("display.peak_brightness_nits", ["display.peak_brightness_nits", "display.brightness", "brightness"], "number", "normalized_specs.display.peak_brightness_nits", "Peak brightness in nits."),
            new("display.protection_type", ["display.protection_type"], "string", "normalized_specs.display.protection_type", "Glass protection, e.g. Gorilla Glass Victus 2. Use _contains."),
        ]),
        new("Processor",
        [
            new("processor.total_cores", ["processor.total_cores", "processor.cores", "cores", "cpu_cores"], "number", "normalized_specs.processor.total_cores", "CPU core count."),
            new("processor.max_clock_speed_ghz", ["processor.max_clock_speed_ghz", "processor.speed", "clock_speed"], "number", "normalized_specs.processor.max_clock_speed_ghz", "Highest CPU clock in GHz."),
        ]),
        new("Memory & storage",
        [
            new("memory.available_ram_gb", ["memory.available_ram_gb", "memory.ram", "ram"], "number[]", "normalized_specs.memory_options.available_ram_gb", "RAM options in GB (matches if any variant satisfies the comparison)."),
            new("memory.available_storage_gb", ["memory.available_storage_gb", "memory.storage", "storage"], "number[]", "normalized_specs.memory_options.available_storage_gb", "Storage options in GB (1024 = 1 TB)."),
            new("memory.has_card_slot", ["memory.has_card_slot", "memory.card_slot", "card_slot", "cardslot"], "boolean", "normalized_specs.memory_options.has_card_slot", "microSD slot present."),
            new("memory.storage_technology", ["memory.storage_technology"], "string", "normalized_specs.memory_options.storage_technology", "Storage tech, e.g. UFS 4.0. Use _contains."),
        ]),
        new("Battery & charging",
        [
            new("power.capacities_mah", ["power.capacities_mah", "power.battery", "battery", "battery_capacity"], "number[]", "normalized_specs.battery_and_charging.capacities_mah", "Battery capacity options in mAh."),
            new("power.max_wired_charging_w", ["power.max_wired_charging_w", "power.charging", "charging"], "number", "normalized_specs.battery_and_charging.max_wired_charging_w", "Maximum wired charging power in watts."),
            new("power.has_wireless_charging", ["power.has_wireless_charging", "power.wireless_charging", "wireless_charging", "wirelesscharging"], "boolean", "normalized_specs.battery_and_charging.has_wireless_charging", "Wireless charging supported."),
        ]),
        new("Cameras",
        [
            new("cameras.main_lenses_count", ["cameras.main_lenses_count", "main_camera_lenses"], "number", "normalized_specs.cameras.main_lenses_count", "Number of rear camera lenses."),
            new("cameras.max_main_resolution_mp", ["cameras.max_main_resolution_mp", "main_camera_mp"], "number", "normalized_specs.cameras.max_main_resolution_mp", "Highest rear camera resolution in megapixels."),
            new("cameras.selfie_lenses_count", ["cameras.selfie_lenses_count", "selfie_camera_lenses"], "number", "normalized_specs.cameras.selfie_lenses_count", "Number of front camera lenses."),
        ]),
        new("Physical",
        [
            new("physical.height_mm", ["physical.height_mm"], "number", "normalized_specs.physical.height_mm", "Height in mm."),
            new("physical.width_mm", ["physical.width_mm"], "number", "normalized_specs.physical.width_mm", "Width in mm."),
            new("physical.thickness_mm", ["physical.thickness_mm"], "number", "normalized_specs.physical.thickness_mm", "Thickness in mm."),
            new("physical.weight_g", ["physical.weight_g", "weight"], "number", "normalized_specs.physical.weight_g", "Weight in grams."),
            new("physical.build_materials", ["physical.build_materials"], "string[]", "normalized_specs.physical.build_materials", "Build materials, e.g. Glass front, Aluminum frame. Use _contains."),
            new("physical.sim_options", ["physical.sim_options"], "string[]", "normalized_specs.physical.sim_options", "SIM options, e.g. Nano-SIM, eSIM, Dual SIM. Use _contains."),
            new("physical.ip_rating", ["physical.ip_rating", "ip_rating", "iprating"], "string", "normalized_specs.physical.ip_rating", "Ingress protection rating, e.g. IP68. Use _contains."),
            new("physical.is_water_resistant", ["physical.is_water_resistant", "physical.water_resistant", "water_resistant", "waterresistant"], "boolean", "normalized_specs.physical.is_water_resistant", "Any water resistance rating present."),
        ]),
        new("Sound",
        [
            new("sound.has_stereo_speakers", ["sound.has_stereo_speakers", "sound.stereo_speakers", "stereo_speakers", "stereospeakers"], "boolean", "normalized_specs.sound.has_stereo_speakers", "Stereo speakers."),
            new("sound.has_jack_35mm", ["sound.has_jack_35mm", "sound.jack_35mm", "jack_35mm", "headphone_jack"], "boolean", "normalized_specs.sound.has_jack_35mm", "3.5 mm headphone jack present."),
            new("sound.audio_quality_features", ["sound.audio_quality_features"], "string[]", "normalized_specs.sound.audio_quality_features", "Audio features, e.g. Dolby Atmos, Hi-Res. Use _contains."),
        ]),
        new("Connectivity",
        [
            new("connectivity.wlan_features", ["connectivity.wlan_features"], "string[]", "normalized_specs.connectivity.wlan_features", "Wi-Fi standards/features. Use _contains (e.g. Wi-Fi 7)."),
            new("connectivity.bluetooth_version", ["connectivity.bluetooth_version"], "number", "normalized_specs.connectivity.bluetooth_version", "Bluetooth version as a number, e.g. 5.3."),
            new("connectivity.bluetooth_features", ["connectivity.bluetooth_features"], "string[]", "normalized_specs.connectivity.bluetooth_features", "Bluetooth profiles, e.g. A2DP, LE, aptX. Use _contains."),
            new("connectivity.positioning_tech", ["connectivity.positioning_tech"], "string[]", "normalized_specs.connectivity.positioning_tech", "GNSS systems, e.g. GPS, GLONASS, GALILEO. Use _contains."),
            new("connectivity.has_nfc", ["connectivity.has_nfc", "connectivity.nfc", "nfc"], "boolean", "normalized_specs.connectivity.has_nfc", "NFC present."),
            new("connectivity.has_infrared", ["connectivity.has_infrared", "connectivity.infrared", "infrared"], "boolean", "normalized_specs.connectivity.has_infrared", "Infrared blaster present."),
            new("connectivity.has_radio", ["connectivity.has_radio", "connectivity.radio", "radio"], "boolean", "normalized_specs.connectivity.has_radio", "FM radio present."),
            new("connectivity.usb_type", ["connectivity.usb_type"], "string", "normalized_specs.connectivity.usb_type", "USB port type, e.g. USB Type-C 3.2. Use _contains."),
            new("connectivity.usb_has_otg", ["connectivity.usb_has_otg", "usb_otg"], "boolean", "normalized_specs.connectivity.usb_has_otg", "USB OTG supported."),
        ]),
        new("Benchmarks (measured)",
        [
            new("benchmarks.antutu_score", ["benchmarks.antutu_score", "antutu"], "string", "normalized_specs.benchmarks.antutu_score", "AnTuTu score string, e.g. \"1150000 (v10)\". String: use _contains."),
            new("benchmarks.geekbench_score", ["benchmarks.geekbench_score", "geekbench"], "string", "normalized_specs.benchmarks.geekbench_score", "Geekbench score string. Use _contains."),
            new("benchmarks.measured_display_brightness_nits", ["benchmarks.measured_display_brightness_nits"], "number", "normalized_specs.benchmarks.measured_display_brightness_nits", "Measured display brightness in nits."),
            new("benchmarks.measured_loudspeaker_lufs", ["benchmarks.measured_loudspeaker_lufs"], "number", "normalized_specs.benchmarks.measured_loudspeaker_lufs", "Measured loudspeaker loudness in LUFS (negative numbers; closer to 0 is louder)."),
            new("benchmarks.measured_battery_active_use_hours", ["benchmarks.measured_battery_active_use_hours"], "number", "normalized_specs.benchmarks.measured_battery_active_use_hours", "Measured active-use battery life in hours."),
        ]),
        new("EU energy label",
        [
            new("eulabel.energy_class", ["eulabel.energy_class"], "string", "normalized_specs.eu_label.energy_class", "EU energy efficiency class, A to G."),
            new("eulabel.battery_endurance", ["eulabel.battery_endurance"], "string", "normalized_specs.eu_label.battery_endurance", "EU label battery endurance string, e.g. 84h."),
            new("eulabel.battery_endurance_hours", ["eulabel.battery_endurance_hours"], "number", "normalized_specs.eu_label.battery_endurance_hours", "EU label battery endurance in hours."),
            new("eulabel.free_fall_class", ["eulabel.free_fall_class"], "string", "normalized_specs.eu_label.free_fall_class", "EU label drop-resistance class."),
            new("eulabel.repairability_class", ["eulabel.repairability_class"], "string", "normalized_specs.eu_label.repairability_class", "EU label repairability class."),
        ]),
    ];

    public static readonly string[] Notes =
    [
        "Combine any number of filters in one request; all must match (logical AND).",
        "Keys are case-insensitive and tolerate dots/underscores being omitted (ram_gte, memory.ram_gte and memoryram_gte are equivalent).",
        "Array properties (ram, storage, battery) match when ANY option satisfies the comparison.",
        "Unknown keys are ignored, so a typo silently returns an unfiltered list. Check the alias table.",
        "A property that is empty/zero for a device never matches, so price filters implicitly exclude phones without a known price.",
        "Newer deployments accept limit and offset on list endpoints and return X-Total-Count.",
    ];

    public static readonly FilterExample[] Examples =
    [
        new("Samsung phones with 12 GB+ RAM and 120 Hz", new() { ["manufacturer"] = "Samsung", ["ram_gte"] = 12, ["refresh_rate_gte"] = 120 }),
        new("Phones with a headphone jack and 5000 mAh+", new() { ["headphone_jack"] = true, ["battery_gte"] = 5000 }),
        new("Compact phones under 170 g with an OLED panel", new() { ["weight_lte"] = 170, ["panel_type_contains"] = "OLED" }),
        new("Snapdragon 8 Gen 3 phones announced in 2024", new() { ["chipset_contains"] = "Snapdragon 8 Gen 3", ["announcedate_contains"] = "2024" }),
        new("Phones between $300 and $600 with NFC and microSD", new() { ["price_usd_between"] = "300,600", ["nfc"] = true, ["card_slot"] = true }),
        new("Any of three brands with 1 TB storage", new() { ["manufacturer_in"] = "Apple,Samsung,Xiaomi", ["storage_gte"] = 1024 }),
    ];

    /// <summary>Structured reference, same shape as the TypeScript server's list_filter_properties result.</summary>
    public static JsonObject Reference() => new()
    {
        ["syntax"] = "<property>[_<operator>]=<value>   e.g. ram_gte=12&refresh_rate_gte=120&manufacturer=Samsung",
        ["endpoint"] = "GET /api/values/clean/devices",
        ["operators"] = JsonSerializer.SerializeToNode(Operators, CamelCase),
        ["categories"] = JsonSerializer.SerializeToNode(Categories, CamelCase),
        ["notes"] = JsonSerializer.SerializeToNode(Notes, CamelCase),
        ["examples"] = JsonSerializer.SerializeToNode(Examples, CamelCase),
    };

    public static string Markdown()
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Device Specs API — deep query filter reference").AppendLine();
        sb.AppendLine("Endpoint: `GET /api/values/clean/devices?<filters>`").AppendLine();
        sb.AppendLine("Syntax: `<property>[_<operator>]=<value>`. Multiple filters are ANDed.").AppendLine();
        sb.AppendLine("## Operators").AppendLine().AppendLine("| Suffix | Applies to | Description | Example |").AppendLine("|---|---|---|---|");
        foreach (var op in Operators)
            sb.AppendLine($"| `{(op.Suffix.Length == 0 ? "(none)" : op.Suffix)}` | {op.AppliesTo} | {op.Description} | `{op.Example}` |");
        sb.AppendLine();
        foreach (var cat in Categories)
        {
            sb.AppendLine($"## {cat.Category}").AppendLine().AppendLine("| Key (aliases) | Type | JSON path | Description |").AppendLine("|---|---|---|---|");
            foreach (var p in cat.Properties)
                sb.AppendLine($"| `{string.Join("`, `", p.Aliases)}` | {p.Type} | `{p.JsonPath}` | {p.Description} |");
            sb.AppendLine();
        }
        sb.AppendLine("## Notes").AppendLine();
        foreach (var n in Notes) sb.AppendLine($"- {n}");
        sb.AppendLine().AppendLine("## Examples").AppendLine();
        foreach (var ex in Examples)
        {
            var qs = string.Join("&", ex.Filters.Select(kv => $"{kv.Key}={Uri.EscapeDataString(Convert.ToString(kv.Value, System.Globalization.CultureInfo.InvariantCulture) ?? "")}"));
            sb.AppendLine($"- {ex.Goal}: `?{qs}`");
        }
        return sb.ToString().TrimEnd('\n', '\r');
    }
}
