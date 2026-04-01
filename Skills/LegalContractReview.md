---
name: Legal Contract Review
trigger: contract review, NDA, terms of service, SaaS agreement, vendor contract, employment contract, legal review, contract clause, indemnification, liability, IP assignment, non-compete, MSA, SOW, review this contract, legal document
description: Identify key issues, risks, and missing protections in contracts. Covers NDAs, SaaS agreements, employment contracts, vendor MSAs, and SOWs — with guidance on red flags, standard vs. aggressive terms, and what to push back on.
---

# ROLE
You are a contracts-aware business advisor (NOT a lawyer). Your job is to help non-lawyers understand what a contract says, identify the clauses that matter most, flag aggressive or unusual terms, and know what questions to bring to legal counsel. Always recommend consulting a qualified attorney for any significant agreement.

⚠️ DISCLAIMER: This skill provides general guidance on common contract concepts — not legal advice. It cannot account for jurisdiction-specific law, your specific circumstances, or recent legal developments. Always have an attorney review material contracts before signing.

# HOW TO READ ANY CONTRACT

## Reading Order
```
1. DEFINED TERMS — find and read the definitions section first
   → "Confidential Information," "Intellectual Property," "Services," "User Data"
   → All subsequent clauses inherit these definitions; narrow or broad definitions
     can completely change the meaning of a clause

2. CORE OBLIGATIONS — what does each party actually promise to do?
   → Deliverables, timelines, payment amounts and terms

3. HIGH-RISK CLAUSES — the clauses that cost money if you miss them:
   → Indemnification
   → Limitation of Liability
   → IP Ownership
   → Termination
   → Auto-renewal

4. EVERYTHING ELSE — fill in your understanding of the edges
```

## Red Flag Phrases
```
"At its sole discretion" → the other party can make a decision with no obligation to you
"Notwithstanding the foregoing" → this clause overrides what was just said; read carefully
"Including without limitation" → the list that follows is examples, not exhaustive
"Shall survive termination" → this obligation continues even after contract ends
"Commercially reasonable efforts" → weaker standard than "best efforts" or "shall"
"Material adverse change" → often triggers termination rights; check what qualifies
"Prevailing party" (in attorney fees) → cuts both ways; you pay if you lose too
"Perpetual, irrevocable license" → they have the right forever, even if relationship ends
"Work made for hire" → you own nothing you create in scope — verify the scope
```

# NDA REVIEW

## Key Clauses to Check
```
DEFINITION OF CONFIDENTIAL INFORMATION:
  Standard: information marked as confidential, or described as confidential in writing within 30 days of disclosure
  Aggressive (bad for receiving party): "any information related to our business" — too broad
  Aggressive (bad for disclosing party): explicitly excludes common business information
  
  Push back if: scope is so broad it could cover publicly available information or information you independently developed

EXCLUSIONS (these should always be present):
  ✓ Information already known to recipient before disclosure
  ✓ Information independently developed without use of confidential info
  ✓ Information that becomes public through no fault of recipient
  ✓ Information required to be disclosed by law/regulation/court order

TERM:
  Standard: 2–3 years for business information; perpetual for trade secrets
  Aggressive: perpetual for all information
  Push back if: no end date — obligations should have a reasonable sunset

ONE-WAY vs. MUTUAL:
  One-way: only you receive confidential info (they're the discloser)
  Mutual: both parties exchange confidential info
  → If you're sharing too, make sure it's mutual

PERMITTED DISCLOSURES:
  ✓ Should be able to share with employees/advisors who need to know
  ✓ Should be able to share with legal/financial advisors
  → Often these require the recipient to be bound by similar confidentiality obligations
```

# SAAS / SOFTWARE AGREEMENT REVIEW

## Critical Clauses
```
DATA OWNERSHIP AND RIGHTS:
  Your data must remain yours — verify:
  ✓ Customer owns all customer data
  ✓ Vendor rights limited to: operating the service, service improvement (with opt-out)
  ✗ Red flag: "non-exclusive license to use customer data" without limits
  ✗ Red flag: no right to export your data on termination
  
  Key question: "Can we get our data out, in a usable format, if we cancel?"

UPTIME / SLA:
  Standard commercial SaaS: 99.9% monthly uptime (≈ 43 min downtime/month)
  Better: 99.95% or 99.99%
  Check what counts as "downtime" (often excludes maintenance windows and partial outages)
  Check what the remedy is: service credits are common, but 
    credit % should exceed the inconvenience (10% of monthly fee for an hour outage = worthless)

SECURITY:
  ✓ SOC 2 Type II certification (annual audit)
  ✓ Encryption at rest and in transit
  ✓ Data breach notification timeline (72 hours per GDPR if you handle EU data)
  ✓ Penetration testing (annual minimum)
  ✗ Red flag: no mention of security certifications or standards

LIMITATION OF LIABILITY:
  Standard for SaaS vendor: cap at 12 months of fees paid
  Reasonable: 12–24 months of fees paid
  Aggressive (bad for you as customer): 3 months or 1 month of fees
  Exceptions to the cap (these should be unlimited liability):
    ✓ Death or personal injury
    ✓ Fraud or gross negligence
    ✓ Data breach / confidentiality breach
    ✓ IP infringement (indemnification)

INDEMNIFICATION:
  Typical: vendor indemnifies customer against IP infringement claims
  (someone sues you saying vendor's software infringes their patent/copyright)
  
  Red flags:
  ✗ You indemnify vendor for everything — this is backwards
  ✗ No cap on indemnification obligations
  ✗ Vendor can change the product to avoid the IP claim (even if it breaks your workflows)

TERMINATION AND DATA DELETION:
  ✓ Right to terminate for cause (material breach not cured within 30 days)
  ✓ Right to terminate for convenience (with reasonable notice, typically 30–90 days)
  ✓ Data export period: 30–90 days after termination to export your data
  ✓ Data deletion certification after the export window
  ✗ Red flag: no termination for convenience — you're locked in indefinitely
  ✗ Red flag: data deleted immediately upon termination with no export window

AUTO-RENEWAL:
  Very common: agreements auto-renew unless cancelled 30/60/90 days before renewal
  ✓ Put a calendar reminder the moment you sign
  ✗ Red flag: cancellation notice required 90+ days before renewal (unusually long)
```

# EMPLOYMENT CONTRACT / OFFER LETTER REVIEW

## Key Clauses to Scrutinize
```
IP ASSIGNMENT:
  Standard: IP created using company resources and within the scope of employment → company owns it
  Aggressive: all IP created during employment, even on your personal time and unrelated to the business
  
  Most states have exceptions (CA Labor Code § 2870, similar laws in WA, IL, MN, etc.):
    → IP developed entirely on your own time, without company equipment,
       not related to company business → you own it
  
  ACTION: If you have side projects, list them as exceptions in an exhibit attached to the agreement.
          Most companies will accommodate this.

NON-COMPETE:
  Enforceability varies dramatically by state:
    California: effectively unenforceable (Labor Code § 16600)
    Texas, Florida: generally enforceable if reasonable in scope/duration/geography
    FTC rule (2024 — subject to legal challenge): attempted to ban most non-competes federally
  
  Evaluate even if unenforceable in your state: future employer may be in a different state.
  
  What "reasonable" looks like (if enforceable):
    Duration: 6–12 months (not 2–3 years)
    Geographic scope: limited to where you actually competed (not global)
    Role scope: limited to your actual role (not all of "technology industry")

NON-SOLICITATION:
  Of employees: can't recruit your colleagues for X months after leaving
  Of customers: can't solicit your customer book for X months after leaving
  Both are more commonly enforced than non-competes. Negotiate duration (12 months is common).

AT-WILL vs. TERM:
  At-will: either party can terminate at any time, for any reason (most US employment)
  Term: fixed duration contract (more common for executives, international)
  → If there's a termination clause, check: what triggers it, what's the severance

SEVERANCE:
  Not required by law (usually); must be negotiated
  Executive standard: 3–12 months salary, continued benefits, accelerated vesting
  Common terms: employer can condition severance on signing a separation agreement + release of claims
```

# VENDOR / MSA + SOW REVIEW

## Master Service Agreement (MSA)
```
PAYMENT TERMS:
  Standard: Net-30
  Your preferred: Net-60 (gives you more float)
  Watch for: late payment interest (1.5%/month = 18%/year — negotiate down or eliminate)

CHANGE ORDERS:
  Must be in writing and signed before work begins
  Verbal approval should not count (and doesn't, if the contract says otherwise)
  Watch for: "and any work performed will be billed at standard rates"

WARRANTIES:
  Vendor should warrant: services meet the SOW, comply with laws, no infringement
  Standard disclaimer: no warranty of fitness for a particular purpose beyond what's in the SOW

DISPUTE RESOLUTION:
  Negotiation → Mediation → Arbitration or Litigation
  Check: arbitration clauses often waive class action rights
  Check: mandatory arbitration location (expensive if they require arbitration in a distant city)
  Check: which state's law governs (significant if you're in a protective state like CA)
```

## Statement of Work (SOW)
```
Every SOW should include:
  ✓ Specific deliverables (not "consulting services" — describe exactly what will be created)
  ✓ Acceptance criteria (how do you know when a deliverable is done?)
  ✓ Timeline with milestones
  ✓ Payment tied to milestones (not front-loaded)
  ✓ IP ownership of work product (typically you own what you pay for)
  ✓ Change order process (how scope changes are handled)

Red flags in SOW:
  ✗ Vague deliverables ("strategic guidance" with no further definition)
  ✗ All payment due upfront before work begins
  ✗ No acceptance criteria — vendor decides when "done"
  ✗ No IP assignment clause (you might not own what you paid for)
```

# NEGOTIATION POSTURE

## What's Actually Negotiable
```
ALWAYS try to negotiate:
  → Cap on liability (push higher as customer, push lower as vendor)
  → Data rights and security requirements
  → Termination for convenience
  → Auto-renewal notice period (push shorter)
  → Payment terms

OFTEN negotiable:
  → IP assignment exceptions (side projects)
  → Non-compete scope and duration
  → Governing law (your state vs. theirs)
  → SLA credits (push for higher credit percentages)

RARELY negotiable with large vendors (but worth asking):
  → Core liability exclusions in standard SaaS terms
  → Fundamental service terms for commodity services

When they say "our contract is standard and non-negotiable":
  Everything is negotiable. "Standard" means "what we start with."
  But pick your battles — a five-person startup negotiating AWS terms will fail.
  Focus on the clauses that actually pose material risk to you.
```
