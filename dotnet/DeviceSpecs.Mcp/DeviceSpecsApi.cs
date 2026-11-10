using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DeviceSpecs.Mcp;

/// <summary>Connection settings, read entirely from environment variables so the server works under any MCP host.</summary>
public sealed class ApiConfig
{
    public const string DefaultBaseUrl = "https://gsmarenaparser.p.rapidapi.com/";
    public const string DefaultApiHost = "gsmarenaparser.p.rapidapi.com";
    public const string GetKeyUrl = "https://rapidapi.com/controller2042000/api/gsmarenaparser";

    public string ApiKey { get; init; } = "";
    public string BaseUrl { get; init; } = DefaultBaseUrl;
    public string ApiHost { get; init; } = DefaultApiHost;
    public bool UsingDefaultGateway => BaseUrl == DefaultBaseUrl;

    public static ApiConfig FromEnvironment()
    {
        var baseUrl = (Environment.GetEnvironmentVariable("DEVICESPECS_BASE_URL") ?? "").Trim();
        if (baseUrl.Length == 0) baseUrl = DefaultBaseUrl;
        if (!baseUrl.EndsWith('/')) baseUrl += "/";
        var usingDefault = baseUrl == DefaultBaseUrl;
        var host = (Environment.GetEnvironmentVariable("DEVICESPECS_API_HOST") ?? "").Trim();
        if (host.Length == 0) host = usingDefault ? DefaultApiHost : new Uri(baseUrl).Host;
        return new ApiConfig
        {
            ApiKey = (Environment.GetEnvironmentVariable("DEVICESPECS_API_KEY") ?? "").Trim(),
            BaseUrl = baseUrl,
            ApiHost = host,
        };
    }
}

public sealed class DeviceSpecsApiException(int status, string body, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Body { get; } = body;
}

public sealed class MissingApiKeyException() : Exception(string.Join(" ",
    "No API key configured.",
    "Set the DEVICESPECS_API_KEY environment variable to your RapidAPI key.",
    $"Get a free key (no card required) at {ApiConfig.GetKeyUrl}",
    "Advanced: set DEVICESPECS_BASE_URL to point at a self-hosted gateway that does not need a key."));

public sealed record ListResult(List<JsonObject> Items, int? Total, bool PaginatedByServer);

public sealed record ModelNumberIdentity(string ModelName, string Manufacturer, string SocName);

/// <summary>Minimal HTTP client for the Device Specs API (mirrors the TypeScript server's api.ts).</summary>
public sealed class DeviceSpecsApi
{
    private const string PathDevices = "api/values/clean/devices";
    private const string PathByManufacturer = "api/values/clean/getdevices";
    private const string PathByChipset = "api/values/clean/devicesbychipset";
    private const string PathSpecs = "api/values/clean/getspecs";
    private const string PathByModelNumber = "api/values/clean/devicebymodelnumber";

    private readonly ApiConfig _cfg;
    private readonly HttpClient _http;

    public DeviceSpecsApi(ApiConfig cfg) : this(cfg, new HttpClient()) { }

    public DeviceSpecsApi(ApiConfig cfg, HttpClient http)
    {
        _cfg = cfg;
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(30);
        _http.DefaultRequestHeaders.Accept.Clear();
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("devicespecs-mcp-dotnet");
        if (_cfg.ApiKey.Length > 0)
        {
            _http.DefaultRequestHeaders.Add("x-rapidapi-key", _cfg.ApiKey);
            _http.DefaultRequestHeaders.Add("x-rapidapi-host", _cfg.ApiHost);
        }
    }

    public ApiConfig Config => _cfg;

    private void EnsureKey()
    {
        if (_cfg.UsingDefaultGateway && _cfg.ApiKey.Length == 0) throw new MissingApiKeyException();
    }

    private string BuildUrl(string path, IEnumerable<KeyValuePair<string, string?>>? query)
    {
        var url = _cfg.BaseUrl + path;
        if (query is null) return url;
        var parts = new List<string>();
        foreach (var (k, v) in query)
        {
            if (string.IsNullOrEmpty(v)) continue;
            parts.Add($"{Uri.EscapeDataString(k)}={Uri.EscapeDataString(v)}");
        }
        return parts.Count == 0 ? url : $"{url}?{string.Join("&", parts)}";
    }

    private async Task<(HttpResponseMessage Response, string Url)> Request(string path, IEnumerable<KeyValuePair<string, string?>>? query, CancellationToken ct)
    {
        EnsureKey();
        var url = BuildUrl(path, query);
        try
        {
            var res = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
            return (res, url);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new DeviceSpecsApiException(0, "", $"Network error calling {url}: {ex.Message}");
        }
    }

    private static async Task<JsonNode?> ReadJson(HttpResponseMessage res, string url, CancellationToken ct)
    {
        var text = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        var status = (int)res.StatusCode;
        if (res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.NoContent) return null;
        if (!res.IsSuccessStatusCode)
        {
            var hint = status switch
            {
                401 or 403 => $" Check DEVICESPECS_API_KEY (get one at {ApiConfig.GetKeyUrl}).",
                429 => " Rate limit or monthly quota exceeded on your RapidAPI plan.",
                _ => "",
            };
            throw new DeviceSpecsApiException(status, text, $"Device Specs API returned HTTP {status} for {url}.{hint}");
        }
        if (string.IsNullOrWhiteSpace(text)) return null;
        try
        {
            return JsonNode.Parse(text);
        }
        catch (JsonException)
        {
            throw new DeviceSpecsApiException(status, text, $"Device Specs API returned non-JSON for {url}");
        }
    }

    private async Task<ListResult> List(string path, IEnumerable<KeyValuePair<string, string?>> query, int? limit, int? offset, CancellationToken ct)
    {
        var q = new List<KeyValuePair<string, string?>>(query)
        {
            new("limit", limit?.ToString()),
            new("offset", offset?.ToString()),
        };
        var (res, url) = await Request(path, q, ct).ConfigureAwait(false);
        using (res)
        {
            var node = await ReadJson(res, url, ct).ConfigureAwait(false);
            var items = node is JsonArray arr ? arr.OfType<JsonObject>().Select(o => (JsonObject)o.DeepClone()).ToList() : new List<JsonObject>();
            int? total = null;
            if (res.Headers.TryGetValues("X-Total-Count", out var values) && int.TryParse(values.FirstOrDefault(), out var parsed)) total = parsed;
            if (total is not null) return new ListResult(items, total, true);

            // Older deployment: the server ignored limit/offset, so page on the client.
            var start = Math.Max(0, offset ?? 0);
            var sliced = items.Skip(start);
            if (limit is not null) sliced = sliced.Take(limit.Value);
            return new ListResult(sliced.ToList(), items.Count, false);
        }
    }

    public async Task<JsonObject?> GetSpecs(string manufacturer, string model, CancellationToken ct = default)
    {
        var path = $"{PathSpecs}/{Uri.EscapeDataString(manufacturer.Trim())}/{Uri.EscapeDataString(model.Trim())}";
        var (res, url) = await Request(path, null, ct).ConfigureAwait(false);
        using (res)
        {
            var node = await ReadJson(res, url, ct).ConfigureAwait(false);
            return node switch
            {
                JsonArray arr => arr.OfType<JsonObject>().FirstOrDefault() is { } first ? (JsonObject)first.DeepClone() : null,
                JsonObject obj when obj.Count > 0 => obj,
                _ => null,
            };
        }
    }

    public Task<ListResult> SearchDevices(IEnumerable<KeyValuePair<string, string?>> filters, int? limit, int? offset, CancellationToken ct = default)
        => List(PathDevices, filters, limit, offset, ct);

    public Task<ListResult> DevicesByManufacturer(string manufacturer, int? limit, int? offset, CancellationToken ct = default)
        => List($"{PathByManufacturer}/{Uri.EscapeDataString(manufacturer.Trim())}", [], limit, offset, ct);

    public Task<ListResult> DevicesByChipset(string chipset, int? limit, int? offset, CancellationToken ct = default)
        => List($"{PathByChipset}/{Uri.EscapeDataString(chipset.Trim())}", [], limit, offset, ct);

    public async Task<ModelNumberIdentity?> DeviceByModelNumber(string modelNumber, CancellationToken ct = default)
    {
        var path = $"{PathByModelNumber}/{Uri.EscapeDataString(modelNumber.Trim())}";
        var (res, url) = await Request(path, null, ct).ConfigureAwait(false);
        using (res)
        {
            if (await ReadJson(res, url, ct).ConfigureAwait(false) is not JsonObject obj) return null;
            var modelName = obj["modelName"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(modelName)) return null;
            return new ModelNumberIdentity(modelName, obj["manufacturer"]?.GetValue<string>() ?? "", obj["socName"]?.GetValue<string>() ?? "");
        }
    }
}
