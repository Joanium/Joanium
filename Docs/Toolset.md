# Toolset System

The toolset system discovers, manages, and executes AI-callable tools. It handles tool discovery, connector credentials, OAuth flows, and tool execution.

---

## Architecture

```text
Toolset Package
├── Core/
│   ├── ToolsetService.js       — Built-in tool executor with 40+ tools
│   ├── ToolDiscovery.js        — Auto-discovers tool packages
│   ├── ConnectorState.js       — Persists connector credentials
│   ├── ConnectorFilter.js      — Filters tools by connector availability
│   ├── ConnectorCatalog.js     — Connector metadata
│   ├── ConnectorHttp.js        — HTTP client for connectors
│   ├── ConnectorToolAdapter.js — Bridges connector executor code
│   ├── GoogleOAuth.js          — Google OAuth 2.0 flow
│   ├── Prompts.js              — Tool-related prompt fragments
│   └── Utils.js                — summarizeToolDefinitions, withTimeout
├── UI/
│   └── ConnectorSettings.js    — Connector settings panel
├── I18n/
│   ├── en.js                   — Tool strings
│   └── Connectors.en.js        — Connector strings
├── Tools/
│   └── <ToolName>/             — 27 local tool packages
└── Catalogue.js                — Dynamic fuzzy-matching catalogue
```

---

## Tool Package Standard

Each tool package under `Tools/<ToolName>/` follows a standard shape:

```text
Tools/<ToolName>/
├── Index.js       ← Only file Toolset discovery imports
├── Tools.js       ← Tool definitions
├── Executors.js   ← Tool execution handlers
├── Prompt.js      ← Tool-specific prompt sections
├── Core/          ← Backend logic
├── I18n/          ← Tool-specific strings
└── UI/            ← Tool-specific UI (optional, rarely used)
```

AI-facing prompt text, tool descriptions, parameter descriptions, and tool schemas must not live in `I18n/`. Put prompt sections in `Prompt.js`; put tool definitions in `Tools.js` or, for large tool lists, `Core/Chat/Tools.js` re-exported by `Tools.js`. Keep `I18n/` for user-facing UI text, connector labels, and runtime result/error strings.

### Tool Package Exports

Each `Index.js` exports:

- `createToolPackage()` — Returns tool definitions, handlers, and prompt sections
- Standard tool discovery shape

### Tool Package Directory

```text
Packages/Toolset/Tools/
├── Cloudflare/
├── Command/
├── ComputerUse/
├── Core/              ← Built-in tool implementations (not a tool package)
├── Directory/
├── Figma/
├── Git/
├── GitHub/
├── GitLab/
├── Google/
├── GoogleWorkspace.js ← Google Workspace tools (single file)
├── HubSpot/
├── Jira/
├── Knowledge/
├── Linear/
├── Location/
├── Netlify/
├── Notion/
├── OpenWeather/
├── Productivity/
├── PublicData/
├── Security/          ← Security-related tools (not the Security package)
├── Sentry/
├── Spotify/
├── Stripe/
├── SubAgents/
├── Supabase/
├── Unsplash/
└── Vercel/
```

---

## Tool Discovery

`ToolDiscovery.js` scans `Tools/` for subdirectories with `Index.js`. It also discovers tool packages from external packages (e.g., `LiveBrowser`).

**Discovery process**:

1. Reads `Tools/` directory, filters out `Core/` (support directory)
2. Checks for `Index.js` in each subdirectory
3. Dynamically imports `Index.js` and calls `createToolPackage()`
4. Normalizes the result: ensures `toolDefinitions`, `toolHandlers`, `promptSections`, `connectors`, `ipcHandlers` are arrays/objects
5. Normalizes connector definitions (adds `optional: false`, `credentialKey: 'token'` defaults)

**External discovery**:

- Uses the package registry to load external tool packages (e.g., `LiveBrowser`)
- Calls `createToolPackage()` on external packages just like local ones

**Returns**:

```js
{
  packages,           // Array of normalized tool package objects
  toolDefinitions,    // Flattened array of all tool definitions
  promptSections,     // Flattened array of all prompt sections
  ipcHandlers,        // Flattened array of all IPC handlers
  toolHandlers,       // Merged object of all tool handlers (keyed by tool name)
  connectors,         // Flattened array of all connector definitions
}
```

---

## Built-in Tools (in ToolsetService.js)

The tool executor registers built-in handlers for tools that don't need separate packages:

### Math

| Tool | Description |
|---|---|
| `calculate_expression` | Full expression evaluator with operator precedence (+, -, *, /, %, ^, parentheses) |

### Unit Conversion

| Tool | Description |
|---|---|
| `convert_units` | 30+ units across length (mm, cm, m, km, in, ft, yd, mi), weight (mg, g, kg, oz, lb, st), volume (ml, l, tsp, tbsp, floz, cup, pt, qt, gal), speed (m/s, km/h, mph, knot) |

### Date/Time (20+ tools)

| Tool | Description |
|---|---|
| `get_time_in_timezone` | Current time in any IANA timezone with locale formatting |
| `calculate_date` | Add/subtract months, years, days, business days from a date |
| `convert_timezone` | Convert a date/time between timezones |
| `is_weekend` | Check if a date falls on weekend |
| `business_days_between` | Count business days between two dates |
| `add_business_days` | Add business days to a date (skips weekends) |
| `next_weekday_occurrence` | Find next occurrence of a specific weekday |
| `age_calculator` | Calculate age from date of birth |
| `days_until_birthday` | Days until next birthday |
| `get_season` | Get astronomical season for a date (Northern hemisphere) |
| `get_month_info` | Days in month, leap year check, day of year |
| `get_quarter_info` | Quarter number, start/end dates |
| `lunar_phase` | Current moon phase, illumination, days until full moon |
| `week_bounds` | Start/end of the current week |
| `month_bounds` | Start/end of the current month |
| `year_progress` | Percentage through the year, day of year, week number |
| `detailed_difference` | Years, months, days between two dates |
| `nth_weekday_of_month` | Find nth occurrence of a weekday in a month (-1 for last) |
| `timezone_overlap` | Overlap hours between two timezones |
| `century_decade_info` | Century and decade information for a year |
| `unix_converter` | Convert between Unix timestamp and human-readable date |
| `time_until_datetime` | Time remaining until a target date/time |

### URL (15+ tools)

| Tool | Description |
|---|---|
| `parse_url` | Parse URL into components (protocol, host, path, query, hash) |
| `extract_query_params` | Extract query parameters as object |
| `build_url` | Build URL from components |
| `add_utm_params` | Add UTM tracking parameters |
| `remove_tracking_params` | Remove 20+ tracking parameters (utm_*, fbclid, gclid, etc.) |
| `encode_url` / `decode_url` | URL encoding/decoding |
| `extract_domain` | Extract domain from URL |
| `slugify_to_url` | Convert text to URL-friendly slug |
| `extract_urls_from_text` | Find all URLs in text |
| `compare_urls` | Compare two URLs for equality |
| `url_to_markdown_link` / `url_to_html_link` | Format URL as link |
| `url_to_base64` | Convert URL to base64 data URI |
| `count_url_params` | Count query parameters |

### Geospatial (8 tools)

| Tool | Description |
|---|---|
| `get_distance` | Haversine distance between two coordinates |
| `get_midpoint` | Midpoint between two coordinates |
| `check_point_in_radius` | Check if a point is within a radius |
| `convert_dms_to_dd` / `convert_dd_to_dms` | Coordinate format conversion |
| `encode_geohash` / `decode_geohash` | Geohash encoding/decoding |
| `get_map_url` | Generate map URL for coordinates |

### Crypto/Encoding

| Tool | Description |
|---|---|
| `generate_uuid` | Generate UUID v4 (1-20, optional uppercase) |
| `hash_text` | SHA-1/256/384/512 hash |
| `encode_base64` / `decode_base64` | Base64 encode/decode |

### JSON/Text

| Tool | Description |
|---|---|
| `format_json` | Pretty-print JSON with optional key sorting |
| `convert_text_case` | Convert text case (upper, lower, title, sentence, camel, snake, kebab) |
| `get_text_stats` | Word count, character count, sentence count, reading time |

### Security

| Tool | Description |
|---|---|
| `generate_password` | Generate random password with configurable length and character sets |

---

## Tool Packages (27)

26 tool packages with `Index.js` plus `GoogleWorkspace.js`:

| Package | Description |
|---|---|
| Cloudflare | Cloudflare API tools |
| Command | Local command execution |
| ComputerUse | OS-level screen, mouse, keyboard, clipboard, and window tools |
| Directory | Workspace inspection |
| Figma | Figma design tools |
| Git | Git operations |
| GitHub | GitHub API tools |
| GitLab | GitLab API tools |
| Google | Google API tools |
| GoogleWorkspace | Google Workspace tools (Gmail, Drive, Calendar, Contacts, Docs, Forms, Photos, Sheets, Slides, Tasks, YouTube) via OAuth |
| HubSpot | HubSpot CRM tools |
| Jira | Jira project management |
| Knowledge | Knowledge base tools |
| Linear | Linear issue tracking |
| Location | Geolocation tools |
| Netlify | Netlify deployment tools |
| Notion | Notion workspace tools |
| OpenWeather | Weather data tools |
| Productivity | Productivity tools |
| PublicData | Wikipedia, Stack Overflow, npm, weather, etc. |
| Sentry | Sentry error tracking |
| Spotify | Spotify API tools |
| Stripe | Stripe payment tools |
| SubAgents | Sub-agent spawning |
| Supabase | Supabase database tools |
| Unsplash | Unsplash image search |
| Vercel | Vercel deployment tools |

**Note**: The `Tools/Core/` and `Tools/Security/` directories are support directories, not tool packages.

See [ComputerUse.md](ComputerUse.md) and [SubAgents.md](SubAgents.md) for details on specific tool packages.

---

## Connector System

Connectors are API-key-backed credentials for external services.

### Connector State

`ConnectorState.js` persists credentials in `Data/User.json` under the `connectors` key.

### Connector Filtering

`ConnectorFilter.js` filters tools and prompt sections based on which connectors are configured:

1. Partitions connectors into active (configured) and disconnected
2. Filters tool definitions by active connector IDs
3. Filters prompt sections by active connector packages
4. Builds connected/disconnected hint messages for the system prompt
5. Tools requiring a missing connector are hidden from the AI

### Connector Catalog

`ConnectorCatalog.js` maps connectors to their tools and metadata.

### Google OAuth

`GoogleOAuth.js` implements Google OAuth 2.0 for Google Workspace tools (Gmail, Drive, Calendar, Contacts, Docs, Forms, Photos, Sheets, Slides, Tasks, YouTube).

---

## Tool Execution Flow

```text
AI response contains tool call block
    ↓
RendererToolLoop.parseAllToolRequests()
    ↓
Extracts joanium-terminal and joanium-tool blocks
    ↓
Falls back to plain JSON / ```json blocks for reasoning models
    ↓
Deduplicates identical tool calls
    ↓
toolset:execute-tool IPC call
    ↓
ToolsetService.executeTool(payload, context)
    ↓
Normalizes parameters (merges parameters, arguments, top-level keys)
    ↓
Routes to built-in handler or tool package handler
    ↓
Executes with 30-second timeout
    ↓
Returns { ok, tool, output } or { ok, tool, error }
    ↓
Result injected into AI context
    ↓
AI continues with tool result
```

---

## Tool Loop

The tool loop is implemented in `Packages/Shared/ToolLoop/RendererToolLoop.js`:

1. AI response is parsed for `joanium-terminal` and `joanium-tool` blocks
2. Fallback: extracts tool calls from plain JSON or ````json` blocks
3. Deduplicates identical tool calls
4. Each tool call is executed via IPC
5. Results are fed back to the AI
6. Loop repeats up to `maxToolCalls` (10 for chat, 1000 for agents)
7. Final response is rendered

---

## Catalogue System

`Catalogue.js` implements a dynamic fuzzy-matching catalogue:

- Two always-in-context tools: `list_available_tools` and `get_tool_schemas`
- Give the AI lazy access to every connector without flooding context
- AI can discover tools on-demand

---

## Tool Prompt Sections

Each tool package can provide prompt sections that are added to the AI's system context. These are collected during discovery and merged into the system prompt.

When connector state is available, prompt sections are filtered to only those whose connector is configured (or public/no-credential). Connected and disconnected hint messages are appended.

---

## Tool Execution Timeout

Tools are executed with a 30-second timeout via `withTimeout()`. Long-running tools are aborted if they exceed the timeout. The timeout message includes the tool name and duration.

---

## Tool Definition Format

```js
{
  name: 'tool_name',
  description: 'What the tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Description' }
    },
    required: ['param1']
  }
}
```
