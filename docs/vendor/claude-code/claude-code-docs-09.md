---
name: claude-code-docs-09
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 09/66 (code.claude.com)"
type: reference
---

## Set up usage visibility

Choose monitoring based on what you need to report on. The dashboards, APIs, and spend controls differ between Claude for Teams or Enterprise plans and Claude Console organizations, so check the Availability column before you plan your reporting around a capability.

| Capability             | What you get                                                                                                            | Availability                                                                                                                                                                                                                             | Where to start                                        |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| Usage monitoring       | OpenTelemetry export of sessions, tools, and tokens                                                                     | All providers                                                                                                                                                                                                                            | [Monitoring usage](/docs/en/monitoring-usage)              |
| Analytics dashboard    | Adoption and contribution metrics with a leaderboard on Teams / Enterprise; per-user usage and spend metrics on Console | Teams / Enterprise at [claude.ai/analytics](https://claude.ai/analytics/claude-code), Console at [platform.claude.com/claude-code](https://platform.claude.com/claude-code)                                                              | [Analytics](/docs/en/analytics)                            |
| Programmatic reporting | Per-user usage and cost data over an API                                                                                | [Enterprise Analytics API](https://platform.claude.com/docs/en/api/admin/analytics) for Enterprise, [Claude Code Analytics API](https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api) for Console             | [Costs](/docs/en/costs#manage-costs-for-your-organization) |
| Spend controls         | Spend limits and rate limits                                                                                            | Admin settings for Teams / Enterprise, workspace limits for Console; on third-party clouds, cloud budget controls or a [Claude apps gateway](/docs/en/claude-apps-gateway) with per-user [spend limits](/docs/en/claude-apps-gateway-spend-limits) | [Costs](/docs/en/costs#manage-costs-for-your-organization) |

On Teams and Enterprise, per-user usage and spend numbers come from the [spend report](https://support.claude.com/en/articles/12883420-view-usage-analytics-for-team-and-enterprise-plans) in your organization's analytics settings, not the analytics dashboard. Cloud providers expose spend through AWS Cost Explorer, GCP Billing, or Azure Cost Management. For planning enterprise budgets across Claude chat, Claude Code, and Cowork, see the [Claude Enterprise consumption guide](https://support.claude.com/en/articles/14782391-claude-enterprise-consumption-guide).

## Review data handling

On Team, Enterprise, Claude API, and cloud provider plans, Anthropic doesn't train models on your code or prompts. Your API provider determines retention and compliance posture.

| Topic                     | What to know                                                                                         | Where to start                                 |
| :------------------------ | :--------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| Data usage policy         | What Anthropic collects, how long it's retained, what's never used for training                      | [Data usage](/docs/en/data-usage)                   |
| Zero Data Retention (ZDR) | Nothing stored after the request completes. Available to qualified accounts on Claude for Enterprise | [Zero data retention](/docs/en/zero-data-retention) |
| Security architecture     | Network model, encryption, authentication, audit trail                                               | [Security](/docs/en/security)                       |

If you need request-level audit logging or to route traffic by data sensitivity, place a gateway between developers and your provider: a self-hosted [Claude apps gateway](/docs/en/claude-apps-gateway) records a per-request audit log with IdP identity, or use another [LLM gateway](/docs/en/llm-gateway). For regulatory requirements and certifications, see [Legal and compliance](/docs/en/legal-and-compliance).

## Verify and onboard

After configuring managed settings, have a developer run `/status` inside Claude Code. On the **Status** tab, the `Setting sources` line shows `Enterprise managed settings` followed by the source in parentheses, one of `(remote)`, `(plist)`, `(HKLM)`, `(HKCU)`, or `(file)`. See [Verify active settings](/docs/en/settings#verify-active-settings).

Share these resources to help developers get started:

* [Quickstart](/docs/en/quickstart): first-session walkthrough from install to working with a project
* [Common workflows](/docs/en/common-workflows): patterns for everyday tasks like code review, refactoring, and debugging
* [Claude 101](https://anthropic.skilljar.com/claude-101) and [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action): self-paced Anthropic Academy courses

For login issues, point developers to [authentication troubleshooting](/docs/en/troubleshoot-install#login-and-authentication). The most common fixes are:

* Run `/logout` then `/login` to switch accounts
* Run `claude update` if the enterprise auth option is missing
* Restart the terminal after updating

If a developer sees "You haven't been added to your organization yet," their seat doesn't include Claude Code access and needs to be updated in the admin console.

## Next steps

With provider and delivery mechanism chosen, move on to detailed configuration:

* [Server-managed settings](/docs/en/server-managed-settings): deliver managed policy from the Claude admin console
* [Settings reference](/docs/en/settings): every setting key, file location, and precedence rule
* [Monorepos and large repos](/docs/en/large-codebases): per-directory configuration patterns for organizations deploying into a monorepo
* [Amazon Bedrock](/docs/en/amazon-bedrock), [Google Cloud's Agent Platform](/docs/en/google-vertex-ai), [Microsoft Foundry](/docs/en/microsoft-foundry): provider-specific deployment
* [Claude Enterprise Administrator Guide](https://claude.com/resources/tutorials/claude-enterprise-administrator-guide): SSO, SCIM, seat management, and rollout playbook


<!-- source: https://code.claude.com/docs/en/advisor.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.
