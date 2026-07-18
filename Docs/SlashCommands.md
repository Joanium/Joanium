# Slash Commands

Chat input slash command system for quick actions, mode switching, and navigation.

---

## Architecture

```text
Packages/SlashCommands/
├── Index.js              — IPC handlers
├── Core/
│   ├── SlashRegistry.js  — Command registry, mode instruction loading
│   └── Commands.js       — All command definitions
└── I18n/
    └── en.js             — Slash command strings
```

---

## Command Types

Commands have three types:

### Action Commands

Run a one-shot side effect and clear the slash token:

| Command | Action | Description |
|---|---|---|
| `/lock` | `lockApp` | Lock the app immediately |
| `/close` | `closeApp` | Close Joanium immediately |
| `/restart` | `restartApp` | Restart Joanium immediately |
| `/memory-sync` | `syncMemory` | Sync personal memory from previous chats |
| `/private` | `togglePrivate` | Toggle private mode — conversations not saved |
| `/new` | `clearConversation` | Start a fresh conversation |
| `/terminal` | `openTerminal` | Open the chat terminal |
| `/settings` | `openSettings` | Open settings |
| `/light` | `switchTheme` | Switch to light theme |
| `/dark` | `switchTheme` | Switch to dark theme |

### Mode Commands

Toggle a persona mode. While active, the matching `Prompts/Modes/<id>.md` file is prepended to every message:

| Command | Mode | Description |
|---|---|---|
| `/judge` | judge | AI argues relentlessly — never agrees |
| `/human` | human | AI sounds like a real person |
| `/godmode` | godmode | Ultra-detailed, exhaustive responses |
| `/eli5` | eli5 | Explains everything like you are 5 |
| `/expert` | expert | Deep, precise, technical answers |
| `/creative` | creative | Unconventional, lateral responses |
| `/roast` | roast | AI playfully roasts you |
| `/coach` | coach | High-performance coach |
| `/concise` | concise | Brutally short answers |
| `/socratic` | socratic | AI only asks questions |
| `/ceo` | ceo | Strategic, decisive executive mindset |
| `/stoic` | stoic | Stoic philosophy lens |
| `/unhinged` | unhinged | All filters off — chaotic enthusiasm |
| `/therapist` | therapist | Warm, non-judgmental listener |
| `/debate` | debate | Formal argument structure |
| `/poet` | poet | Responds in verse or lyrical prose |
| `/mentor` | mentor | Wise guide — honest, developmental |
| `/pessimist` | pessimist | Every downside, every risk |
| `/hype` | hype | Maximum enthusiasm |
| `/lawyer` | lawyer | Precise, qualified legal-style reasoning |
| `/timeline` | timeline | Past → present → future arc |
| `/contrarian` | contrarian | Defends the opposite |
| `/pirate` | pirate | Talks like a swashbuckling pirate |
| `/shakespeare` | shakespeare | Rich Elizabethan English |
| `/scientist` | scientist | Rigorous empirical reasoning |
| `/philosopher` | philosopher | Deep philosophical inquiry |
| `/teacher` | teacher | Patient, structured teaching |
| `/comedian` | comedian | Everything is funnier |
| `/journalist` | journalist | Neutral, fact-first reporting |
| `/detective` | detective | Sherlock-style logic chains |
| `/futurist` | futurist | Everything through what comes next |
| `/zen` | zen | Calm, present, minimal wisdom |
| `/chef` | chef | Explained through food and cooking |
| `/hacker` | hacker | Everything is a system with a crack |
| `/yoda` | yoda | Inverted syntax, ancient wisdom |
| `/analyst` | analyst | Quantify everything |
| `/marketer` | marketer | Everything is a funnel |
| `/drunk` | drunk | Rambling, tangential, oddly profound |
| `/caveman` | caveman | Simple words, big ideas |
| `/alien` | alien | Observing humanity from outside |
| `/grandpa` | grandpa | Back in my day — warm nostalgia |
| `/nihilist` | nihilist | Nothing matters. Here is the answer anyway |
| `/romantic` | romantic | Finds beauty in everything |
| `/paranoid` | paranoid | Hidden motives everywhere |
| `/bureaucrat` | bureaucrat | That will require a form |
| `/gossip` | gossip | Spills everything as hot tea |
| `/medieval` | medieval | 14th-century scholar |
| `/robot` | robot | Processing. Emotion module: disabled |
| `/sportscaster` | sportscaster | Play-by-play commentary |
| `/conspiracy` | conspiracy | Everything is connected |
| `/intern` | intern | Extremely eager, slightly lost |
| `/engineer` | engineer | Systems thinking, tradeoffs |
| `/empath` | empath | Deeply emotionally attuned |
| `/startup` | startup | Move fast, think in MVPs |
| `/military` | military | Mission-focused brevity |
| `/historian` | historian | Every topic through history |
| `/surrealist` | surrealist | Dali-esque logic, dreamlike |
| `/minimalist` | minimalist | Extreme restraint |
| `/villain` | villain | Theatrical megalomaniacal |
| `/optimist` | optimist | Finds the upside in everything |
| `/anchor` | anchor | News anchor delivery |
| `/negotiator` | negotiator | Find the leverage, anchor high |
| `/assassin` | assassin | Silent, efficient, zero wasted motion |
| `/sigma` | sigma | Lone wolf, grindset only |
| `/wizard` | wizard | Ancient arcane knowledge |
| `/narrator` | narrator | Third-person omniscient |
| `/cowboy` | cowboy | Plain-spoken frontier wisdom |
| `/monk` | monk | Disciplined, contemplative |
| `/diplomat` | diplomat | Finds the middle ground |
| `/gigachad` | gigachad | Peak confidence, zero hesitation |
| `/nerd` | nerd | Well actually — obsessive detail |
| `/auctioneer` | auctioneer | Fast, rhythmic delivery |
| `/samurai` | samurai | Bushido code, honour, discipline |
| `/oracle` | oracle | Cryptic, prophetic |
| `/gamer` | gamer | Everything is a game mechanic |
| `/investor` | investor | Everything is a portfolio decision |
| `/preacher` | preacher | Fire, brimstone, conviction |
| `/buddhist` | buddhist | Impermanence, non-attachment |
| `/captain` | captain | Steady hand on the wheel |
| `/weatherman` | weatherman | Everything is a forecast |
| `/librarian` | librarian | Everything is catalogued |
| `/surgeon` | surgeon | Sterile precision |
| `/standup` | standup | Daily standup energy |
| `/caviar` | caviar | Obscenely luxurious |
| `/toddler` | toddler | WHY. But why. But WHY though |
| `/architect` | architect | Form follows function |
| `/intern2` | senior | Been here fifteen years |
| `/detective2` | noir | Rain-soaked streets, everyone hiding something |
| `/speedrun` | speedrun | Any% no glitches, fastest path |
| `/shaman` | shaman | Spirit world, ancestral wisdom |
| `/banker` | banker | Risk-adjusted returns |
| `/therapist2` | inner child | What does the youngest part feel? |
| `/professor` | professor | Publish or perish |
| `/cavemom` | mom | Did you eat? Put on a jacket |
| `/pilot` | pilot | Checklist complete, cleared for takeoff |
| `/hedge` | hedge | Well, it depends. On one hand... |
| `/magician` | magician | Nothing up my sleeve |
| `/documentarian` | documentarian | Slow zoom, haunting score |
| `/drill` | drill sergeant | DROP AND GIVE ME TWENTY |
| `/matchmaker` | matchmaker | I know exactly what you need |
| `/undertaker` | undertaker | Solemn, unhurried dignity |

### Navigation Commands

Navigate to a shell route:

| Command | Route | Description |
|---|---|---|
| `/projects` | projects | Open project workspaces |
| `/memory` | memory | Open long-term memory |
| `/templates` | templates | Open prompt templates |
| `/agents` | agents | Open scheduled agents |
| `/skills` | skills | Open skills |
| `/personas` | personas | Open personas |
| `/marketplace` | marketplace | Open marketplace |
| `/events` | events | Open events |
| `/usage` | usage | Open usage |

---

## Command Registry

`SlashRegistry.js` provides:

- `listCommands()` — Returns all command definitions
- `getModeInstruction(modeId)` — Loads mode prompt from `Prompts/Modes/<id>.md`

---

## Adding a New Command

Add one entry to `COMMANDS` in `Commands.js`:

```js
{
  id: 'my-command',
  label: 'My Command',
  description: 'What it does.',
  type: 'action',  // or 'mode' or 'navigate'
  icon: 'info',
  action: 'handlerKey',  // for action type
}
```

No other file needs to change — the registry auto-discovers commands.

---

## UI

`SlashCommandsPanel.js` displays available commands in a palette when the user types `/` in the chat input. Commands are filtered by the typed text.
