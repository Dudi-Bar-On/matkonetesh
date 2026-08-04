---
name: bmad-docs-10
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 10/30 (raw.githubusercontent.com)"
type: reference
---

## The Room

The forge is voiced. Once the topic is set, every branch arrives with two characters instead of one faceless assistant. One comes from your installed roster — an agent or persona you'll recognize, drawn from the same cast behind [Party Mode](./party-mode.md) and [named agents](./named-agents.md). The other is conjured on the fly by the topic itself: a hostile competitor, a skeptical CFO, a domain specialist who has watched this exact plan fail before.

You steer the room whenever you want. Name a specific person, call a saved party, or invoke the **adversarial on this** gear to attack a claim to destruction with you defending it.

## Never Default-Agree

Reflexive agreement is the failure this skill exists to refuse. Acknowledging your idea isn't the same as endorsing it, and the forge won't praise anything before it has survived something. It attacks the weak point or builds on the strong one, and it credits only what genuinely earns the credit.

This is the deliberate inverse of [Adversarial Review](./adversarial-review.md). There, the reviewer is told to find problems and you filter out the false positives. Here, the interrogator is told never to grant agreement for free, so the pressure stays high and you think harder under it. It optimizes for the best idea over a comfortable session.

## How a Session Ends

The session ends however the thinking lands, and every landing is a real outcome. The forge writes a self-contained report you can keep, stamped to match the result.

| Outcome | What it means |
| --- | --- |
| **Hardened** | The idea survived. It distills into `forged-idea.md` (the locked decisions, plus what was killed and why), ready to feed `bmad-spec`, `bmad-prd`, or `bmad-prfaq` for a product concept. |
| **Killed** | The idea didn't survive, and the report records the cause of death. Finding that out cheaply is a win. |
| **Clearer** | You just think straighter now. No artifact needed, and the session stands on its own. |

## When to Use It

Reach for the forge when you already hold an idea and want it hardened or killed before you invest in it. Skip it when you're still generating options or when you need a group decision from your agents.

| Skill | Use it when | Voice |
| --- | --- | --- |
| `bmad-forge-idea` | You have an idea and want it stress-tested or killed | An interrogator plus a two-person room |
| `bmad-prfaq` | You've committed to a product and want it proven customer-first | A Working Backwards coach |
| `bmad-brainstorming` | You have no idea yet and need to generate options | A facilitation coach |
| `bmad-party-mode` | You want your agents to discuss or decide together | Your whole roster in one conversation |
| `bmad-review` | You have an artifact and need its flaws found | A multi-lens reviewer hunting real issues |

## Example

:::note[Example]
**You:** "I want AI-generated weekly summaries in the app. Users get a digest email every Monday."

**Forge:** "Before the feature, who asked for this? My recommended answer is nobody did, and you're reasoning from 'AI summaries sound valuable.' Push back if there's a real signal."

**Skeptical CFO (conjured):** "And a Monday digest is a recurring inference cost across your whole active base, forever. What revenue line pays for it?"

**You:** "Retention, I guess. People forget to come back."

**Forge:** "Then the load-bearing claim is 'a Monday email brings lapsing users back,' not 'AI summaries are valuable.' Those are different ideas. Which one are we forging?"
:::

The first idea was a feature. Two questions in, the real idea is a retention bet you could test with a plain email and no model at all.


<!-- source: docs/explanation/named-agents.md -->

---
title: "Named Agents"
description: Why BMad agents have names, personas, and customization surfaces — and what that unlocks compared to menu-driven or prompt-driven alternatives
sidebar:
  order: 1
---

You say "Hey Mary, let's brainstorm," and Mary activates. She greets you by name, in the language you configured, with her distinctive persona. She reminds you that `bmad-help` is always available. Then she skips the menu entirely and drops straight into brainstorming — because your intent was clear.

This page explains what's actually happening and why BMad is designed this way.

## The Three-Legged Stool

BMad's agent model rests on three primitives that compose:

| Primitive | What it provides | Where it lives |
|---|---|---|
| **Skill** | Capability — a discrete thing the assistant can do (brainstorm, draft a PRD, implement a story) | `.claude/skills/{skill-name}/SKILL.md` (or your IDE's equivalent) |
| **Named agent** | Persona continuity — a recognizable identity that wraps a menu of related skills with consistent voice, principles, and visual cues | Skills whose directory starts with `bmad-agent-*` |
| **Customization** | Makes it yours — overrides that reshape an agent's behavior, add MCP integrations, swap templates, layer in org conventions | `_bmad/custom/{skill-name}.toml` (committed team overrides) and `.user.toml` (personal, gitignored) |

Pull any leg away and the experience collapses:

- Skills without agents → capability lists the user has to navigate by name or code
- Agents without skills → personas with nothing to do
- No customization → every user gets the same out-of-box behavior, forcing forks for any org-specific need

## What Named Agents Buy You

BMad ships five named agents, each anchored to a phase of the BMad Method:

| Agent | Phase | Module |
|---|---|---|
| 📊 **Mary**, Business Analyst | Analysis | market research, brainstorming, product briefs, PRFAQs |
| 📋 **John**, Product Manager | Planning | PRD creation, epic/story breakdown, implementation readiness |
| 🎨 **Sally**, UX Designer | Planning | UX design specifications |
| 🏗️ **Winston**, System Architect | Solutioning | technical architecture, alignment checks |
| 💻 **Amelia**, Senior Engineer | Implementation | story execution, build, code review, sprint planning |

:::note[Where is Paige?]
📚 **Paige**, the Technical Writer, is on hiatus — she will return in the future far more capable. Project documentation is still covered: invoke `bmad-document-project` directly or through Mary's menu.
:::

They each have a hardcoded identity (name, title, domain) and a customizable layer (role, principles, communication style, icon, menu). You can rewrite Mary's principles or add menu items; you can't rename her — that's deliberate. Brand recognition survives customization so "hey Mary" always activates the analyst, regardless of how a team has shaped her behavior.
