# Security Policy

## Supported Versions

Recode is pre-1.0. Security fixes are applied to the latest commit on `main`.
Older releases are not supported.

## Reporting a Vulnerability

Use GitHub's private vulnerability reporting for this repository:

https://github.com/WenJiazhi/recode/security/advisories/new

Include a clear reproduction, affected platform, impact, and any proposed
mitigation. Remove credentials, private source code, and personal data from all
attachments. Please allow a reasonable remediation window before disclosure.

## Security Boundaries

Recode can read and modify files, execute commands, and call external model and
MCP services. Review permission prompts and provider endpoints before use. Keep
API keys in ignored local files or environment variables and never commit them.
