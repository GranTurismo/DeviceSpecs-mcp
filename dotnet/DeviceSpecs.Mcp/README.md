# Device Specs MCP Server (.NET)

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives Claude, GitHub Copilot (VS Code / Visual Studio), Cursor and any other MCP client grounded access to the **[Device Specs API](https://ds.gtgroup.dev)**: normalized hardware specifications for 10,000+ smartphones from Apple, Samsung, Google, Xiaomi, OnePlus, vivo, Oppo, Motorola, Sony, Nothing and 25+ more brands.

This is the .NET build of the server, published to NuGet as an MCP server package. The identical server is also on npm as `@granturismo/devicespecs-mcp`.

## 1. Get an API key

Create a free key (no card required) at **https://rapidapi.com/controller2042000/api/gsmarenaparser**.

## 2. Run it with `dnx` (.NET 10 SDK)

No install step: `dnx` downloads the package on first use.

### VS Code (`.vscode/mcp.json`)

```json
{
  "inputs": [
    { "type": "promptString", "id": "devicespecs_api_key", "description": "Device Specs API key (RapidAPI)", "password": true }
  ],
  "servers": {
    "devicespecs": {
      "type": "stdio",
      "command": "dnx",
      "args": ["DeviceSpecs.Mcp", "--yes"],
      "env": { "DEVICESPECS_API_KEY": "${input:devicespecs_api_key}" }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "devicespecs": {
      "command": "dnx",
      "args": ["DeviceSpecs.Mcp", "--yes"],
      "env": { "DEVICESPECS_API_KEY": "YOUR_RAPIDAPI_KEY" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add devicespecs -e DEVICESPECS_API_KEY=YOUR_RAPIDAPI_KEY -- dnx DeviceSpecs.Mcp --yes
```

### Or install as a global .NET tool

```bash
dotnet tool install -g DeviceSpecs.Mcp
# then use "command": "devicespecs-mcp" in your MCP client configuration
```

## Tools

| Tool | What it does |
|---|---|
| `get_phone_specs` | Full (or compact) specification sheet for one phone by manufacturer + model. |
| `search_phones` | Filter the whole catalog by hardware criteria (RAM, battery, refresh rate, NFC, headphone jack, price, chipset, ...). |
| `list_phones_by_manufacturer` | Every model from one brand, paged, with key specs. |
| `list_phones_by_chipset` | Every phone using a given SoC. |
| `lookup_model_number` | Resolve a hardware code such as `SM-S928B` to its marketing name and specs. |
| `compare_phones` | Side-by-side key specs for 2 to 4 phones plus a `differences` map. |
| `list_filter_properties` | Offline reference of the filter language (operators, properties, aliases, examples). |

A resource `devicespecs://filters` exposes the same filter reference as Markdown.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DEVICESPECS_API_KEY` | (none) | Your RapidAPI key. Required when using the default gateway. |
| `DEVICESPECS_BASE_URL` | `https://gsmarenaparser.p.rapidapi.com/` | API gateway base URL. Point it at another host if you self-host. |
| `DEVICESPECS_API_HOST` | `gsmarenaparser.p.rapidapi.com` | Value sent in `x-rapidapi-host`. |

## Links

- Website and docs: https://ds.gtgroup.dev/docs
- Source: https://github.com/GranTurismo/DeviceSpecs-mcp (folder `dotnet/`)
- C# SDK for your own code: `dotnet add package DeviceSpecs`

MIT License.
