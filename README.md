# Joanium

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/d238934d-b5cc-4a81-b081-eca743ef30ff">
        <img src="https://github.com/user-attachments/assets/d238934d-b5cc-4a81-b081-eca743ef30ff" alt="Joanium" width="200">
    </picture>
</p>

<p align="center">
  <strong>The AI desktop assistant that actually lives on your machine.</strong><br>
  <sub>Multi-model chat · Scheduled automations · Background agents · MCP · Real integrations</sub>
</p>

<p align="center">
  <a href="https://github.com/joanium/joanium/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/joanium/joanium/ci.yml?style=for-the-badge&label=CI&logo=github&logoColor=white" alt="CI"></a>
  <a href="https://github.com/joanium/joanium/releases"><img src="https://img.shields.io/github/v/release/joanium/joanium?include_prereleases&style=for-the-badge&label=release" alt="GitHub release"></a>
  <a href="https://github.com/joanium/joanium/stargazers"><img src="https://img.shields.io/github/stars/joanium/joanium?style=for-the-badge&color=yellow" alt="GitHub Stars"></a>
  <a href="https://github.com/joanium/joanium/issues"><img src="https://img.shields.io/github/issues/joanium/joanium?style=for-the-badge&color=red" alt="Open Issues"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0%20%2B%20Commons%20Clause-blue?style=for-the-badge" alt="Apache 2.0 + Commons Clause License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-555555?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/node-%3E%3D24-43853d?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/built%20with-Electron-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron">
</p>

<p align="center">
  <a href="https://joanium.com">🌐 Website</a> ·
  <a href="https://joanium.com/docs">📖 Docs</a> ·
  <a href="https://joanium.com/marketplace">🛍️ Marketplace</a> ·
  <a href="https://www.joanium.com/download">⬇️ Download</a> ·
  <a href="https://github.com/joanium/joanium/discussions">💬 Discussions</a>
</p>

---

> **Joanium** is a local-first AI desktop app that goes far beyond a chat window. It knows your projects and files, runs automations on a schedule, operates background agents, connects to GitHub / Gmail / Drive, and supports every major AI provider — all without sending your data to the cloud.

---

## 🎬 Demo

<img width="1919" height="1016" alt="3" src="https://github.com/user-attachments/assets/7e930197-4750-4385-9532-c21170b64cbc" />

---

## 🤔 Why Joanium instead of ChatGPT or Claude.ai?

Those are great chat apps. Joanium is a different product entirely — it lives on your machine, understands your workspace, runs jobs while you sleep, and plugs into the tools you actually use.

| Capability                        | ChatGPT / Claude.ai       | **Joanium**                 |
| --------------------------------- | ------------------------- | --------------------------- |
| Reads your project files          | ❌ Upload every time      | ✅ Always in context        |
| Runs tasks on a schedule          | ❌                        | ✅ Automations + Agents     |
| GitHub, Gmail, Drive integrations | ⚠️ Limited / plugin-based | ✅ Native first-class tools |
| Your data stays on your machine   | ❌ Cloud only             | ✅ 100% local-first         |
| Use any AI model                  | ❌ Locked in              | ✅ 10+ providers            |
| Works fully offline               | ❌                        | ✅ With Ollama / LM Studio  |
| Extensible with custom tools      | ❌                        | ✅ Skills, Personas, MCP    |
| Background autonomous agents      | ❌                        | ✅ Built-in                 |

---

## ✨ Features

### 💬 A chat that knows your work

Joanium loads your active project, reads your files, runs terminal commands, handles attachments, and maintains separate chat history per project. Not a blank box — a genuine coworker.

### ⏰ Automations that run themselves

Set up a job once — _"every morning, pull the latest GitHub issues, summarise them, and ping me on Slack"_ — and it just runs. No babysitting required.

Built-in **data sources**: RSS feeds, Reddit, weather, crypto prices, file reads, URL fetches, GitHub events, and more.
Built-in **outputs**: notifications, file writes, webhooks, terminal commands, Slack messages, email, and integration-specific actions.

### 🕵️ Background agents

Reusable scheduled prompts that run against any model, any project. Perfect for daily code reviews, changelog monitoring, PR summaries, or anything you'd otherwise have to remember to ask manually.

### 🎭 Personas & 🧠 Skills

- **Personas** change _how_ the assistant thinks — drop in a "senior code reviewer" or a "startup copywriter" and the whole interaction shifts instantly.
- **Skills** are markdown docs that teach the assistant _what_ to do — enable the ones you need, disable the rest. Both are just plain files you can edit, version-control, and share.

### 🔌 Real integrations, not wrappers

GitHub · GitLab · Gmail · Google Drive · Google Calendar · Google Sheets · Google Docs · Google Contacts · YouTube · Google Tasks

All connected as first-class tools the assistant can actually invoke mid-conversation.

### 🧩 MCP (Model Context Protocol) support

Connect any MCP-compatible server and expose its tools directly to the assistant. The ecosystem is growing fast — Joanium keeps up.

### 🛍️ Marketplace

Browse and install community-built Skills and Personas with one click. Publish your own.

---

## ⬇️ Install in 60 seconds

```
1. Go to https://joanium.com
2. Click Download  (Windows · macOS · Linux — all supported)
3. Install and run the onboarding wizard
4. Add an API key for your preferred AI provider
```

> 💡 **No paid API key?** Joanium supports **[Ollama](https://ollama.com)** and **LM Studio** for free fully-local models with zero extra configuration.

---

## 🔀 Works with every major AI provider

Switch models anytime, even mid-conversation. No lock-in, ever.

| Provider       | Models                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| **Anthropic**  | Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5, and more             |
| **OpenAI**     | GPT-5.4, GPT-5.3, GPT-5.2, GPT-5.1, GPT-4.1, o3, o4-mini, GPT-4o, and more |
| **Google**     | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite                    |
| **OpenRouter** | 200+ models via one key                                                    |
| **Mistral**    | Mistral Large 3, Mistral Medium 3.1, Codestral, Devstral 2                 |
| **NVIDIA NIM** | Kimi K2, MiniMax M2.7, Qwen 3.5, DeepSeek V3.2, Gemma 4, and more          |
| **DeepSeek**   | DeepSeek-V3.2 (Chat), DeepSeek-V3.2 (Reasoner)                             |
| **MiniMax**    | MiniMax M2.7, MiniMax M2.5                                                 |
| **Ollama**     | Any local model — Llama, Phi, Gemma, Qwen…                                 |
| **LM Studio**  | Any GGUF model locally                                                     |

---

## 📖 Documentation

| Doc                                                     | What it covers                                      |
| ------------------------------------------------------- | --------------------------------------------------- |
| 🗺️ [Architecture](Docs/Architecture.md)                 | How the app boots, runtime layers, request flow     |
| 🧩 [Features](Docs/Features.md)                         | Full product surface and capability map             |
| 💾 [Data & Persistence](Docs/Data-And-Persistence.md)   | Where state lives and how to back it up             |
| 🔧 [Extension Guide](Docs/Extension-Guide.md)           | Adding features, engines, pages, IPC, and services  |
| 📍 [Where To Change What](Docs/Where-To-Change-What.md) | Targeted maintenance map — find the right file fast |
| 🛠️ [Development Workflow](Docs/Development-Workflow.md) | Scripts, packaging, and contributor workflow        |

---

## 🤝 Contributing

Contributions are very welcome — big or small. Here's how to get started:

```bash
git clone https://github.com/joanium/joanium.git
cd joanium
npm install
npm run dev          # start in dev mode
npm run lint         # check code style
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community norms, and [SECURITY.md](SECURITY.md) for responsible disclosure.

---

## 🌍 Community

- [GitHub Discussions](https://github.com/joanium/joanium/discussions) — questions, ideas, show-and-tell
- [Issues](https://github.com/joanium/joanium/issues) — bug reports and feature requests
- [CHANGELOG](CHANGELOG.md) — full release history

---

## ⭐ Star History

<a href="https://star-history.com/#joanium/joanium&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=joanium/joanium&type=Date&theme=dark">
    <img src="https://api.star-history.com/svg?repos=joanium/joanium&type=Date" alt="Star History Chart">
  </picture>
</a>

---

## 📄 License

This project is licensed under the **Apache License 2.0 with Commons Clause**.

- ✅ Free for personal use, education, and non-commercial open source projects
- 🚫 Commercial use (selling, hosting as a service, bundling into paid products) requires a separate commercial license from the author

See [LICENSE](LICENSE) for the full terms. For commercial licensing inquiries, contact [Joel Jolly](https://joeljolly.vercel.app).

---

<p align="center">
  If Joanium is useful to you, a ⭐ on GitHub goes a long way.<br>
  Made with ❤️ by <a href="https://joeljolly.vercel.app">Joel Jolly</a>
</p>
