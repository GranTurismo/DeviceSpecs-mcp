using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace DeviceSpecs.Mcp;

/// <summary>Short per-phone projection (~20 fields) used by list tools and comparisons.</summary>
public sealed class CompactDevice
{
    [JsonPropertyName("manufacturer")] public string Manufacturer { get; set; } = "";
    [JsonPropertyName("model")] public string Model { get; set; } = "";
    [JsonPropertyName("announce_date")] public string AnnounceDate { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("chipset")] public string Chipset { get; set; } = "";
    [JsonPropertyName("display_size_inches")] public double? DisplaySizeInches { get; set; }
    [JsonPropertyName("refresh_rate_hz")] public double? RefreshRateHz { get; set; }
    [JsonPropertyName("panel_type")] public string PanelType { get; set; } = "";
    [JsonPropertyName("ram_gb")] public List<double> RamGb { get; set; } = [];
    [JsonPropertyName("storage_gb")] public List<double> StorageGb { get; set; } = [];
    [JsonPropertyName("battery_mah")] public double? BatteryMah { get; set; }
    [JsonPropertyName("max_wired_charging_w")] public double? MaxWiredChargingW { get; set; }
    [JsonPropertyName("weight_g")] public double? WeightG { get; set; }
    [JsonPropertyName("main_camera_mp")] public double? MainCameraMp { get; set; }
    [JsonPropertyName("price_usd")] public double? PriceUsd { get; set; }
    [JsonPropertyName("has_nfc")] public bool? HasNfc { get; set; }
    [JsonPropertyName("has_jack_35mm")] public bool? HasJack35mm { get; set; }
    [JsonPropertyName("has_wireless_charging")] public bool? HasWirelessCharging { get; set; }
    [JsonPropertyName("ip_rating")] public string IpRating { get; set; } = "";
    [JsonPropertyName("image_url")] public string ImageUrl { get; set; } = "";
}

/// <summary>Compact projections and text clean-up for raw API payloads (mirrors projection.ts).</summary>
public static partial class Projection
{
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    private static readonly Dictionary<string, string> Entities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["amp"] = "&", ["lt"] = "<", ["gt"] = ">", ["quot"] = "\"", ["apos"] = "'", ["nbsp"] = " ",
        ["deg"] = "°", ["times"] = "×", ["ndash"] = "–", ["mdash"] = "—",
    };

    [GeneratedRegex(@"</?[a-z][^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"&(#x?[0-9a-f]+|[a-z]+);", RegexOptions.IgnoreCase)]
    private static partial Regex EntityRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    /// <summary>Decode common HTML entities and strip tags such as &lt;sup&gt;2&lt;/sup&gt;.</summary>
    public static string CleanText(string value)
    {
        var s = TagRegex().Replace(value, "");
        for (var i = 0; i < 2; i++)
        {
            s = EntityRegex().Replace(s, m =>
            {
                var code = m.Groups[1].Value;
                if (code[0] == '#')
                {
                    var hex = code.Length > 1 && (code[1] == 'x' || code[1] == 'X');
                    var digits = hex ? code[2..] : code[1..];
                    if (int.TryParse(digits, hex ? NumberStyles.HexNumber : NumberStyles.Integer, CultureInfo.InvariantCulture, out var num) && num >= 0 && num <= 0x10FFFF)
                    {
                        try { return char.ConvertFromUtf32(num); } catch (ArgumentOutOfRangeException) { return m.Value; }
                    }
                    return m.Value;
                }
                return Entities.TryGetValue(code, out var rep) ? rep : m.Value;
            });
        }
        return WhitespaceRegex().Replace(s, " ").Trim();
    }

    /// <summary>Recursively clean every string in a JSON value. Returns a new tree.</summary>
    public static JsonNode? CleanDeep(JsonNode? node)
    {
        switch (node)
        {
            case null:
                return null;
            case JsonValue v when v.TryGetValue<string>(out var s):
                return JsonValue.Create(CleanText(s));
            case JsonValue v:
                return v.DeepClone();
            case JsonArray arr:
                var outArr = new JsonArray();
                foreach (var item in arr) outArr.Add(CleanDeep(item));
                return outArr;
            case JsonObject obj:
                var outObj = new JsonObject();
                foreach (var (k, val) in obj) outObj[k] = CleanDeep(val);
                return outObj;
            default:
                return node.DeepClone();
        }
    }

    private static double? Num(JsonNode? n)
    {
        if (n is JsonValue v && v.TryGetValue<double>(out var d) && double.IsFinite(d) && d != 0) return d;
        return null;
    }

    private static bool? Bool(JsonNode? n) => n is JsonValue v && v.TryGetValue<bool>(out var b) ? b : null;

    private static string Str(JsonNode? n) => n is JsonValue v && v.TryGetValue<string>(out var s) ? CleanText(s) : "";

    private static List<double> Nums(JsonNode? n)
    {
        var list = new List<double>();
        if (n is not JsonArray arr) return list;
        foreach (var item in arr)
            if (item is JsonValue v && v.TryGetValue<double>(out var d)) list.Add(d);
        return list;
    }

    public static CompactDevice ToCompact(JsonObject d)
    {
        var n = d["normalized_specs"] as JsonObject;
        var caps = Nums(n?["battery_and_charging"]?["capacities_mah"]);
        return new CompactDevice
        {
            Manufacturer = Str(d["manufacturer"]),
            Model = Str(d["model"]),
            AnnounceDate = Str(d["announceDate"]),
            Status = Str(d["status"]),
            Chipset = Str(d["chipset"]),
            DisplaySizeInches = Num(n?["display"]?["size_inches"]),
            RefreshRateHz = Num(n?["display"]?["refresh_rate_hz"]),
            PanelType = Str(n?["display"]?["panel_type"]),
            RamGb = Nums(n?["memory_options"]?["available_ram_gb"]),
            StorageGb = Nums(n?["memory_options"]?["available_storage_gb"]),
            BatteryMah = caps.Count > 0 ? caps.Max() : null,
            MaxWiredChargingW = Num(n?["battery_and_charging"]?["max_wired_charging_w"]),
            WeightG = Num(n?["physical"]?["weight_g"]),
            MainCameraMp = Num(n?["cameras"]?["max_main_resolution_mp"]),
            PriceUsd = Num(d["price_usd"]),
            HasNfc = Bool(n?["connectivity"]?["has_nfc"]),
            HasJack35mm = Bool(n?["sound"]?["has_jack_35mm"]),
            HasWirelessCharging = Bool(n?["battery_and_charging"]?["has_wireless_charging"]),
            IpRating = Str(n?["physical"]?["ip_rating"]),
            ImageUrl = Str(d["imageUrl"]),
        };
    }

    public static JsonObject ToNode(CompactDevice d) => (JsonObject)JsonSerializer.SerializeToNode(d, JsonOptions)!;

    /// <summary>Fields whose values differ across a set of compact devices, keyed by field name.</summary>
    public static JsonObject Differences(IReadOnlyList<CompactDevice> devices)
    {
        var result = new JsonObject();
        if (devices.Count < 2) return result;
        var nodes = devices.Select(ToNode).ToList();
        foreach (var key in nodes[0].Select(p => p.Key).ToList())
        {
            if (key == "image_url") continue;
            var serialized = nodes.Select(o => o[key]?.ToJsonString() ?? "null").ToList();
            if (serialized.Distinct().Count() > 1)
            {
                var values = new JsonArray();
                foreach (var o in nodes) values.Add(o[key]?.DeepClone());
                result[key] = values;
            }
        }
        return result;
    }
}
