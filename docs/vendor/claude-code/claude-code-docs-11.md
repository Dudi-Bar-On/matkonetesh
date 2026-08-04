---
name: claude-code-docs-11
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 11/66 (code.claude.com)"
type: reference
---

## Choose an advisor model

The advisor must be at least as capable as the main model. Fable 5 satisfies the capability check but [isn't offered as the advisor](#enable-the-advisor), so the Fable entries in the following table apply once the rollout returns it as an option. The accepted advisors for each main model are:

| Main model                                      | Accepted advisors            | Notes                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Haiku 4.5                                       | Fable, Opus, Sonnet          | Haiku can call the advisor but cannot act as one                                                                                                                              |
| Sonnet 4.6                                      | Fable, Opus, Sonnet          |                                                                                                                                                                               |
| Sonnet 5                                        | Fable, Opus, Sonnet 5        | A Sonnet 4.6 advisor is rejected                                                                                                                                              |
| Opus 4.6                                        | Fable, Opus, Sonnet 5        | Sonnet 5 and Opus 4.6 are ranked as equally capable, so an Opus 4.6 main accepts a Sonnet 5 advisor                                                                           |
| Opus 4.7 or later                               | Fable, and Opus 4.7 or later | Opus 4.7 and later Opus models are ranked as equally capable, so any of them accepts another as an advisor. An Opus 4.7 main with an Opus 4.6 or Sonnet 5 advisor is rejected |
| Fable 5 ({/* min-version: 2.1.170 */}v2.1.170+) | Fable                        | An Opus or Sonnet advisor is rejected. Fable isn't offered as the advisor, so a Fable 5 main model runs without one                                                           |

Fable 5 requires Claude Code v2.1.170 or later and Fable 5 access, whether it acts as the main model or the advisor.

Set the advisor as `opus` or `sonnet`, or as `fable` once the rollout returns it as an option. These aliases resolve to Claude Code's built-in default version for each model family, which advances with new Claude Code releases. You can also pass a full model ID such as `claude-opus-5`.

Subagents inherit the configured advisor and apply the same pairing check against their own model.

Claude Code validates the pairing before sending a request:

* If the advisor is less capable than the main model, the advisor is not attached to the main model's requests. The `/advisor` command output and a notification show this. Subagents whose own model satisfies the pairing may still use the advisor.
* If the main model or the advisor is a model Claude Code does not recognize, the advisor is not attached.

### Common model pairings

Any accepted pairing works. Pairings that use Fable 5 as the advisor apply once Fable 5 [returns as an advisor option](#enable-the-advisor). These combinations balance cost against capability in different ways:

| Pairing                      | When to use                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sonnet main + Opus advisor   | Sonnet handles routine work and escalates planning, ambiguous failures, and completion checks to Opus                                                                    |
| Sonnet main + Fable advisor  | Fable 5 guidance at decision points without running Fable 5 throughout. Requires v2.1.170 or later and Fable 5 access                                                    |
| Haiku main + Opus advisor    | Lowest-cost main model with strong planning. Expect higher cost than Haiku alone but lower than switching the main model to Sonnet or Opus                               |
| Opus main + Opus advisor     | A second Opus reviews the first. Useful for high-stakes tasks where an independent check matters more than cost                                                          |
| Fable main + Fable advisor   | Highest-capability pairing when Fable 5 is available (v2.1.170+). Fable is a higher tier than Opus and Sonnet, so it is the only accepted advisor for a Fable main model |
| Sonnet main + Sonnet advisor | A lower-cost second opinion for catching routine oversights                                                                                                              |

## When Claude consults the advisor

Claude decides when to call the advisor. It tends to consult before committing to an approach, when an error keeps recurring, and before declaring a task done, but the timing is model-driven rather than rule-based.

You can ask for a consultation in your prompt the same way you would request any tool, for example `consult the advisor before you continue`. There is no setting to cap or force advisor calls; if you want Claude to consult more or less often during a task, say so in your instructions.

## What you see during a session

When Claude calls the advisor, the transcript shows an `Advising` line with the advisor model name while the call is in progress. When the result returns, the line confirms that the advisor has reviewed the conversation. Press `Ctrl+O` to expand it and read the advisor's full guidance.

Claude generally follows the advisor's guidance, but adapts when its own evidence contradicts a specific claim: if a recommended step fails when tried, or the file contents contradict the advice, Claude surfaces the conflict rather than following the guidance unconditionally.

The advisor always receives the full conversation, and Claude controls the timing. For more control or a different configuration, see [how the advisor compares with subagents and opusplan](#compare-with-related-features).

## Cost

Each advisor call sends the conversation to the advisor model, so it consumes tokens at the advisor model's rates in addition to your main model's usage. With API billing, advisor tokens are charged at the advisor model's input and output rates. On subscription plans, advisor usage counts toward your plan's usage limits.

Claude calls the advisor at decision points rather than on every turn, so pairing a faster main model with a stronger advisor typically costs less than running the stronger model throughout. Advisor usage counts toward the session totals shown by [`/usage`](/docs/en/costs#track-your-costs).

For how advisor tokens are reported in API responses, see [Usage and billing](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool#usage-and-billing) in the Claude API documentation.
