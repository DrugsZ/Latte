# Security Policy

Latte is pre-1.0, but security reports are still welcome.

## Supported Versions

| Version                 | Supported                  |
| ----------------------- | -------------------------- |
| `main`                  | Best-effort security fixes |
| npm releases before 1.0 | Best-effort only           |

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

Send a private report to the maintainers with:

- A short summary.
- Steps to reproduce.
- Affected package or app.
- Browser/OS/runtime versions when relevant.
- Proof of concept if available.
- Impact assessment.

If no private security contact is configured yet, use a private channel to the repository owner and avoid sharing exploit details publicly.

## Security-Sensitive Areas

Latte maintainers should pay special attention to:

- Plugin manifest and future extension host isolation.
- RPC payload validation.
- File import and schema migration.
- SharedArrayBuffer deployment requirements.
- Clipboard, network, storage and export permissions.
- Any path that could let plugins or UI code write raw document memory directly.

## Disclosure

Maintainers will acknowledge reports as soon as practical, investigate impact, prepare a fix and publish disclosure notes when appropriate.
