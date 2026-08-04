---
name: claude-code-docs-04
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 04/66 (code.claude.com)"
type: reference
---

## Decide how settings reach devices

Managed settings define policy that takes precedence over local developer configuration. Claude Code checks the four sources below in priority order and applies the first one that returns a non-empty configuration. A small set of [cross-source lock keys](/docs/en/settings#settings-precedence), such as the sandbox allowlist locks, is honored when any admin-controlled source sets them; when a [`policyHelper`](/docs/en/settings#compute-managed-settings-with-a-policy-helper) is configured, its output is the only source these checks read.

| Mechanism               | Delivery                                                                                                                                                                                              | Priority | Platforms      |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------------- |
| Server-managed          | claude.ai admin console, or a self-hosted [Claude apps gateway](/docs/en/claude-apps-gateway) for gateway sign-ins                                                                                         | Highest  | All            |
| plist / registry policy | macOS: `com.anthropic.claudecode` plist<br />Windows: `HKLM\SOFTWARE\Policies\ClaudeCode`                                                                                                             | High     | macOS, Windows |
| File-based managed      | macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`<br />Linux and WSL: `/etc/claude-code/managed-settings.json`<br />Windows: `C:\Program Files\ClaudeCode\managed-settings.json` | Medium   | All            |
| Windows user registry   | `HKCU\SOFTWARE\Policies\ClaudeCode`                                                                                                                                                                   | Lowest   | Windows only   |

A configured [`policyHelper`](/docs/en/settings#compute-managed-settings-with-a-policy-helper) preempts all four sources: its output becomes the only managed configuration for the run. See [Settings precedence](/docs/en/settings#settings-precedence).

Server-managed settings reach devices at authentication time and refresh hourly during active sessions, with no endpoint infrastructure. Delivery through the claude.ai admin console requires a Claude for Teams or Enterprise plan. Deployments on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry can get the same remote delivery by running a [Claude apps gateway](/docs/en/claude-apps-gateway), or use one of the file-based or OS-level mechanisms instead.

If your organization mixes providers, configure [server-managed settings](/docs/en/server-managed-settings) for claude.ai users plus a [file-based or plist/registry fallback](/docs/en/settings#settings-files) so other users still receive managed policy.

The plist and HKLM registry locations work with any provider and resist tampering because they require admin privileges to write. The Windows user registry at HKCU is writable without elevation, so treat it as a convenience default rather than an enforcement channel.

By default, WSL reads only the Linux file path at `/etc/claude-code`. To extend your Windows registry and `C:\Program Files\ClaudeCode` policy to WSL on the same machine, set [`wslInheritsWindowsSettings: true`](/docs/en/settings#available-settings) in either of those admin-only Windows sources.

Whichever mechanism you choose, managed values take precedence over user and project settings. Array settings such as `permissions.allow` and `permissions.deny` merge entries from all sources, so developers can extend managed lists but not remove from them. For [two exceptions](/docs/en/settings#settings-precedence), `fallbackModel` and `availableModels`, the managed value replaces lower layers rather than merging.

See [Server-managed settings](/docs/en/server-managed-settings) and [Settings files and precedence](/docs/en/settings#settings-files).

### WSL sessions in Claude Code Desktop

On Windows, [Claude Code Desktop can run Code sessions inside a WSL 2 distribution](/docs/en/desktop-wsl). The session's Claude Code process runs inside the distribution, so it resolves managed settings through the WSL discovery path above: Windows-only sources don't reach it unless `wslInheritsWindowsSettings: true` is deployed.

On devices where managed settings are present, Desktop WSL sessions are unavailable by default. If your organization wants to enable them, contact your Anthropic account team. When they're enabled:

* Deploy `wslInheritsWindowsSettings: true` through the HKLM registry or the `C:\Program Files\ClaudeCode` file so WSL sessions inherit the same policy as host sessions.
* Verify by running `/status` inside a WSL session: the `Setting sources` line should show `Enterprise managed settings` with the Windows source you deployed, `(HKLM)` or `(file)`.

Processes inside the WSL 2 utility VM aren't visible to Windows-side endpoint detection sensors. If you use CrowdStrike Falcon, enable the Falcon sensor for Linux on WSL 2 with the two exclusions CrowdStrike's WSL documentation requires, for the WSL virtual machine process and the VM disk image, so in-distro process and file activity is observable. Claude Code's [OpenTelemetry tool-execution telemetry](/docs/en/monitoring-usage) is emitted identically for WSL and native sessions.
