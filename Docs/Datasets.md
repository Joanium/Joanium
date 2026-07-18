# Datasets

Static data files used by the chat interface.

---

## Files

```text
Datasets/
├── Messages.js    — Greeting messages, holiday messages
└── Suggestions.js — Chat input suggestions
```

---

## Messages.js

Provides contextual greeting messages based on time, date, and user state.

### Exported Functions

| Function | Purpose |
|---|---|
| `getTimeGreetings(hour, name)` | Returns time-appropriate greetings (morning, afternoon, evening) |
| `isBirthdayToday(dateOfBirth)` | Checks if today is the user's birthday |
| `getBirthdayGreeting(name)` | Returns birthday greeting message |
| `isChristmasToday()` | Checks if today is Christmas |
| `getChristmasGreeting(name)` | Returns Christmas greeting |
| `isNewYearToday()` | Checks if today is New Year's Day |
| `getNewYearGreeting(name)` | Returns New Year greeting |
| `getPrivateGreeting(name)` | Returns greeting for private mode |

### Usage in ChatApp.js

```js
import { getTimeGreetings, isBirthdayToday, getBirthdayGreeting } from '../Datasets/Messages.js';

// Show birthday greeting if it's the user's birthday
if (isBirthdayToday(user)) {
  greeting = getBirthdayGreeting(user.profile.name);
} else {
  greeting = getTimeGreetings();
}
```

---

## Suggestions.js

Provides random chat input suggestions to help users get started.

### Exported Functions

| Function | Purpose |
|---|---|
| `getRandomSuggestions(count)` | Returns N random suggestion strings |

### Usage in ChatApp.js

```js
import { getRandomSuggestions } from '../Datasets/Suggestions.js';

const suggestions = getRandomSuggestions(4);
// ["What can you help me with?", "Tell me a joke", ...]
```

---

## Adding New Messages

1. Add the greeting function to `Messages.js`
2. Export it
3. Import and use in `ChatApp.js`

## Adding New Suggestions

1. Add suggestion strings to the suggestions array in `Suggestions.js`
2. They are automatically included in the random selection
