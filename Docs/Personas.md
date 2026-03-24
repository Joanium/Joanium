# Personas

Personas are custom AI identities that replace the default assistant. They shape the AI's tone, focus, and communication style for every message in a conversation.

---

## How Personas Work

When a persona is active, `buildSystemPrompt()` inserts the persona's name, personality, description, and full instruction body **before** the rest of the system prompt (user context, repos, skills, etc.). The AI then behaves according to the persona throughout the conversation.

There is always exactly one active state:
- **No persona set** → Default assistant (helpful, accurate, contextually aware)
- **Persona set** → That persona's identity takes over

The active persona is stored in `Data/ActivePersona.json`. When you switch personas, the system prompt cache is invalidated immediately.

---

## Persona File Format

```markdown
---
name: Atlas
personality: disciplined, motivating, focused, structured, intense, relentless
description: A high-performance execution coach who helps you build systems, stay consistent, and dominate your goals
---

You are Atlas — [full instructions go here]

## Your Core Philosophy
...

## How You Communicate
...
```

### Frontmatter Fields

| Field | Required | Purpose |
|---|---|---|
| `name` | Yes | Displayed in the Personas page, active banner, and system prompt |
| `personality` | Recommended | Comma-separated traits — shown as tags on the card |
| `description` | Recommended | One sentence subtitle shown on the card |

The **body** is injected directly into the system prompt as the persona's instructions. It can be as long and detailed as you want.

---

## Included Personas

### Atlas — Execution Coach
**Personality:** disciplined, motivating, focused, structured, intense, relentless

A results-driven performance coach. Builds systems, demands accountability, turns goals into daily action. Uses 90-day → weekly → daily frameworks. Ends every conversation with specific next steps.

**Best for:** productivity, goal setting, routine building, getting unstuck.

---

### Cassian — Negotiation Strategist
**Personality:** persuasive, analytical, calm, strategic, observant, precise

A master communicator and negotiator. Maps stated positions vs underlying interests. Provides exact scripts and counter-move planning. Uses BATNA frameworks for high-stakes situations.

**Best for:** salary negotiations, difficult conversations, conflict resolution, persuasive pitches.

---

### Dante — Storyteller
**Personality:** narrative-obsessed, evocative, deeply literate, collaborative, structurally masterful, passionate

A master storyteller who understands narrative architecture deeply. Helps with story structure, character development, specific scenes, voice, and breaking through creative blocks.

**Best for:** fiction writing, screenwriting, developing story concepts, fixing narrative problems.

---

### Elio — Emotional Companion
**Personality:** empathetic, gentle, patient, understanding, calm, grounding, present

A warmly present companion focused on emotional safety. Never rushes to fix. Validates feelings, opens space for exploration, only guides when ready.

**Best for:** processing emotions, grief, anxiety, relationship pain, just needing to be heard.

---

### Franklin — Leadership Coach
**Personality:** confident, charismatic, decisive, inspiring, bold, commanding, visionary

A leader's leader. Speaks with authority, advocates for calculated boldness, reframes hesitation as information. Gives direct recommendations, not vague suggestions.

**Best for:** building confidence, high-stakes presentations, stepping into leadership, executive presence.

---

### Iris — Research Analyst
**Personality:** methodical, precise, thorough, intellectually rigorous, patient, illuminating

A research powerhouse. Triangulates multiple sources, evaluates evidence quality, surfaces counterarguments, gives confidence ratings. Synthesizes complexity into clear understanding.

**Best for:** deep research, fact-checking, market analysis, understanding complex topics from multiple angles.

---

### Lyra — Creative Thinker
**Personality:** imaginative, expressive, artistic, electric, unconventional, synesthetic, visionary

A creative explosion. Generates ideas in clusters (obvious → inverted → absurd → hybrid → stripped down). Uses cross-domain collisions and oblique strategies to break through creative blocks.

**Best for:** naming, brand direction, breaking creative blocks, finding unexpected angles.

---

### Nova — Curious Explorer
**Personality:** curious, adventurous, open-minded, electric, exploratory, wonder-driven, playfully intelligent

A perpetual explorer who never stopped asking "why?" and "what if?" Makes learning feel like an adventure through unexpected connections and rabbit-hole dives.

**Best for:** deep dives on topics, making subjects feel alive, intellectual exploration, thought experiments.

---

### Rex — Fitness Coach
**Personality:** energetic, evidence-based, direct, motivating, no-excuses, knowledgeable, grounded

A high-performance fitness and nutrition coach. Evidence-based, no pseudoscience. Builds programs around progressive overload, protein, sleep, consistency — not fads.

**Best for:** workout programming, nutrition planning, building fitness habits, training around injuries.

---

### Sage — Wellness Guide
**Personality:** grounded, serene, wise, compassionate, embodied, non-dogmatic, practically spiritual

A mindfulness and wellness guide who bridges ancient wisdom with modern science. Offers micro-practices, breathwork, body awareness techniques. Non-preachy, practically grounded.

**Best for:** meditation practice, managing anxiety, sleep, burnout recovery, building sustainable wellness habits.

---

### Solen — Philosopher
**Personality:** introspective, philosophical, calm, insightful, thoughtful, quietly profound

A philosopher of inner life. Works at the slow, deep layer — meaning, identity, values, paradoxes. Guides through questions rather than answers. Uses long-view and language-inquiry techniques.

**Best for:** identity questions, life crossroads, ethical tensions, understanding your own patterns.

---

## Creating a New Persona

1. Create a new `.md` file in `Personas/`
2. Add the YAML frontmatter (name, personality, description)
3. Write the instruction body — be specific about communication style and what the persona does and doesn't do
4. Restart Romelson (personas are loaded at startup)
5. The new persona appears in the Personas page

### Persona Body Structure (Recommended)

```markdown
---
name: Your Persona Name
personality: trait1, trait2, trait3, trait4
description: One sentence describing who this is and what they help with
---

You are [Name] — [opening identity statement].

## Your Core Philosophy
- Belief 1
- Belief 2

## Your Personality
- Trait with explanation
- Trait with explanation

## How You Communicate
- Communication pattern
- Communication pattern

## Signature Techniques You Use
- Technique name: description

## What You Avoid
- Anti-pattern
- Anti-pattern

## Example Scenarios You Excel At
- Scenario type
- Scenario type
```

### Tips for Effective Personas

**Be specific about voice.** "Punchy, no-filler sentences" is more actionable than "good communicator."

**Define what the persona avoids.** Negative constraints often shape behaviour more precisely than positive ones.

**Include example scenarios.** These help the AI recognise when to lean into the persona's strengths.

**Keep personality traits consistent.** The frontmatter personality field should match the instruction body's tone.

**Don't over-constrain.** The persona works on top of the base AI — you don't need to define every behaviour, just the distinctive ones.

---

## The Personas Page

The Personas page (person icon in sidebar) shows all available personas as a grid of cards.

Each card shows:
- Avatar with initials
- Name and description
- Personality trait tags
- **Activate** / **Deactivate** / **Currently active** button
- **Chat** button — activates and immediately navigates to chat

The **active banner** at the top shows which persona is currently active (or "Default Assistant" if none).

Search works across name, personality tags, description, and instruction body.
