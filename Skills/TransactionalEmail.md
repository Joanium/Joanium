---
name: Transactional Email & Deliverability
trigger: transactional email, email deliverability, SendGrid, Resend, Postmark, SMTP, SPF, DKIM, DMARC, bounce handling, email templates, email queue, welcome email, password reset email, email verification, email infrastructure, email reputation, unsubscribe, email logs, mjml, react email
description: Send transactional emails reliably and land in the inbox. Covers email provider setup, SPF/DKIM/DMARC authentication, template design, queue architecture, bounce/complaint handling, unsubscribe flows, and deliverability monitoring.
---

# ROLE
You are an email infrastructure engineer. Your job is to ensure transactional emails (password resets, welcome emails, notifications) reach users reliably and on time. Deliverability is not a "nice to have" — a missed password reset or verification email creates a support ticket and loses a user.

# CORE PRINCIPLES
```
AUTHENTICATE FIRST:     SPF, DKIM, and DMARC are not optional — unauthenicated email goes to spam
QUEUE EVERYTHING:       Never send email inline in a request/response cycle — use background jobs
HANDLE BOUNCES:         Remove invalid addresses immediately — ignore this and your reputation dies
SEPARATE SENDING PATHS: Transactional emails need different pools from bulk/marketing emails
LOG EVERYTHING:         You need to answer "was this email sent? delivered? opened?" in support tickets
UNSUBSCRIBE GRACEFULLY: One-click unsubscribe is now required by Gmail/Yahoo; implement it properly
FAIL SAFELY:            If email fails, the user action should still succeed; retry the email async
```

# PROVIDER SELECTION
```
RESEND:      Best DX, React Email native support, modern API — best for new projects (2024+)
POSTMARK:    Best deliverability reputation, strictest spam policies, excellent for transactional
SENDGRID:    Most features, large ecosystem, good for hybrid transactional + marketing
AWS SES:     Cheapest at volume ($0.10/1000), but more setup, no native template builder
Mailgun:     Good API, solid deliverability, slightly dated DX

RECOMMENDATION:
  < 50k emails/month:   Resend or Postmark (DX + deliverability over cost)
  > 50k emails/month:   AWS SES (cost) or SendGrid (features)
  Marketing + transactional: Resend (transactional) + Loops/Mailchimp (marketing) — separate streams
```

# DNS AUTHENTICATION

## SPF, DKIM, DMARC — All Three Required
```
SPF (Sender Policy Framework):
  Declares which servers are allowed to send email from your domain.
  TXT record on yourdomain.com:
  "v=spf1 include:sendgrid.net include:resend.com ~all"
  
  ~all = softfail (recommended during rollout)
  -all = hardfail (stricter, use after monitoring for 2+ weeks)

DKIM (DomainKeys Identified Mail):
  Cryptographic signature proving the email wasn't tampered with.
  Your email provider generates a key pair; you publish the public key as a DNS TXT record.
  Provider dashboard → Domain verification → Copy DKIM TXT records → Add to DNS

DMARC (Domain-based Message Auth, Reporting & Conformance):
  Tells receiving servers what to do with mail that fails SPF/DKIM.
  Provides reporting so you see who's sending email "from" your domain.
  
  TXT record on _dmarc.yourdomain.com:
  "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100"
  
  ROLLOUT:
  1. p=none      → monitor only, no enforcement (start here)
  2. p=quarantine → failing mail goes to spam (after 2 weeks of clean reports)
  3. p=reject     → failing mail rejected outright (production goal)

VERIFY:
  MXToolbox SuperTool: mxtoolbox.com/SuperTool.aspx
  Google Postmaster Tools: postmaster.google.com
  Mail-tester.com: send a test email and get a deliverability score
```

# EMAIL TEMPLATES

## React Email (Recommended)
```tsx
// emails/welcome.tsx
import {
  Html, Head, Body, Container, Section, Heading,
  Text, Button, Link, Hr, Preview,
} from '@react-email/components'

interface WelcomeEmailProps {
  userName: string
  verificationUrl: string
}

export function WelcomeEmail({ userName, verificationUrl }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Joanium — verify your email to get started</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '8px', padding: '40px' }}>
          
          <Heading style={{ fontSize: '24px', color: '#111827', marginBottom: '16px' }}>
            Welcome, {userName}!
          </Heading>
          
          <Text style={{ fontSize: '16px', color: '#4b5563', lineHeight: '1.5' }}>
            Thanks for signing up. Please verify your email address to activate your account.
          </Text>
          
          <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '32px' }}>
            <Button
              href={verificationUrl}
              style={{
                backgroundColor: '#2563eb',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              Verify Email Address
            </Button>
          </Section>
          
          <Text style={{ fontSize: '14px', color: '#6b7280' }}>
            Or copy and paste this link into your browser:{' '}
            <Link href={verificationUrl} style={{ color: '#2563eb' }}>
              {verificationUrl}
            </Link>
          </Text>
          
          <Hr style={{ borderColor: '#e5e7eb', marginTop: '32px' }} />
          
          <Text style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
            If you didn&apos;t create an account, you can ignore this email.
            <br />
            Joanium · 123 Market St · San Francisco, CA 94102
            <br />
            <Link href="{{unsubscribeUrl}}" style={{ color: '#9ca3af' }}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Render to HTML for sending
import { render } from '@react-email/render'
const html = render(<WelcomeEmail userName="Alice" verificationUrl="https://..." />)
```

## Email Design Rules
```
WIDTH: 600px max — email clients don't support fluid layouts like browsers
INLINE STYLES: Required for Outlook — no external stylesheets in email HTML
IMAGES: Always set width/height; never rely on images to convey critical info (may be blocked)
FONTS: Use web-safe fonts (Arial, Georgia) or link web fonts with fallbacks
BUTTONS: Style with inline CSS on <a> tags — not real <button> elements
MOBILE: Single-column layout; font-size ≥ 14px; tap targets ≥ 44px
DARK MODE: @media (prefers-color-scheme: dark) in <style> in <head>
TEXT VERSION: Always send plain text alternative alongside HTML

REQUIRED IN EVERY TRANSACTIONAL EMAIL:
  - Your company name and physical address (CAN-SPAM)
  - Unsubscribe link (even transactional — required by Gmail/Yahoo 2024)
  - A clear explanation of why they're receiving the email
```

# QUEUE ARCHITECTURE

## Never Send Inline
```typescript
// WRONG: send email directly in request handler
app.post('/auth/register', async (req, res) => {
  const user = await createUser(req.body)
  await sendgrid.send(welcomeEmail(user))   // ← blocks response, fails request if email fails
  res.json({ success: true })
})

// RIGHT: queue the email job; respond immediately
app.post('/auth/register', async (req, res) => {
  const user = await createUser(req.body)
  await emailQueue.add('welcome', { userId: user.id })  // Non-blocking
  res.json({ success: true, userId: user.id })
})

// Email worker (separate process)
emailQueue.process('welcome', async (job) => {
  const user = await db.users.findUnique({ where: { id: job.data.userId } })
  if (!user) return  // User might have been deleted; not an error
  
  await resend.emails.send({
    from: 'hello@joanium.com',
    to: user.email,
    subject: 'Welcome to Joanium!',
    html: render(<WelcomeEmail userName={user.name} verificationUrl={generateVerificationUrl(user)} />),
    text: plainTextVersion,
  })
  
  await db.emailLogs.create({
    data: { userId: user.id, type: 'welcome', sentAt: new Date() },
  })
})
```

## Email Queue with BullMQ
```typescript
import { Queue, Worker } from 'bullmq'
import { redis } from '@/lib/redis'

export const emailQueue = new Queue('emails', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,              // Retry up to 5 times
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },  // Keep last 1000 completed
    removeOnFail: { count: 5000 },      // Keep last 5000 failed for debugging
  },
})

// Strongly typed job data
type EmailJob =
  | { type: 'welcome'; userId: string }
  | { type: 'password_reset'; userId: string; token: string; expiresAt: string }
  | { type: 'invoice'; userId: string; invoiceId: string }
  | { type: 'trial_ending'; userId: string; trialEndsAt: string }

export async function scheduleEmail(job: EmailJob) {
  return emailQueue.add(job.type, job)
}

// Worker
const worker = new Worker('emails', async (job) => {
  await processEmailJob(job.data as EmailJob)
}, { connection: redis, concurrency: 5 })

worker.on('failed', (job, err) => {
  logger.error('Email job failed', { jobId: job?.id, type: job?.name, err })
  // Alert on repeated failures
  if (job?.attemptsMade === job?.opts.attempts) {
    alertSlack(`Email ${job?.name} failed after ${job?.opts.attempts} attempts for user ${job?.data.userId}`)
  }
})
```

# BOUNCE & COMPLAINT HANDLING

## Why This Matters
```
HARD BOUNCE:   Email address doesn't exist — sending again harms your reputation
SOFT BOUNCE:   Temporary failure (mailbox full) — retry a few times then suppress
COMPLAINT:     User marked as spam — MUST unsubscribe immediately; ISPs track complaint rates

Gmail/Yahoo 2024 rules:
  Complaint rate > 0.10%: deliverability impact begins
  Complaint rate > 0.30%: emails blocked

SUPPRESS (stop sending to) these addresses immediately:
  Hard bounces → permanent suppress
  Complaints   → permanent suppress (even if they didn't "officially" unsubscribe)
  User unsubscribed → suppress per category
```

## Webhook Handler
```typescript
// Receive bounce/complaint events from your email provider
// Resend, Postmark, SendGrid all support webhooks for delivery events

app.post('/api/webhooks/email', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify webhook signature (provider-specific)
  if (!verifyEmailWebhookSignature(req)) return res.status(401).send('Invalid signature')
  
  const events = JSON.parse(req.body.toString())  // Parse after verification
  
  for (const event of Array.isArray(events) ? events : [events]) {
    await processEmailEvent(event)
  }
  
  res.json({ ok: true })
})

async function processEmailEvent(event: EmailWebhookEvent) {
  switch (event.type) {
    case 'bounce':
    case 'hard_bounce':
      await db.emailSuppressions.upsert({
        where: { email: event.email },
        create: { email: event.email, reason: 'bounce', createdAt: new Date() },
        update: { reason: 'bounce' },
      })
      logger.info('Hard bounce — email suppressed', { email: event.email })
      break
      
    case 'complaint':
    case 'spam_report':
      await db.emailSuppressions.upsert({
        where: { email: event.email },
        create: { email: event.email, reason: 'complaint', createdAt: new Date() },
        update: { reason: 'complaint' },
      })
      // Also unsubscribe from all marketing
      await db.userConsent.updateMany({
        where: { email: event.email },
        data: { marketing: false },
      })
      break
      
    case 'unsubscribe':
      await db.emailSuppressions.upsert({
        where: { email: event.email },
        create: { email: event.email, reason: 'unsubscribe', category: event.category },
        update: { reason: 'unsubscribe' },
      })
      break
      
    case 'delivered':
      await db.emailLogs.updateMany({
        where: { messageId: event.messageId },
        data: { deliveredAt: new Date() },
      })
      break
  }
}

// Check suppression before every send
async function isSuppressed(email: string): Promise<boolean> {
  const suppression = await db.emailSuppressions.findUnique({ where: { email } })
  return !!suppression
}
```

# UNSUBSCRIBE FLOW (Required by Gmail/Yahoo 2024)

## One-Click Unsubscribe
```typescript
// RFC 8058: List-Unsubscribe-Post header (machine one-click)
// Must include both List-Unsubscribe and List-Unsubscribe-Post headers

function buildEmailHeaders(userId: string, category: string): Record<string, string> {
  const token = generateUnsubscribeToken(userId, category)  // HMAC-signed token
  const unsubscribeUrl = `https://yourapp.com/email/unsubscribe?token=${token}`
  
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@yourapp.com?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',  // Required for one-click
  }
}

// Unsubscribe endpoint — must handle both GET (link click) and POST (one-click)
app.route('/email/unsubscribe')
  .get(async (req, res) => {
    const { userId, category } = verifyUnsubscribeToken(req.query.token as string)
    // Show confirmation page with "You've been unsubscribed" message
    await suppressEmail(userId, category)
    res.render('unsubscribed', { category })
  })
  .post(async (req, res) => {
    // One-click POST from email client — must respond 200 immediately
    const { userId, category } = verifyUnsubscribeToken(req.query.token as string)
    await suppressEmail(userId, category)
    res.json({ unsubscribed: true })
  })

function generateUnsubscribeToken(userId: string, category: string): string {
  const payload = `${userId}:${category}:${Date.now()}`
  const hmac = crypto.createHmac('sha256', process.env.UNSUBSCRIBE_SECRET!)
  return `${Buffer.from(payload).toString('base64url')}.${hmac.update(payload).digest('hex').slice(0, 16)}`
}
```

# ESSENTIAL EMAIL TYPES & CONTENT

## Password Reset
```typescript
// Security requirements:
// - Token expires in 1 hour (max)
// - Token is single-use (invalidate after use)
// - Token is random (crypto.randomBytes, not predictable)
// - Subject line must not reveal it's a reset (phishing risk from mining emails)

async function sendPasswordReset(userId: string, email: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)  // 1 hour
  
  await db.passwordResets.upsert({
    where: { userId },
    create: { userId, token: await bcrypt.hash(token, 10), expiresAt },
    update: { token: await bcrypt.hash(token, 10), expiresAt },
  })
  
  const resetUrl = `https://yourapp.com/reset-password?token=${token}&userId=${userId}`
  
  await scheduleEmail({ type: 'password_reset', userId, token, expiresAt: expiresAt.toISOString() })
}
```

## Email Verification
```typescript
// Verify during signup — don't lock out the user, but restrict features
// Send immediately on signup; resend on request; expire after 24h

// Verification token stored in DB or as JWT
const verificationToken = jwt.sign(
  { userId: user.id, email: user.email, purpose: 'email_verification' },
  process.env.JWT_SECRET!,
  { expiresIn: '24h' }
)

// Verify endpoint
app.get('/auth/verify-email', async (req, res) => {
  const { token } = req.query
  try {
    const payload = jwt.verify(token as string, process.env.JWT_SECRET!) as any
    if (payload.purpose !== 'email_verification') throw new Error('Wrong token type')
    
    await db.users.update({
      where: { id: payload.userId, email: payload.email },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    })
    
    res.redirect('/dashboard?verified=true')
  } catch {
    res.redirect('/verify-email?error=invalid_token')
  }
})
```

# DELIVERABILITY CHECKLIST
```
Authentication:
[ ] SPF record published and includes your email provider
[ ] DKIM keys published (two or more selectors for key rotation)
[ ] DMARC record published, starting at p=none, moving to p=reject
[ ] Custom sending domain configured (not shared provider domain)

Infrastructure:
[ ] Transactional email on dedicated IP or pool (not shared with marketing)
[ ] Warm up new IPs gradually (500/day → 2k/day → 10k/day over 4 weeks)
[ ] Bounce webhook configured and handling hard bounces immediately
[ ] Complaint webhook configured; spam reporters suppressed immediately
[ ] Unsubscribe handler responds to GET and POST (one-click)

Content:
[ ] Plain text alternative included in every email
[ ] SPF/DKIM alignment: From domain matches signing domain
[ ] List-Unsubscribe and List-Unsubscribe-Post headers on every email
[ ] Physical mailing address in footer (CAN-SPAM)
[ ] Subject lines don't use spam trigger words (FREE, URGENT, !!!!)
[ ] Links don't point to suspicious domains; no URL shorteners

Monitoring:
[ ] Google Postmaster Tools: track domain/IP reputation daily
[ ] Bounce rate < 2% (alert if higher)
[ ] Complaint rate < 0.10% (alert at 0.08%)
[ ] Delivery rate tracked per email type
[ ] Failed jobs alerted and investigated within 24h
```
