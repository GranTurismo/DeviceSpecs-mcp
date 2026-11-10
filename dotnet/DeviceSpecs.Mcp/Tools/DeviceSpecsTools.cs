using System.ComponentModel;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace DeviceSpecs.Mcp.Tools;

public sealed record PhoneRef(
    [property: JsonPropertyName("manufacturer"), Description("Brand, e.g. Samsung.")] string Manufacturer,
    [property: JsonPropertyName("model"), Description("Model name, e.g. Galaxy S24 Ultra.")] string Model);

[McpServerToolType]
public sealed class DeviceSpecsTools(DeviceSpecsApi api)
{
    private const string CompactFalseDoc = "false (default) returns the full raw API JSON (raw spec strings, cameras, sensors, variants, normalized_specs); true returns a short projection of ~20 key fields.";
    private const string CompactTrueDoc = "true (default) returns a short projection of ~20 key fields per phone to save tokens; false returns the full raw API JSON.";
    private const string OffsetDoc = "Number of phones to skip, for paging through large result sets.";

    // ---- result helpers -------------------------------------------------------------------------

    private static CallToolResult Ok(JsonObject result) => new()
    {
        Content = [new TextContentBlock { Text = result.ToJsonString(Projection.JsonOptions) }],
        StructuredContent = JsonSerializer.SerializeToElement(result),
    };

    private static CallToolResult Fail(string message, Action<JsonObject>? extra = null)
    {
        var payload = new JsonObject { ["error"] = message };
        extra?.Invoke(payload);
        return new CallToolResult
        {
            Content = [new TextContentBlock { Text = payload.ToJsonString(Projection.JsonOptions) }],
            StructuredContent = JsonSerializer.SerializeToElement(payload),
            IsError = true,
        };
    }

    private static CallToolResult DescribeError(Exception ex) => ex switch
    {
        MissingApiKeyException => Fail(ex.Message, p =>
        {
            p["get_key_url"] = ApiConfig.GetKeyUrl;
            p["env"] = new JsonArray("DEVICESPECS_API_KEY", "DEVICESPECS_BASE_URL", "DEVICESPECS_API_HOST");
        }),
        DeviceSpecsApiException apiEx => Fail(apiEx.Message, p =>
        {
            p["http_status"] = apiEx.Status;
            p["body"] = apiEx.Body.Length > 500 ? apiEx.Body[..500] : apiEx.Body;
        }),
        _ => Fail($"Unexpected error: {ex.Message}"),
    };

    private static JsonArray Project(IEnumerable<JsonObject> devices, bool compact)
    {
        var arr = new JsonArray();
        foreach (var d in devices) arr.Add(compact ? Projection.ToNode(Projection.ToCompact(d)) : Projection.CleanDeep(d));
        return arr;
    }

    private static JsonNode? ProjectOne(JsonObject device, bool compact) => compact ? Projection.ToNode(Projection.ToCompact(device)) : Projection.CleanDeep(device);

    private static int ClampLimit(int limit) => Math.Clamp(limit, 1, 200);
    private static int ClampOffset(int offset) => Math.Max(0, offset);

    private static JsonObject ListResultNode(ListResult res, int offset, int limit, bool compact, Action<JsonObject>? head = null)
    {
        var o = new JsonObject();
        head?.Invoke(o);
        o["total"] = res.Total;
        o["returned"] = res.Items.Count;
        o["offset"] = offset;
        o["limit"] = limit;
        o["devices"] = Project(res.Items, compact);
        return o;
    }

    // ---- tools ----------------------------------------------------------------------------------

    [McpServerTool(Name = "get_phone_specs", Title = "Get phone specifications", ReadOnly = true, Idempotent = true, OpenWorld = true, Destructive = false)]
    [Description("Return the specification sheet for one smartphone by manufacturer and model name. Includes display (size, panel, refresh rate, brightness), chipset/CPU/GPU, RAM and storage options, battery capacity and charging, cameras, dimensions and weight, IP rating, connectivity (NFC, Bluetooth, USB, Wi-Fi), sound, benchmark scores, EU energy label, launch prices, colours and hardware model numbers. Model names follow catalog spelling, e.g. manufacturer='Samsung' model='Galaxy S24 Ultra', manufacturer='Apple' model='iPhone 15 Pro', manufacturer='Google' model='Pixel 9 Pro'.")]
    public async Task<CallToolResult> GetPhoneSpecs(
        [Description("Brand name, e.g. Samsung, Apple, Google, Xiaomi, OnePlus, vivo, Oppo, Motorola, Sony, Nothing.")] string manufacturer,
        [Description("Model name as marketed, without the brand, e.g. 'Galaxy S24 Ultra', 'iPhone 15 Pro', 'Pixel 9 Pro', 'Redmi Note 13 Pro+'.")] string model,
        [Description(CompactFalseDoc)] bool compact = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var device = await api.GetSpecs(manufacturer, model, cancellationToken).ConfigureAwait(false);
            if (device is null)
            {
                return Ok(new JsonObject
                {
                    ["found"] = false,
                    ["manufacturer"] = manufacturer,
                    ["model"] = model,
                    ["hint"] = "No phone with that exact model name. Try list_phones_by_manufacturer to see available model names, or lookup_model_number if you have a hardware code such as SM-S928B.",
                });
            }
            return Ok(new JsonObject { ["found"] = true, ["device"] = ProjectOne(device, compact) });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return DescribeError(ex);
        }
    }

    [McpServerTool(Name = "search_phones", Title = "Search phones by hardware filters", ReadOnly = true, Idempotent = true, OpenWorld = true, Destructive = false)]
    [Description("Find smartphones matching hardware criteria using the API's filter language: keys are '<property>[_<operator>]' and values are strings, numbers or booleans. Operators: (none)=equals, _gt, _gte, _lt, _lte, _contains, _in (comma list), _between ('min,max'), _has. Common properties: manufacturer, model, chipset, ram (GB), storage (GB), battery (mAh), refresh_rate (Hz), displaysize (inches), panel_type, brightness (nits), charging (W), wireless_charging, weight (g), ip_rating, nfc, headphone_jack, card_slot, stereo_speakers, infrared, price_usd, announcedate, android. Example: {\"manufacturer\":\"Samsung\",\"ram_gte\":12,\"refresh_rate_gte\":120,\"battery_gte\":5000}. All filters are ANDed. Call list_filter_properties for the complete list of properties and aliases. Results come back in catalog order (roughly newest first within a brand).")]
    public async Task<CallToolResult> SearchPhones(
        [Description("Map of filter key to value, e.g. {\"chipset_contains\":\"Snapdragon 8 Gen 3\",\"ram_gte\":12,\"headphone_jack\":true}. Unknown keys are ignored by the API.")] Dictionary<string, JsonElement> filters,
        [Description("Maximum number of phones to return (1-200, default 25).")] int limit = 25,
        [Description(OffsetDoc)] int offset = 0,
        [Description(CompactTrueDoc)] bool compact = true,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var query = new List<KeyValuePair<string, string?>>();
            var echo = new JsonObject();
            foreach (var (k, v) in filters ?? new Dictionary<string, JsonElement>())
            {
                var s = v.ValueKind switch
                {
                    JsonValueKind.String => v.GetString(),
                    JsonValueKind.Number => v.GetRawText(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    JsonValueKind.Null or JsonValueKind.Undefined => null,
                    _ => v.GetRawText(),
                };
                if (s is null) continue;
                query.Add(new(k, s));
                echo[k] = JsonNode.Parse(v.GetRawText());
            }
            if (query.Count == 0)
                return Fail("Provide at least one filter, e.g. {\"manufacturer\":\"Google\"} or {\"battery_gte\":5000}. Unfiltered listing is not allowed because it returns 10,000+ phones.");

            limit = ClampLimit(limit);
            offset = ClampOffset(offset);
            var res = await api.SearchDevices(query, limit, offset, cancellationToken).ConfigureAwait(false);
            var result = ListResultNode(res, offset, limit, compact);
            result["filters"] = echo;
            return Ok(result);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return DescribeError(ex);
        }
    }

    [McpServerTool(Name = "list_phones_by_manufacturer", Title = "List phones by manufacturer", ReadOnly = true, Idempotent = true, OpenWorld = true, Destructive = false)]
    [Description("List every phone in the catalog from one brand, with key specs for each. Useful to discover exact model names before calling get_phone_specs, or to browse a brand's line-up. Large brands have hundreds of models (Samsung ~1,500), so use limit/offset to page.")]
    public async Task<CallToolResult> ListPhonesByManufacturer(
        [Description("Brand name, e.g. Samsung, Apple, Google, Xiaomi, OnePlus, vivo, Oppo, Realme, Honor, Motorola, Sony, Nokia, Asus, Nothing, Huawei, ZTE, Lenovo, TCL, Tecno, Infinix.")] string manufacturer,
        [Description("Maximum number of phones to return (1-200, default 50).")] int limit = 50,
        [Description(OffsetDoc)] int offset = 0,
        [Description(CompactTrueDoc)] bool compact = true,
        CancellationToken cancellationToken = default)
    {
        try
        {
            limit = ClampLimit(limit);
            offset = ClampOffset(offset);
            var res = await api.DevicesByManufacturer(manufacturer, limit, offset, cancellationToken).ConfigureAwait(false);
            return Ok(ListResultNode(res, offset, limit, compact, o => o["manufacturer"] = manufacturer));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return DescribeError(ex);
        }
    }

    [McpServerTool(Name = "list_phones_by_chipset", Title = "List phones by chipset", ReadOnly = true, Idempotent = true, OpenWorld = true, Destructive = false)]
    [Description("List phones powered by a given system-on-chip. The chipset must match the catalog string exactly (case-insensitive), e.g. 'Google Tensor G4', 'Apple A17 Pro', 'Qualcomm SM8650-AC Snapdragon 8 Gen 3', 'Mediatek Dimensity 9300'. If you only know part of the name, use search_phones with {\"chipset_contains\":\"Snapdragon 8 Gen 3\"} instead.")]
    public async Task<CallToolResult> ListPhonesByChipset(
        [Description("Full chipset name as it appears in the catalog, e.g. 'Google Tensor G4'.")] string chipset,
        [Description("Maximum number of phones to return (1-200, default 50).")] int limit = 50,
        [Description(OffsetDoc)] int offset = 0,
        [Description(CompactTrueDoc)] bool compact = true,
        CancellationToken cancellationToken = default)
    {
        try
        {
            limit = ClampLimit(limit);
            offset = ClampOffset(offset);
            var res = await api.DevicesByChipset(chipset, limit, offset, cancellationToken).ConfigureAwait(false);
            var result = ListResultNode(res, offset, limit, compact, o => o["chipset"] = chipset);
            if (res.Items.Count == 0)
                result["hint"] = "No exact chipset match. Try search_phones with a chipset_contains filter, e.g. {\"chipset_contains\":\"Snapdragon 8 Gen 3\"}.";
            return Ok(result);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return DescribeError(ex);
        }
    }

    [McpServerTool(Name = "lookup_model_number", Title = "Identify a phone from its model number", ReadOnly = true, Idempotent = true, OpenWorld = true, Destructive = false)]
    [Description("Resolve a hardware model/variant code (the string printed on the device or returned by Android's Build.MODEL, e.g. 'SM-S928B', 'A3106', 'GP8GD', '2201116SG', 'TA-1004') to its marketing name, manufacturer and chipset, and return the full specification sheet when found.")]
    public async Task<CallToolResult> LookupModelNumber(
        [Description("Hardware model number or variant code, e.g. SM-S928B.")] string model_number,
        [Description(CompactFalseDoc)] bool compact = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var identity = await api.DeviceByModelNumber(model_number, cancellationToken).ConfigureAwait(false);
            if (identity is null)
            {
                return Ok(new JsonObject
                {
                    ["found"] = false,
                    ["model_number"] = model_number,
                    ["hint"] = "Model number not in the catalog. Codes are matched exactly; check for typos or regional suffixes (e.g. SM-S928B vs SM-S928U).",
                });
            }

            JsonObject? device = null;
            try
            {
                device = await api.GetSpecs(identity.Manufacturer, identity.ModelName, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[devicespecs-mcp] specs lookup after model-number match failed: {ex.Message}");
            }

            return Ok(new JsonObject
            {
                ["found"] = true,
                ["model_number"] = model_number,
                ["manufacturer"] = identity.Manufacturer,
                ["model"] = identity.ModelName,
                ["chipset"] = identity.SocName,
                ["device"] = device is null ? null : ProjectOne(device, compact),
            });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return DescribeError(ex);
        }
    }

    [McpServerTool(Name = "compare_phones", Title = "Compare phones side by side", ReadOnly = true, Idempotent = true, OpenWorld = true, Destructive = false)]
    [Description("Fetch two to four phones and return their key specs side by side plus a 'differences' map containing only the fields whose values differ, which is the quickest way to answer 'X vs Y' questions. Each phone is given as manufacturer + model in catalog spelling.")]
    public async Task<CallToolResult> ComparePhones(
        [Description("Two to four phones to compare.")] PhoneRef[] phones,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (phones is null || phones.Length < 2 || phones.Length > 4)
                return Fail("Provide between two and four phones, each as {\"manufacturer\":\"...\",\"model\":\"...\"}.");

            var fetched = await Task.WhenAll(phones.Select(p => api.GetSpecs(p.Manufacturer, p.Model, cancellationToken))).ConfigureAwait(false);
            var missing = new JsonArray();
            var found = new List<CompactDevice>();
            for (var i = 0; i < phones.Length; i++)
            {
                if (fetched[i] is { } d) found.Add(Projection.ToCompact(d));
                else missing.Add($"{phones[i].Manufacturer} {phones[i].Model}");
            }

            var devices = new JsonArray();
            var compared = new JsonArray();
            foreach (var d in found)
            {
                devices.Add(Projection.ToNode(d));
                compared.Add($"{d.Manufacturer} {d.Model}");
            }

            var result = new JsonObject
            {
                ["compared"] = compared,
                ["not_found"] = missing,
                ["devices"] = devices,
                ["differences"] = Projection.Differences(found),
            };
            if (missing.Count > 0) result["hint"] = "Some phones were not found; check model spelling with list_phones_by_manufacturer.";
            return Ok(result);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return DescribeError(ex);
        }
    }

    [McpServerTool(Name = "list_filter_properties", Title = "Filter language reference", ReadOnly = true, Idempotent = true, OpenWorld = false, Destructive = false)]
    [Description("Return the complete reference for the search_phones filter language: all operators (_gt, _gte, _lt, _lte, _contains, _in, _between, _has), every filterable property with its aliases, type and JSON path, usage notes and worked examples. No network call. Use it before composing a non-trivial search.")]
    public CallToolResult ListFilterProperties() => Ok(FilterReference.Reference());
}

[McpServerResourceType]
public sealed class FilterResources
{
    [McpServerResource(UriTemplate = "devicespecs://filters", Name = "filter-reference", Title = "Device Specs API filter reference", MimeType = "text/markdown")]
    [Description("Operators, properties and aliases accepted by the /devices search endpoint, as Markdown.")]
    public static string FilterReferenceMarkdown() => FilterReference.Markdown();
}
