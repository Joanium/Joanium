# Connectors

Connectors link Romelson to external services. There are two types: service connectors (Gmail, GitHub) that require credentials, and free API connectors that are enabled by default.

---

## Gmail

Gmail uses OAuth 2.0. You need a Google Cloud project with OAuth credentials to connect — this takes about 5 minutes and is free.

### Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API**: APIs & Services → Enable APIs → search "Gmail API" → Enable
4. Create OAuth credentials: APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Desktop app**
   - Name it anything (e.g. "Romelson")
5. Download or copy the **Client ID** and **Client Secret**
6. In Romelson: Settings → Connectors → Gmail → paste Client ID and Client Secret → Sign in with Google
7. Approve the permissions in the browser window that opens

### Scopes Requested
- `gmail.readonly` — read emails
- `gmail.send` — send emails
- `userinfo.email` — verify your email address

### Token Refresh
Access tokens expire after 1 hour. Romelson automatically refreshes them using the stored refresh token — you don't need to reconnect. The refreshed token is immediately persisted to `Data/Connectors.json`.

### Reconnecting
If Gmail stops working (refresh token revoked, credentials changed), go to Settings → Connectors → Gmail → Disconnect, then reconnect.

### What Gmail Enables
- **In chat:** "Read my unread emails", "Search for emails from [name]", "Send an email to [address]"
- **In automations:** email brief notification, unread count, search & notify, send email

---

## GitHub

GitHub uses a Personal Access Token (PAT). Classic tokens are easiest; fine-grained tokens work too with the right permissions.

### Setup Steps

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens/new?scopes=repo,read:user,notifications)
2. Create a **classic** Personal Access Token
3. Required scopes:
   - `repo` — read repos, issues, PRs, commits, files
   - `read:user` — get your username and profile
   - `notifications` — read GitHub notifications
4. Copy the generated token (starts with `ghp_`)
5. In Romelson: Settings → Connectors → GitHub → paste the token → Connect GitHub

### What GitHub Enables
**System prompt context:** Your GitHub username and last 20 repos (name, description, language) are automatically included in every chat. Ask "what are my repos?" and the AI already knows.

**In chat:** list repos, get issues/PRs, load file contents, load file tree, get notifications  
**In automations:** check PRs/issues/commits/releases, create issues, open repo in browser

### Token Rotation
If you need to rotate your PAT, just paste the new token in Settings → Connectors → GitHub → Update credentials.

---

## Free API Connectors

These connectors are enabled by default and require no setup. Manage them in Settings → Connectors → Free APIs.

### Open-Meteo 🌤️
Real-time weather and forecast for any city. No key needed.  
`get_weather` tool. Ask: "What's the weather in Mumbai?"

### CoinGecko 🦎
Live crypto prices for 10,000+ tokens. No key needed.  
`get_crypto_price`, `get_crypto_trending` tools.  
Ask: "What's the price of Bitcoin in INR?" or "What's trending?"

### Exchange Rates 💱
Real-time rates for 160+ currencies via open.er-api.com. No key needed.  
`get_exchange_rate` tool. Ask: "Convert 500 EUR to JPY"

### US Treasury 🏛️
Official US fiscal data from fiscaldata.treasury.gov. No key needed.  
`get_treasury_data` tool. Three types: `debt`, `rates`, `balance`.  
Ask: "What's the US national debt right now?"

### FRED (Federal Reserve) 📊
Economic data from the St. Louis Fed — 800,000+ series.  
`get_fred_data` tool.  
**Optional API key** from [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) (free) — unlocks full access and higher rate limits. Without a key, public access works for most series.

Common series: `GDP`, `UNRATE`, `CPIAUCSL` (CPI/inflation), `FEDFUNDS`, `DGS10`, `SP500`, `MORTGAGE30US`.

Ask: "Show me the unemployment rate history" or "What's current inflation?"

### OpenWeatherMap 🌦️
Detailed weather with hourly forecasts and air quality. Requires a free API key from [openweathermap.org/api](https://openweathermap.org/api) — free tier allows 1,000 calls/day.

Works alongside Open-Meteo. When a key is saved and the connector is enabled, the AI can use it for richer weather data.

### Unsplash 📷
Search millions of high-quality photos. Requires a free Access Key from [unsplash.com/developers](https://unsplash.com/developers) — free tier allows 50 requests/hour.

`search_photos` tool. Returns photo URLs, descriptions, and photographer credits.  
Ask: "Find me photos of a minimalist desk setup"

---

## Connector State

Connector data lives in `Data/Connectors.json`. The `ConnectorEngine` manages this file.

**Service connectors** store: `enabled`, `credentials` (tokens, keys), `connectedAt`.  
**Free connectors** store: `enabled`, optional `credentials.apiKey`.

`ConnectorEngine.getAll()` returns status info for all connectors **without exposing credentials** — this is what the UI sees. The full credentials object is only returned to IPC handlers that need it (GmailIPC, GithubIPC, AutomationEngine).

### Token Security
Credentials are stored in plaintext in `Data/Connectors.json` on your local machine. The file is gitignored by default. Do not commit `Data/` to a public repository.
