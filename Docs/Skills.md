# Skills

Skills are markdown files that give the AI domain-specific knowledge and frameworks. They live in the `Skills/` folder at the project root.

---

## How Skills Work

1. All `.md` files in `Skills/` (except `Debug.md`) are loaded at startup via `SkillsIPC.js`
2. When you send a message, `Agent.js → planRequest()` calls the AI with a catalogue of all skill names, triggers, and descriptions
3. The planner decides which skills (if any) are relevant to your request
4. Relevant skills are logged in the agent log bubble before the response (e.g. `[SKILL] Copywriting`)
5. The skill content is NOT injected into the system prompt on every message — only the metadata is. The AI uses its training knowledge guided by the skill's structure.

> **Note:** The skill selection is AI-driven. If you want to force a skill, just mention it explicitly: "Use the API Design skill to help me design this REST API."

---

## Skill File Format

```markdown
---
name: Copywriting
trigger: write copy, marketing text, landing page, ad, headline, tagline, email campaign, product description, sales page, CTA, brand voice
description: Write high-converting, distinctive, emotionally intelligent copy for any medium and audience. Use when producing any persuasive or marketing-oriented text.
---

The actual skill content goes here. This is what the AI reads
and applies when this skill is active...
```

### Frontmatter Fields

| Field | Required | Purpose |
|---|---|---|
| `name` | Yes | Unique identifier, shown in the Skills page and agent log |
| `trigger` | Recommended | Comma-separated keywords that signal when this skill applies |
| `description` | Recommended | One sentence explaining what the skill does and when to use it |

The **body** (everything after the closing `---`) is the skill content itself. It can use any markdown — headers, code blocks, bullet lists, tables.

### What Goes in the Body

Write the body as a structured reference the AI should follow. Think of it as a domain expert's playbook:

- **Frameworks and checklists** — step-by-step processes
- **Code patterns** — language-specific examples with comments
- **Decision tables** — when to use X vs Y
- **Common errors and fixes** — diagnostic patterns
- **Quality standards** — what "good" looks like

---

## Installed Skills

| Skill | When it applies |
|---|---|
| API Design | REST API design, endpoints, schemas, versioning, OpenAPI |
| CICD Pipeline | CI/CD, GitHub Actions, Docker builds, deployment, release |
| Code Review | Code review, PR review, feedback on code |
| Content Strategy | Content plan, editorial calendar, blog strategy, content pillars |
| Copywriting | Marketing text, landing page, ad copy, headlines, email campaigns |
| Data Analysis | Data analysis, statistics, SQL queries, visualization |
| Database Design | Schema design, data modeling, normalization, indexes |
| Debug — Docker/Kubernetes | Docker crashes, pod errors, K8s debugging |
| Debug — FastAPI/Django | FastAPI 422 errors, Django ORM, migrations, DRF |
| Debug — Go | Nil panics, goroutine leaks, race conditions, Go errors |
| Debug — JavaScript/TypeScript | JS/TS runtime errors, type errors, async bugs |
| Debug — Node.js/Express | Node crashes, Express middleware, event loop |
| Debug — PostgreSQL/SQL | Slow queries, EXPLAIN, locking, migration errors |
| Debug — Python | Python exceptions, import errors, memory, async |
| Debug — React/Next.js | React errors, hooks, SSR, hydration |
| Debug — React Native/Expo | Mobile build errors, native module issues |
| Debug — Redis/Queues | Redis connection, BullMQ, queue stalls |
| Debug — REST/GraphQL | HTTP errors, auth, CORS, GraphQL resolvers, N+1 |
| Debug — Rust/C++ | Borrow checker, lifetimes, segfaults, UB |
| Email Marketing | Email campaigns, subject lines, sequences |
| Frontend Design | UI/UX, web components, CSS, visual design |
| Hiring & Interviewing | Job descriptions, interview questions, candidate evaluation |
| Meeting Facilitation | Meeting design, agenda, facilitation techniques |
| Monitoring & Observability | Metrics, logging, alerting, tracing |
| OKR Goal Setting | Objectives, key results, goal frameworks |
| Performance Optimization | Code performance, profiling, caching |
| Personal Branding | Personal brand, LinkedIn, thought leadership |
| Pitch Deck | Investor pitch, presentation structure |
| Product Requirements | PRD, user stories, acceptance criteria, feature specs |
| Prompt Engineering | Writing better AI prompts, system prompts |
| Refactoring | Code restructuring, clean code, design patterns |
| Research & Summarize | Research synthesis, summarization |
| Sales Outreach | Cold email, sales sequences, prospecting |
| Scenario Planning | Strategic planning, future scenarios, risk analysis |
| Security Audit | OWASP, SQL injection, XSS, auth vulnerabilities |
| SEO Strategy | Keyword research, on-page SEO, link building |
| System Design | Distributed systems, architecture patterns |
| Technical Writing | Documentation, API docs, user guides |
| Testing Strategy | Unit tests, integration tests, E2E, TDD |
| UX Research | User interviews, usability testing, research synthesis |

---

## Writing a New Skill

1. Create a new `.md` file in `Skills/`
2. Add the YAML frontmatter (name, trigger, description)
3. Write the skill body — be specific and structured
4. Restart Romelson (skills are loaded at startup)
5. The new skill will appear in the Skills page and be available to the planner

### Tips for Good Skills

**Be specific in the trigger.** The planner matches skill triggers against the user's request. More specific triggers = more accurate selection. `"write copy, marketing text, landing page"` is better than `"writing"`.

**Structure the body hierarchically.** Use `##` headers to break the skill into phases or categories. The AI navigates the structure more effectively with clear sections.

**Include code examples** for technical skills. Concrete examples are more useful than abstract descriptions.

**Keep the body focused.** A skill covering one specific domain (e.g. "Debug — Redis") will be more reliable than one covering a broad area (e.g. "All debugging").

**Use checklists** for things where completeness matters:
```markdown
## Security Checklist
[ ] Authentication on all endpoints
[ ] Input validation before processing
[ ] No secrets in code
```

### Example: Minimal New Skill

```markdown
---
name: Email Etiquette
trigger: write an email, professional email, email tone, email format, how to phrase this email
description: Write clear, professional, appropriately-toned emails for any professional context.
---

## Core Rules
- Subject line: specific, scannable, < 60 characters
- Open with context, not pleasantries
- One email = one ask
- Action item: explicit and bolded if there's a next step

## Tone Guide
- To leadership: direct, no fluff, bottom line first
- To peers: collegial, collaborative framing
- To reports: clear expectations, specific next steps
- To clients: professional warmth, solution-focused

## Common Patterns

### The Request Email
"I need [X] by [date] because [reason]. Could you [specific action]? Let me know if you need anything from my end."

### The Update Email
"Update on [project]: [current status]. Next milestone: [date]. No blockers. / Current blocker: [X], working to resolve by [date]."

### The Decline Email
"Thanks for thinking of me. I can't take this on right now because [reason]. Consider [alternative] instead."
```

---

## The Skills Page

The Skills page (star icon in sidebar) shows all installed skills as browsable cards. Each card shows:
- Skill name and badge
- **When** trigger (what situations this applies to)
- Description
- **Read** button — opens the full skill content in a modal

Skills can be searched by name, trigger, description, or body content.
