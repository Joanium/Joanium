---
name: Compliance & SOC 2
trigger: SOC 2, SOC2, compliance, audit, ISO 27001, trust service criteria, security controls, audit evidence, penetration testing, vendor assessment, compliance program, HIPAA compliance, PCI DSS, control framework, compliance automation, Vanta, Drata, Secureframe
description: A practical guide to building, running, and evidencing a security compliance program. Use for SOC 2 Type I and Type II preparation, ISO 27001, control implementation, audit evidence collection, and building continuous compliance for SaaS companies.
---

Compliance is the practice of demonstrating that your organization meets a defined set of security, privacy, and operational controls. SOC 2 is the most common certification for B2B SaaS companies. It's not just a checkbox — when done well, a compliance program forces good engineering and operational practices that make your product more reliable and secure.

## SOC 2 Overview

```
SOC 2 = System and Organization Controls 2

Conducted by:   Independent CPA firm (not Vanta/Drata — those are prep tools)
Based on:       AICPA Trust Service Criteria (TSC)
Two types:
  Type I:  Point-in-time — "controls are designed correctly" (faster, 1-3 months)
  Type II: Period of time (usually 6-12 months) — "controls operated effectively"
           This is what enterprise customers actually require

Trust Service Criteria (choose which apply to your business):
  CC: Common Criteria (Security) — REQUIRED for all SOC 2
  A:  Availability              — if you have uptime SLAs
  PI: Processing Integrity       — if you process financial transactions
  C:  Confidentiality           — if you handle sensitive data
  P:  Privacy                   — if you process personal data
  
Most SaaS companies pursue CC + Availability.
```

## Phase 1: Readiness Assessment (Gap Analysis)

Before engaging an auditor, do a gap analysis. Auditors bill by the hour; know where you stand first.

**Common Criteria domains:**
```
CC1  — Control Environment (governance, policies, org structure)
CC2  — Communication and Information (how info flows in the org)
CC3  — Risk Assessment (you identify and assess risks)
CC4  — Monitoring Activities (controls are reviewed and effective)
CC5  — Control Activities (specific controls that address risks)
CC6  — Logical and Physical Access Controls (who can access what)
CC7  — System Operations (how you operate your systems)
CC8  — Change Management (how changes are tested and deployed)
CC9  — Risk Mitigation (vendor management, business continuity)
```

**Gap analysis checklist:**
```
Policies (CC1, CC2, CC3):
  □ Information Security Policy — exists, approved, distributed, reviewed annually
  □ Acceptable Use Policy
  □ Access Control Policy
  □ Vendor Management Policy
  □ Business Continuity / Disaster Recovery Plan
  □ Incident Response Plan
  □ Data Classification Policy

Access Controls (CC6):
  □ SSO + MFA enforced for all production systems
  □ Principle of least privilege — users only have access they need
  □ Access reviews completed quarterly (who has access to what?)
  □ Offboarding process — access revoked within 24h of termination
  □ Unique user accounts — no shared credentials
  □ Privileged access monitored and logged (root, admin access)
  □ Secrets in secrets manager (not hardcoded, not in .env files in git)

Change Management (CC8):
  □ Code reviews required before merge
  □ Automated testing runs on every PR
  □ Separate dev / staging / production environments
  □ Deployment change log (who deployed what and when)
  □ Change approval process for production infrastructure

System Operations (CC7):
  □ Vulnerability scanning (SAST in CI, dependency scanning)
  □ Intrusion detection or anomaly alerting
  □ Logging enabled for all critical systems (auth events, data access)
  □ Log retention (typically 1 year required)
  □ Incident response process with documented runbooks

Risk Assessment (CC3):
  □ Formal risk register — identified risks, likelihood, impact, mitigations
  □ Annual risk review meeting documented
  □ Penetration test completed in last 12 months

Vendor Management (CC9):
  □ Vendor inventory maintained
  □ Critical vendors assessed for security posture
  □ BAAs signed with any vendors processing personal health data (HIPAA)
  □ DPAs signed with vendors processing EU personal data (GDPR)
```

## Phase 2: Building Controls

Controls are the actual processes and technical safeguards that make up your compliance program.

**Technical controls (automated — easiest to evidence):**
```yaml
# SSO + MFA enforcement (Okta / Azure AD example)
# Evidence: screenshot of MFA policy; exported user list showing enrollment

# Okta policy: require MFA for all apps
- policy: "Require MFA for All Users"
  conditions:
    network: any
    user_type: any
  actions:
    mfa_required: true
    mfa_factors: [totp, webauthn]  # No SMS — too easily bypassed

# Production access controls
# Evidence: AWS IAM policy docs; screenshot of role assignments

{
  "Effect": "Deny",
  "Action": "*",
  "Resource": "*",
  "Condition": {
    "BoolIfExists": {
      "aws:MultiFactorAuthPresent": "false"
    }
  }
}
```

**Vulnerability management pipeline:**
```yaml
# Add these to CI/CD — auto-generates audit evidence
- name: SAST (Static Analysis)
  uses: github/codeql-action/analyze@v3
  # Evidence: Code scanning alerts dashboard; exported report

- name: Dependency Vulnerability Scan
  run: |
    npm audit --audit-level=high
    # Or: snyk test --severity-threshold=high
  # Evidence: Audit report; linked tickets for any findings

- name: Container Scanning
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_TAG }}
    severity: CRITICAL,HIGH
    exit-code: 1
  # Evidence: Trivy scan reports stored as CI artifacts
```

**Access review automation:**
```python
# Quarterly access review — who has access to what systems
# Run this script, review output, document approval in ticket

import boto3

def generate_access_report():
    iam = boto3.client('iam')
    
    report = []
    # List all users and their groups/roles
    for user in iam.get_paginator('list_users').paginate():
        for u in user['Users']:
            groups = iam.list_groups_for_user(UserName=u['UserName'])['Groups']
            last_used = iam.get_user(UserName=u['UserName'])['User'].get('PasswordLastUsed')
            
            report.append({
                'user': u['UserName'],
                'email': u.get('Tags', {}).get('Email', 'unknown'),
                'groups': [g['GroupName'] for g in groups],
                'last_login': last_used,
                'inactive_90d': is_older_than_90_days(last_used)
            })
    
    return report
    
# Output this report to a shared doc
# Review: is each user still employed? Do they still need this access?
# Document reviewer name + date + approval
# Action: remove access for any user who shouldn't have it
```

## Phase 3: Evidence Collection

Evidence is proof that your controls actually operated over the audit period. Collect continuously, not at audit time.

**Evidence categories and sources:**
```
Policy Evidence:
  - Signed policy documents with version history
  - Confirmation emails showing policies were distributed and acknowledged
  - Annual review notes

Access Control Evidence:
  - MFA enrollment reports (exported from Okta/Auth0 monthly)
  - User access lists for production systems (quarterly export)
  - Access review tickets with approvals documented
  - Offboarding tickets showing timely access revocation

Change Management Evidence:
  - GitHub PRs showing required code reviews
  - CI/CD run logs (tests passing before deploy)
  - Deployment history with approver (or automation with audit log)

Security Operations Evidence:
  - Vulnerability scan reports (weekly/monthly)
  - Penetration test report (annual)
  - Security incident log (even if "zero incidents" is the answer)
  - CloudTrail / audit log configuration screenshots

Vendor Management Evidence:
  - Vendor list with last review date
  - BAAs and DPAs (signed copies on file)
  - Security review questionnaires for critical vendors
```

**Evidence automation (Vanta, Drata, Secureframe):**
```
These tools connect to your AWS, GitHub, Okta, etc. and automatically:
  - Collect evidence (continuous)
  - Flag failing controls ("MFA not enabled for user X")
  - Generate audit-ready evidence packages

Cost: $10,000-30,000/year
ROI: Replaces ~0.5 FTE of manual evidence collection; 
     speeds audit prep from weeks to days

You still need to:
  - Write your policies (they provide templates but you must customize)
  - Conduct access reviews (they surface who needs review; you do the reviewing)
  - Respond to auditor questions
  - Run penetration tests (auditors require a human pentest, not just automated)
```

## Phase 4: Audit Preparation

**Selecting an auditor:**
```
What to look for:
  - CPA firm specialized in SOC 2 (not a general accounting firm)
  - Experience with your industry / tech stack
  - Reference check: talk to 2 of their recent SOC 2 clients

Cost range:
  - Type I: $15,000-40,000
  - Type II: $20,000-60,000
  - Larger/more complex = higher cost

Timeline:
  - Type I: 4-8 weeks from kickoff to report
  - Type II: 3 months of audit period + 4-8 weeks for testing + report
  - Total Type II: 4-6 months
```

**Common audit findings to prevent:**
```
🚨 High risk findings (will fail the audit):
  - Production credentials accessible to all engineers (shared secrets)
  - No MFA on any production systems
  - No documented access review has ever been performed
  - Critical vulnerabilities (CVSS > 9) unpatched for > 30 days

⚠️ Medium risk findings (exceptions in report, lowers trust):
  - Terminated employees still have active accounts after 30 days
  - No penetration test in the past 12 months
  - Policies exist but no evidence they were reviewed/distributed
  - Logging not enabled on some critical systems

💡 Low risk findings (noted, minimal impact):
  - Policy review overdue by a few months
  - Minor gaps in vendor assessment completeness
  - Documentation could be more thorough
```

## Maintaining Continuous Compliance

```
Annual calendar:
  Q1: Renew policies (review, update, redistribute, collect acknowledgments)
  Q1: Kickoff pentest engagement (results available by Q2)
  Q1: Review and update risk register
  Q2: Complete access reviews for all critical systems
  Q2: Review vendor list; update assessments for critical vendors
  Q2: Pentest remediation — fix and verify all critical/high findings
  Q3: Security awareness training for all employees
  Q3: Business continuity / DR plan review
  Q4: Start audit preparation; compile evidence package
  Q4: Auditor kickoff

Monthly:
  - Export MFA enrollment report; flag any non-enrolled users
  - Review vulnerability scan results; ensure critical findings have tickets
  - Review access changes in the month (new hires, leavers, role changes)

Ongoing:
  - Every offboarding: revoke access same day
  - Every new tool: add to vendor inventory; sign BAA/DPA if applicable
  - Every incident: log it in the incident register
  - Every production change: ensure it's traceable in audit log
```
