# Features

A detailed breakdown of every feature in Romelson.

---

## Chat

The core experience. Chat with any configured AI provider.

### Model Selection
The model dropdown (bottom-left of composer) shows all providers that have a valid API key. Models are sorted by their `rank` field within each provider — lower rank = better/flagship model. The dropdown remembers your last selection within a session.

When you send a message, the app always tries your selected model first. If it fails, it automatically falls back through a ranked list of alternatives (same provider first, then other providers). You see a status message in the agent log when failover happens.

### Streaming
Responses stream token by token. Markdown is re-rendered every 80ms during streaming so formatting appears progressively. A blinking cursor tracks the end of the streamed text. Once the response is complete, the cursor disappears and the final markdown render happens.

### Image Attachments
Models that support image input (Claude, GPT-4o, Gemini) accept images via paste (Ctrl+V / Cmd+V). Images are shown as thumbnails in the composer before sending. The attachment button shows which models support images — if your selected model doesn't support images, you get a warning and the send button stays disabled.

### Token Footer
Every AI response shows a token usage footer: input tokens ↑, output tokens ↓, and an estimated cost based on published pricing. This is always visible (not togglable).

### Code Blocks
Code in responses gets a header with the detected language, a **Copy** button, and a **Download** button. Download saves the code with the correct file extension (`.py`, `.js`, `.sql`, etc.).

### Message Actions
Hover over any message (user or assistant) to reveal a **Copy** button.

---

## Tools (Live Data)

The AI can call external APIs to answer real-time questions. Tools are defined in `Public/Assets/Scripts/Features/Chat/Tools/` and executed in `Executors/`.

### Weather
**Tool:** `get_weather`  
**Provider:** Open-Meteo (free, no key required)  
**Try:** "What's the weather in Chennai?" or "Will it rain in Tokyo tomorrow?"

Returns current conditions (temperature, humidity, wind, cloud cover, pressure) and a 3-day forecast.

### Crypto Prices
**Tool:** `get_crypto_price`, `get_crypto_trending`  
**Provider:** CoinGecko (free, no key required)  
**Try:** "What's the price of Ethereum?" or "What coins are trending right now?"

Returns price in multiple currencies, 24h change, market cap, trading volume.

### Exchange Rates
**Tool:** `get_exchange_rate`  
**Provider:** open.er-api.com (free, no key required)  
**Try:** "Convert 100 USD to INR" or "What's the EUR/GBP rate?"

Supports 160+ currencies, returns all major rates at once.

### US Treasury Data
**Tool:** `get_treasury_data`  
**Provider:** fiscaldata.treasury.gov (free, no key required)  
**Try:** "What is the current US national debt?" or "Show treasury interest rates"

Three data types: `debt` (national debt), `rates` (average interest rates), `balance` (daily cash).

### FRED Economic Data
**Tool:** `get_fred_data`  
**Provider:** Federal Reserve Bank of St. Louis  
**Key:** Optional free key from fred.stlouisfed.org (public access is rate-limited)  
**Try:** "Show me US GDP" or "What's the current unemployment rate?"

Common series IDs: `GDP`, `UNRATE`, `CPIAUCSL`, `FEDFUNDS`, `DGS10`, `SP500`.

### Photos
**Tool:** `search_photos`  
**Provider:** Unsplash  
**Key:** Required — get free key at unsplash.com/developers  
**Try:** "Find me photos of minimal workspace setups"

Returns photo URLs, photographer credits, dimensions, and like counts.

### Gmail (when connected)
**Tools:** `gmail_read_inbox`, `gmail_send_email`, `gmail_search_emails`  
**Try:** "Read my unread emails" or "Search for emails from my boss" or "Send an email to alice@example.com"

### GitHub (when connected)
**Tools:** `github_list_repos`, `github_get_issues`, `github_get_pull_requests`, `github_get_file`, `github_get_file_tree`, `github_get_notifications`  
**Try:** "Show my open PRs" or "Load the README from my main repo" or "What issues are open in withinjoel/Romelson?"

---

## Automations

Schedule sequences of actions to run automatically.

### Triggers
- **On startup** — runs every time you open Romelson
- **Every N minutes** — interval timer (minimum 1 minute)
- **Every hour** — at the top of each hour
- **Daily at time** — once per day at a set time
- **Weekly on day** — once per week on a specific day and time

### Actions (35+ available)
See [Automations.md](Automations.md) for the full list with configuration details.

**System:** open site, open multiple sites, open folder, run command, run script, open app, send notification, copy to clipboard, write file, move file, copy file, delete file, create folder, lock screen, HTTP request/webhook

**Gmail:** send email, email brief notification, unread count notification, search & notify

**GitHub:** open repo in browser, check PRs, check issues, check commits, check latest release, check notifications, create issue

### Action Chaining
Each automation can have multiple actions in sequence. They run in order, one after another. If any action throws an error, that action is logged and the automation continues with the next action.

### Last Run Tracking
Each automation card shows when it last ran. The `lastRun` timestamp is updated after each successful execution and persisted to `Data/Automations.json`.

---

## Connectors

Connectors link external services so the AI and automations can interact with them.

See [Connectors.md](Connectors.md) for setup instructions.

### Service Connectors (require credentials)
- **Gmail** — OAuth 2.0 flow using your own Google Cloud project credentials
- **GitHub** — Personal Access Token

### Free API Connectors (enabled by default)
Open-Meteo, CoinGecko, Exchange Rates, US Treasury, FRED, OpenWeatherMap, Unsplash

Each free connector has a toggle. Some (FRED, Unsplash) support an optional API key to unlock higher rate limits or additional features.

---

## Skills

Skills are markdown files in the `Skills/` folder with YAML frontmatter. They are read at runtime and injected into the system prompt context when relevant.

The AI planning step determines which skills apply to a given request. Skill metadata (name, trigger, description) is passed to the planner; the planner decides which are relevant and logs them in the agent log before the response.

Skills are read-only in the UI (browse via the Skills page). To add or modify skills, edit the `.md` files directly.

See [Skills.md](Skills.md) for the skill file format and how to write new ones.

---

## Personas

Personas are markdown files in the `Personas/` folder with YAML frontmatter. The active persona replaces the default assistant identity in the system prompt.

### Switching Personas
Open the Personas page from the sidebar. Click **Activate** on any persona card. The system prompt is rebuilt immediately (cache invalidated). Click **Chat** to activate a persona and jump straight to chat.

### Included Personas
| Persona | Role |
|---|---|
| Atlas | High-performance execution coach |
| Cassian | Negotiation and communication strategist |
| Dante | Master storyteller and narrative architect |
| Elio | Empathetic emotional companion |
| Franklin | Leadership and confidence coach |
| Iris | Deep research analyst |
| Lyra | Creative and unconventional thinker |
| Nova | Curious explorer and learning guide |
| Rex | Fitness and nutrition coach |
| Sage | Mindfulness and wellness guide |
| Solen | Philosopher and introspective guide |

See [Personas.md](Personas.md) for the persona file format.

---

## Usage Analytics

The Usage page tracks every API call made through Romelson.

### What's Tracked
Per call: timestamp, provider, model, model name, input tokens, output tokens, chat ID.

Data is stored locally in `Data/Usage.json`. Up to 20,000 records are kept (oldest are dropped when the limit is reached).

### Analytics
- **Summary cards** — total tokens, API calls, estimated cost, avg cost/call, models used
- **Daily bar chart** — token usage over time (stacked input/output)
- **Auto insights** — most-used model, peak hour, busiest day, token ratio analysis, cost efficiency ranking, weekend vs weekday patterns, provider cost breakdown, response verbosity
- **Hourly heatmap** — 24-hour activity distribution
- **Day of week breakdown** — call volume and cost per weekday
- **Cost table** — top 10 models by spend with share of total
- **Model breakdown** — tokens and cost per model with visual bar
- **Provider cards** — tokens, cost, calls per provider
- **Recent activity** — last 50 API calls with timing

### Filters
Filter by Today / 7 days / 30 days / All time using the range buttons at the top right. All charts and tables update immediately.

---

## Settings

Accessed via the avatar button (bottom-left of sidebar) → Settings.

### User Tab
- **Name** — displayed in the welcome screen and avatar
- **Memory** — persistent notes injected into every conversation (e.g. "I am Joel Jolly, my mom's name is Jessie")
- **Custom Instructions** — AI behaviour rules (e.g. "You should be sweet and kind to me")

### Providers Tab
Add or update API keys for each AI provider. Keys are stored in `Data/User.json` under `api_keys`. Changes trigger a model list reload and system prompt cache invalidation.

### Connectors Tab
Manage Gmail and GitHub connections, plus free API toggles and optional keys. See [Connectors.md](Connectors.md).

---

## Themes

Five themes are available via the theme toggle button (sun/moon icon in the sidebar):

| Theme | Character |
|---|---|
| Dark | Warm charcoal with terracotta accent (default) |
| Light | Off-white editorial with brick accent |
| Midnight | Deep navy with electric blue accent |
| Forest | Dark green with emerald accent |
| Pinky | Deep rose with hot pink accent |

Theme selection is persisted to `localStorage` and applied immediately on next launch without a flash.

---

## Chat History (Library)

All conversations are automatically saved to `Data/Chats/`. Open the Library (book icon in sidebar) to browse and search past conversations.

- Search by title (first user message, truncated to 70 chars)
- Click any chat to reload it, including restoring the provider/model used
- Delete individual chats from the library list
- Loading a chat on another page (automations, skills, etc.) uses `localStorage` as a pending redirect

---

## Window Controls

Romelson uses a frameless window with custom titlebar controls. The minimize, maximize/restore, and close buttons are in the top-right corner. The drag region is the titlebar area.
