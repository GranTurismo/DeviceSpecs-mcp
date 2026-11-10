# Device Specs MCP Server

[![NPM Version](https://img.shields.io/npm/v/@granturismo/devicespecs-mcp.svg)](https://www.npmjs.com/package/@granturismo/devicespecs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives Claude, Cursor, VS Code Copilot and any other MCP client grounded access to the **[Device Specs API](https://ds.gtgroup.dev)**: normalized hardware specifications for 10,000+ smartphones from Apple, Samsung, Google, Xiaomi, OnePlus, vivo, Oppo, Motorola, Sony, Nothing and 25+ more brands.

Ask things like:

- "What's the battery and charging speed on the Galaxy S24 Ultra?"
- "Find phones with a headphone jack, 5000 mAh and 120 Hz under 200 g."
- "Which phone is model number SM-S928B?"
- "Compare the Pixel 9 Pro and the iPhone 15 Pro."

Runs over stdio with `npx`, no install step.

## 1. Get an API key

The server talks to the API through RapidAPI. Create a free key (no card required) at
**https://rapidapi.com/controller2042000/api/deviceultraparser** and keep it handy.

## 2. Add the server to your client

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "devicespecs": {
      "command": "npx",
      "args": ["-y", "@granturismo/devicespecs-mcp"],
      "env": {
        "DEVICESPECS_API_KEY": "YOUR_RAPIDAPI_KEY"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add devicespecs -e DEVICESPECS_API_KEY=YOUR_RAPIDAPI_KEY -- npx -y @granturismo/devicespecs-mcp
```

### Cursor

`.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "devicespecs": {
      "command": "npx",
      "args": ["-y", "@granturismo/devicespecs-mcp"],
      "env": { "DEVICESPECS_API_KEY": "YOUR_RAPIDAPI_KEY" }
    }
  }
}
```

### VS Code (Copilot agent mode)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "devicespecs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@granturismo/devicespecs-mcp"],
      "env": { "DEVICESPECS_API_KEY": "${input:devicespecs-key}" }
    }
  },
  "inputs": [
    { "id": "devicespecs-key", "type": "promptString", "description": "Device Specs API key", "password": true }
  ]
}
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

### Filter language in one line

`search_phones` takes `filters` as a JSON object of `"<property>[_<operator>]": value`, for example
`{"manufacturer":"Samsung","ram_gte":12,"refresh_rate_gte":120,"battery_gte":5000,"headphone_jack":true}`.
Operators: `_gt`, `_gte`, `_lt`, `_lte`, `_contains`, `_in` (comma list), `_between` (`"min,max"`), `_has`.
Full property list: call `list_filter_properties` or read https://ds.gtgroup.dev/docs.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DEVICESPECS_API_KEY` | (none) | Your RapidAPI key. Required when using the default gateway. |
| `DEVICESPECS_BASE_URL` | `https://deviceultraparser.p.rapidapi.com/` | API gateway base URL. Point it at another host if you self-host or have a direct contract. |
| `DEVICESPECS_API_HOST` | `deviceultraparser.p.rapidapi.com` | Value sent in `x-rapidapi-host`. |

Without a key the data tools return a clear error with the sign-up link; `list_filter_properties` always works offline.

## Development

```bash
npm install
npm run build
DEVICESPECS_BASE_URL=https://dsapi.gtgroup.dev/ npm run smoke   # end-to-end stdio test
```

Publishing to the official MCP registry (`server.json` is included) is a follow-up step: see https://github.com/modelcontextprotocol/registry.

## Links

- Website and docs: https://ds.gtgroup.dev and https://ds.gtgroup.dev/docs
- Other SDKs: [TypeScript](https://github.com/GranTurismo/DeviceSpecs-npm) (`npm i @granturismo/devicespecs`), [Python](https://github.com/GranTurismo/DeviceSpecs-python) (`pip install devicespecs`), [.NET](https://github.com/GranTurismo/DeviceSpecs-nuget) (`dotnet add package DeviceSpecs`)
- Get an API key: https://rapidapi.com/controller2042000/api/deviceultraparser

## License

MIT
