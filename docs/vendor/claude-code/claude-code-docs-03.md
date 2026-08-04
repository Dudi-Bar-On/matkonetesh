---
name: claude-code-docs-03
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 03/66 (code.claude.com)"
type: reference
---

# Set up Claude Code for your organization

> A decision map for administrators deploying Claude Code, covering API providers, managed settings, policy enforcement, usage monitoring, and data handling.

Claude Code enforces organization policy through managed settings that take precedence over local developer configuration. You deliver those settings from the Claude admin console, your mobile device management (MDM) system, or a file on disk. The settings control which tools, commands, servers, and network destinations Claude can reach.

This page walks through the deployment decisions in order. Each row links to the section below and to the reference page for that area.

<Note>
  SSO, SCIM provisioning, and seat assignment are configured at the Claude account level. See the [Claude Enterprise Administrator Guide](https://claude.com/resources/tutorials/claude-enterprise-administrator-guide) and [seat assignment](https://support.claude.com/en/articles/11845131-use-claude-code-with-your-team-or-enterprise-plan) for those steps.
</Note>

| Decision                                                                | What you're choosing                                | Reference                                                                                                                                                                     |
| :---------------------------------------------------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Choose your API provider](#choose-your-api-provider)                   | Where Claude Code authenticates and how it's billed | [Authentication](/docs/en/authentication), [Amazon Bedrock](/docs/en/amazon-bedrock), [Google Cloud's Agent Platform](/docs/en/google-vertex-ai), [Microsoft Foundry](/docs/en/microsoft-foundry) |
| [Decide how settings reach devices](#decide-how-settings-reach-devices) | How managed policy reaches developer machines       | [Server-managed settings](/docs/en/server-managed-settings), [Settings files](/docs/en/settings#settings-files)                                                                         |
| [Decide what to enforce](#decide-what-to-enforce)                       | Which tools, commands, and integrations are allowed | [Permissions](/docs/en/permissions), [Sandboxing](/docs/en/sandboxing)                                                                                                                  |
| [Set up usage visibility](#set-up-usage-visibility)                     | How you track spend and adoption                    | [Analytics](/docs/en/analytics), [Monitoring](/docs/en/monitoring-usage), [Costs](/docs/en/costs)                                                                                            |
| [Review data handling](#review-data-handling)                           | Data retention and compliance posture               | [Data usage](/docs/en/data-usage), [Security](/docs/en/security)                                                                                                                        |

## Choose your API provider

Claude Code connects to Claude through one of several API providers. Your choice affects billing, authentication, which compliance posture you inherit, and which Claude Code features your developers can use.

| Provider                      | Choose this when                                                                                                                      |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| Claude for Teams / Enterprise | You want Claude Code and claude.ai under one per-seat subscription with no infrastructure to run. This is the default recommendation. |
| Claude Console                | You're API-first or want pay-as-you-go billing                                                                                        |
| Amazon Bedrock                | You want to inherit existing AWS compliance controls and billing                                                                      |
| Google Cloud's Agent Platform | You want to inherit existing GCP compliance controls and billing                                                                      |
| Microsoft Foundry             | You want to inherit existing Azure compliance controls and billing                                                                    |

Some Claude Code features require a claude.ai account. [Claude Code on the web](/docs/en/claude-code-on-the-web), [Routines](/docs/en/routines), [Code Review](/docs/en/code-review), [Remote Control](/docs/en/remote-control), and the [Chrome extension](/docs/en/chrome) aren't available through Console API keys or cloud-provider credentials alone. If you deploy through Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry, plan whether developers also need Claude for Teams or Enterprise seats. Each feature page lists its plan requirements.

For the full provider comparison covering authentication, regions, and feature parity, see the [enterprise deployment overview](/docs/en/third-party-integrations). Each provider's auth setup is in [Authentication](/docs/en/authentication).

Proxy and firewall requirements in [Network configuration](/docs/en/network-config) apply regardless of provider. If you want a single endpoint in front of multiple providers or centralized request logging, see [LLM gateway](/docs/en/llm-gateway).
