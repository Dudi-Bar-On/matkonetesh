---
name: bmad-docs-12
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 12/30 (raw.githubusercontent.com)"
type: reference
---

## What is Party Mode?

Run `bmad-party-mode` and the BMad agents you already have installed gather in one conversation: the PM, Architect, Dev, UX Designer, and whoever else your selected modules bring. That installed lineup is your default party, ready with no setup. They answer in character, agree, disagree, and build on each other. You steer the room. Ask a follow-up, push back, pull one voice forward, or change the subject. The conversation runs until you end it.

It works because the personas hold different priorities. The Architect guards the design, the PM guards scope, the Dev guards what's actually buildable. Put them in the same room and the tradeoff surfaces now, in the conversation, instead of three weeks into the sprint.

**Good for:**

- Decisions with real tradeoffs
- Brainstorming and "what are we missing?"
- Post-mortems and retrospectives
- Pressure-testing a plan before you commit

Party mode is also a fast and genuinely fun way to brainstorm, since the personas have opinions and they clash. And you can start a party from inside any other workflow: mid-brainstorm, mid-PRD, while coding, working a sales angle, or shaping a creative piece. Any time you want more perspectives on what's in front of you, pull in a room without dropping what you were doing.

:::note[Example]
**You:** Monolith or microservices for the MVP?

**Architect:** Start monolith. Microservices add operating cost you don't need at a thousand users.

**PM:** Agreed. Time to market matters more than scaling we can't prove yet.

**Dev:** Monolith, but with clean module boundaries so we can split a service out later without a rewrite.
:::

## Starting a party

Invoke the skill and say what you want; it works out whether you mean to run a party or build one.

| Goal | Type this |
| --- | --- |
| Start a party in the default mode | `/bmad-party-mode` |
| Start in a specific mode | `/bmad-party-mode --mode auto` (also `session`, `subagent`, `agent-team`) |
| Run it once, non-interactively | `/bmad-party-mode --non-interactive "review this PR"` |
| Open a saved party | `/bmad-party-mode --party code-review-crew` |
| Conjure a cast on the spot | "party mode with the bridge crew of the Enterprise" |
| Create or add a party | "party mode, create a new party" |
| Edit an existing party | "party mode, edit the writers' room" |
| Customize the skill | `/bmad-customize bmad-party-mode` |

## How a party runs

A party can run in four modes. One mode is active per session, and it decides who does the thinking: a single model voicing everyone, or separate agents reasoning on their own.

| Mode | What it does | Reach for it when |
| --- | --- | --- |
| `session` | Default. One model voices every persona inline. Fast and fully conversational. | Most conversations — banter, brainstorming, quick back-and-forth. |
| `auto` | Voices inline for light rounds, spawns independent agents only when independence changes the answer. | You want speed most of the time but real independence on the hard rounds. |
| `subagent` | Spawns a separate agent for each persona every substantive round, so no single mind colors them all. | Honest reviews and focus groups, where the voices must not bleed together. |
| `agent-team` | Stands the personas up as a persistent team that address each other directly. Claude Code only. | A live, hands-off round-table where the agents talk among themselves. |

The choice matters because one model voicing five personas can quietly converge: they share a mind. Spawning real agents keeps their reasoning separate, which is the entire point of a review panel or a focus group. `session` is the cheapest and most fluid. The spawning modes cost more but protect independence, and `auto` aims for both by spawning only when a round needs it.

`session` is the default, and every other mode falls back to it when a harness can't do the rest: `agent-team` drops to `subagent`, then to `session`. The configured default lives in your customization, and a runtime override wins for that session.

:::tip[Override for one session]
Start a party with `--mode subagent` (or `auto`, `agent-team`, `session`) to override the configured default just for that run.
:::

A party is interactive by default: the opening ask is a starting topic, not a stopping point, and the room stays open round after round until you end it. Answering the first question never ends the party on its own. To run it the other way — serve one intent and stop — start with `--non-interactive`; it runs to a natural close, wraps up, and releases any spawned agents.

## Custom parties

Out of the box, a party uses your installed BMad agents. The larger use is building your own cast from any set of personas you can describe, then saving it to reuse. You author a party through the same skill. It detects whether you want to run one or build one, and writes the result to your overrides through [bmad-customize](../how-to/customize-bmad.md).

Party mode is customizable like every BMad skill. Run `/bmad-customize bmad-party-mode` to set its defaults directly: pin any group you've built as the default party so it loads without a flag, choose which mode it starts in, and set any house rules the room should hold for the whole session.

Two ideas do most of the work.

**Personas** are what make a member unmistakable: how they talk, what they value, how they argue, their pet peeves and blind spots. "Skeptical CFO" is a placeholder. "Won't approve anything without a payback under eighteen months, and says so in the first thirty seconds" is a persona. That detail is what gives a voice you'd recognize with the name labels hidden.

**Scenes** set the stage. A scene is one freeform line: the setting, what's happening, who's hostile to whom, who pushes hardest. The same members play it differently each time, so you define a person once and drop them into a bridge crew on duty, the same crew off-duty in the lounge, or a hostile buyer panel. Members combine into named groups, and you can pin one group as the default room.

### Shapes a party can take

| Shape | What it is |
| --- | --- |
| Themed cast | Famous investors, a TV ensemble — distinct voices gathered around a topic. |
| One-off personas | A persona or two added to the pool, no group needed. |
| Focus group from data | Hand it customer or survey data; it clusters people by what drives their behavior and builds representative personas. Pair it with `subagent` mode so the customers stay independent. |
| Review panel | Purpose-built critical lenses that argue about what matters. The shipped Code Review Crew is one. |
| Deliberation scaffold | A room that makes the human think harder without pretending to be an autonomous decision council. The shipped Anti-Consensus Club is one. |
| Open-cast room | No fixed roster. The scene names a universe and the room is cast on the fly as the topic shifts. |

A focus group is the case that pays off most. Feed in real profiles and you get a standing panel of representative customers to test an idea against before you build it, each reacting from their own goals and budget instead of agreeing with the last voice.
