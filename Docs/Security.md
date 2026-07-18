# Security

App lock, password protection, and tamper detection.

---

## Architecture

```text
Packages/Security/
├── Index.js              — IPC handlers
├── Core/
│   └── SecurityState.js  — Crypto, lockout, backup
└── I18n/
    └── en.js             — Security strings
```

---

## Password Hashing

Uses PBKDF2-SHA512 with OWASP 2024 recommendations:

- **Iterations**: 210,000
- **Hash length**: 64 bytes (128-char hex)
- **Digest**: SHA-512
- **Salt**: 256-bit random salt per credential

```js
function hashValue(value, salt) {
  return pbkdf2Sync(value, salt, HASH_ITERATIONS, HASH_LENGTH, HASH_DIGEST).toString('hex');
}
```

### Constant-Time Comparison

Prevents timing-based side-channel attacks:

```js
function secureCompare(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

---

## Rate Limiting

Progressive lockout after failed attempts:

| Failed Attempts | Lockout Duration |
|---|---|
| 3+ | 30 seconds |
| 5+ | 5 minutes |
| 7+ | 15 minutes |
| 10+ | 1 hour |

---

## Security State

Stored in `Data/Security.json`:

```json
{
  "enabled": false,
  "passwordHash": "...",
  "passwordSalt": "...",
  "secretQuestion": "What is your pet's name?",
  "secretAnswerHash": "...",
  "secretAnswerSalt": "...",
  "autoLockTimeout": "5min",
  "failedAttempts": 0,
  "lockoutUntil": null
}
```

---

## IPC Handlers (10 channels)

| Channel | Purpose |
|---|---|
| `security:get-status` | Get lock status |
| `security:enable` | Enable lock with password and recovery |
| `security:disable` | Disable lock (requires current password) |
| `security:verify-password` | Verify password |
| `security:verify-answer` | Verify recovery answer |
| `security:get-auto-lock-timeout` | Get auto-lock timeout |
| `security:set-auto-lock-timeout` | Set auto-lock timeout |
| `security:change-password` | Change password |
| `security:get-backup-state` | Get backup for tamper detection |
| `security:restore-from-backup` | Restore from backup |

---

## Auto-Lock Timeouts

Available timeout values:

| Value | Duration |
|---|---|
| `never` | Never auto-lock |
| `1min` | 1 minute |
| `5min` | 5 minutes |
| `10min` | 10 minutes |
| `15min` | 15 minutes |
| `30min` | 30 minutes |
| `1hr` | 1 hour |

---

## Tamper Detection

The renderer stores a copy of hashed credentials in sessionStorage and localStorage. This allows detection and repair if `Security.json` is cleared or modified externally.

### Backup Flow

1. Renderer stores backup on enable
2. On app start, renderer checks `security:get-backup-state`
3. If backup exists but Security.json is cleared, renderer calls `security:restore-from-backup`
4. Credentials are restored from the backup

---

## Recovery

If the user forgets their password:

1. Click "Forgot password" on lock screen
2. Answer the secret question
3. `security:verify-answer` validates the answer
4. If correct, user can set a new password

---

## Enabling Security

```js
await invokeIpc('security:enable', password, secretQuestion, secretAnswer);
```

This:

1. Hashes the password with a random salt
2. Hashes the recovery answer with a random salt
3. Saves to `Data/Security.json`
4. Renderer stores backup for tamper detection

---

## Lock Screen

When security is enabled, the app shows a lock screen on:

- App startup
- Auto-lock timeout
- Manual lock (`/lock` command)
