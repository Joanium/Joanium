# Security Policy

## Supported Versions

| Version  | Supported          |
| -------- | ------------------ |
| 2026.x.x | Will be retired on May 31st |

## Reporting a Vulnerability

If you discover a security vulnerability in Joanium, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

Instead, email: joaniumhere@gmail.com

Include the following in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive an acknowledgment within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Security Considerations

- Joanium stores data locally by default under `Data/`
- API keys and credentials are stored in local config files
- Review the `Config/` and `Data/` directories to understand what data is persisted
- Connector integrations (Gmail, GitHub) require OAuth or token-based auth
