---
name: claude-code-docs-08
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 08/66 (code.claude.com)"
type: reference
---

[Claude Code on the web](/docs/en/claude-code-on-the-web) has its own admin surface: on the Cloud environments page in admin settings, owners and admins create [organization-shared environments](/docs/en/cloud-environments#organization-shared-environments) that set the [network access level](/docs/en/cloud-environments#network-access), environment variables, and setup script for members' cloud sessions. Owners and admins choose the organization's default environment separately, at [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code).

Permission rules and sandboxing cover different layers. Denying WebFetch blocks Claude's fetch tool, but if Bash is allowed, `curl` and `wget` can still reach any URL. Sandboxing closes that gap with a network domain allowlist enforced at the OS level.

For the threat model these controls defend against, see [Security](/docs/en/security).
