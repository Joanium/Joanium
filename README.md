# Joanium

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/d238934d-b5cc-4a81-b081-eca743ef30ff">
        <img src="https://github.com/user-attachments/assets/d238934d-b5cc-4a81-b081-eca743ef30ff" alt="Joanium" width="200">
    </picture>
</p>

<p align="center">
  <strong>Think once, Ship more</strong>
</p>

<p align="center">
  <a href="https://github.com/joanium/joanium/releases"><img src="https://img.shields.io/github/v/release/joanium/joanium?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://github.com/joanium/joanium/stargazers"><img src="https://img.shields.io/github/stars/joanium/joanium?style=for-the-badge&color=yellow" alt="GitHub Stars"></a>
  <a href="https://github.com/joanium/joanium/issues"><img src="https://img.shields.io/github/issues/joanium/joanium?style=for-the-badge&color=red" alt="Open Issues"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://joeljolly.vercel.app/"><img src="https://img.shields.io/badge/Built%20by-Joel%20Jolly-blueviolet?style=for-the-badge" alt="Built by Joel Jolly"></a>
</p>

<p align="center">
  <a href="https://joanium.com">🌐 Website</a> ·
  <a href="https://joanium.com/docs">📖 Docs</a> ·
  <a href="https://joanium.com/marketplace">🛍️ Marketplace</a> ·
  <a href="https://www.joanium.com/download">⬇️ Download</a>
</p>

---

Joanium is a local-first desktop app for people who want an AI assistant that can actually work with projects, files, tools, schedules, personal context, and real integrations instead of acting like a thin chat wrapper.

It combines multi-provider chat, workspace-aware assistance, scheduled automations, autonomous agents, MCP, browser tooling, markdown-based skills and personas, and a discovery-driven extension system in one desktop product.

## 🤔 Why not just use ChatGPT or Claude.ai?

Those are great chat apps. Joanium is a different thing entirely — it lives on your machine, knows your files, runs jobs while you sleep, and connects to the tools you actually use.

| | ChatGPT / Claude.ai | Joanium |
|---|---|---|
| Your files & projects | ❌ Upload every time | ✅ Always in context |
| Runs tasks on a schedule | ❌ | ✅ Automations + Agents |
| GitHub, Gmail, Drive integrations | ❌ Limited | ✅ Native |
| Your data stays on your machine | ❌ Cloud only | ✅ 100% local-first |
| Use any AI model | ❌ Locked in | ✅ 10+ providers |
| Extensible with custom tools | ❌ | ✅ Full extension system |

## ✨ What you actually get

### 💬 A chat that knows your work
Not just a blank box. Joanium loads your active project, reads your files, runs terminal commands, handles attachments, and keeps separate chat history per project. It's the difference between an assistant and a *coworker*.

### ⏰ Automations that run themselves
Set up a job once — *"every morning, pull the latest GitHub issues, summarise them, and ping me on Slack"* — and it just runs. No babysitting. Built-in data sources include RSS, Reddit, weather, crypto prices, file reads, URL fetches, and more. Built-in outputs include notifications, file creation, webhooks, terminal commands, and integration-specific actions.

### 🕵️ Agents that work in the background
Reusable scheduled prompts that run against any model and any project. Great for daily code reviews, monitoring changelogs, or anything you'd otherwise have to remember to ask manually.

### 🎭 Personas & 🧠 Skills
**Personas** change *how* the assistant talks and thinks — drop in a "senior code reviewer" or a "startup copywriter" and the whole vibe shifts instantly. **Skills** are markdown docs that teach the assistant *what* to do — enable the ones you need, disable the rest. Both are just files you can edit or share.

### 🔌 Real integrations, not wrappers
GitHub, GitLab, Gmail, Google Drive, Calendar, Sheets, Docs, Contacts, YouTube, Tasks — all connected as first-class tools the assistant can actually use mid-conversation, not just talk about.

### 🛍️ Marketplace
Browse and install community-built skills and personas from the Joanium marketplace with one click. Ship your own too.

## ⬇️ Get started in 60 seconds

```
1. Go to https://joanium.com
2. Hit Download
3. Install it  (Windows · macOS · Linux — all supported)
4. Finish onboarding — add your API key and you're live
```

> 💡 **No API key?** Use **Ollama** for free local models — Joanium supports it out of the box with zero extra config.

## 🔀 Works with your favourite AI

Switch models anytime, even mid-conversation. No lock-in, ever.

`Anthropic` · `OpenAI` · `Google Gemini` · `OpenRouter` · `Mistral` · `NVIDIA NIM` · `DeepSeek` · `MiniMax` · `Ollama` · `LM Studio`

Full walkthrough → [Docs/Extension-Guide.md](Docs/Extension-Guide.md)

## 📖 Documentation

| | |
|---|---|
| 🗺️ [Architecture](Docs/Architecture.md) | How the app boots, runtime layers, and request flow |
| 🧩 [Features](Docs/Features.md) | Full product surface and capability map |
| 💾 [Data & Persistence](Docs/Data-And-Persistence.md) | Where state lives and how to back it up |
| 🔧 [Extension Guide](Docs/Extension-Guide.md) | Adding features, engines, pages, IPC, and services |
| 📍 [Where To Change What](Docs/Where-To-Change-What.md) | Targeted maintenance map — find the right file fast |
| 🛠️ [Development Workflow](Docs/Development-Workflow.md) | Scripts, packaging, and contributor workflow |

## 🤝 Contributing

Contributions are welcome — big or small.

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to get started
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — be cool
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities

## 📄 License

MIT. See [LICENSE](LICENSE).

---

<p align="center">Made with ❤️ by <a href="https://joeljolly.vercel.app">Joel Jolly</a></p>
