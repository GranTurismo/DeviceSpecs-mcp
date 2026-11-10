using DeviceSpecs.Mcp;
using DeviceSpecs.Mcp.Tools;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Protocol;

var builder = Host.CreateApplicationBuilder(args);

// stdout carries the MCP protocol; every log line must go to stderr.
builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace);
builder.Logging.SetMinimumLevel(LogLevel.Warning);

var config = ApiConfig.FromEnvironment();
builder.Services.AddSingleton(config);
builder.Services.AddSingleton<DeviceSpecsApi>();

builder.Services
    .AddMcpServer(o =>
    {
        o.ServerInfo = new Implementation { Name = "devicespecs", Version = ServerVersion.Value };
        o.ServerInstructions = string.Join(" ",
            "Device Specs API: normalized hardware specifications for 10,000+ smartphones (Apple, Samsung, Google, Xiaomi, OnePlus, vivo, Oppo, Motorola, Sony, Nothing and 25+ more brands, 1995 to today).",
            "Use get_phone_specs when the user names a phone. Use search_phones to find phones by hardware criteria; call list_filter_properties first if unsure which filter keys exist.",
            "Model names must match the catalog spelling (e.g. 'Galaxy S24 Ultra', 'iPhone 15 Pro', 'Pixel 9 Pro'); if a lookup returns not_found, try list_phones_by_manufacturer and pick the closest model, or lookup_model_number for codes like SM-S928B.",
            "Prices (price_usd) are launch prices and are only known for a subset of phones; 0 or null means unknown.");
    })
    .WithStdioServerTransport()
    .WithTools<DeviceSpecsTools>()
    .WithResources<FilterResources>();

var host = builder.Build();

Console.Error.WriteLine(
    $"[devicespecs-mcp] v{ServerVersion.Value} ready on stdio (gateway: {config.BaseUrl}" +
    (config.ApiKey.Length > 0 ? ", key set" : config.UsingDefaultGateway ? ", NO KEY: set DEVICESPECS_API_KEY" : ", no key") + ")");

await host.RunAsync();

namespace DeviceSpecs.Mcp
{
    internal static class ServerVersion
    {
        public static readonly string Value =
            typeof(ServerVersion).Assembly.GetName().Version is { } v ? $"{v.Major}.{v.Minor}.{v.Build}" : "0.0.0";
    }
}
