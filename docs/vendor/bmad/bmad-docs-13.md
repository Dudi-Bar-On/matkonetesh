---
name: bmad-docs-13
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 13/30 (raw.githubusercontent.com)"
type: reference
---

## Parties you could build

A party is only personas and a scene, so the range is wide, and none of it needs a new skill or module:

- A founder squad to stress-test a startup idea.
- A compliance team to find the holes before an audit does.
- The authors of the Agile Manifesto, debating a software concept.
- A room of comedians as a writing-partner group.
- Great minds of the past, to work through a question in philosophy or untangle a hard problem.
- A business management team to plan the quarter.

These are starting points. Any set of voices you can describe becomes a party: write the personas, give the room a scene, and you have it.

## The Code Review Crew

Your default party is the agents your installed modules provide. The Code Review Crew is a custom party BMad ships alongside that default — a working template to study before you build your own, not a replacement for it. It's a review panel: five lenses that attack a change from different angles and argue about what actually matters, instead of rubber-stamping it.

| Member | Lens |
| --- | --- |
| Vex | Security — threat-models everything and names the concrete exploit path. |
| Grumbal | The adversary — assumes the code is broken and sets out to prove it. |
| Boundary | Edge cases — every branch, null, race, oversized input, odd timezone. |
| Yui | The craftsman — simplicity, naming, no needless cleverness or duplication. |
| Dana | The pragmatist — counters the perfectionists and ranks what's real versus a nit. |

The crew ships defined but inactive. The members sit in the pool and cost nothing until you summon the group, and they never crowd your default room. Run it with `subagent` mode so each lens reviews on its own before the five clash over the findings.

## The Anti-Consensus Club

The Anti-Consensus Club helps with decisions, strategy, designs, and fuzzy questions where one assistant might agree too quickly or keep debating after the useful work is done. It is not a voting body. Its job is to raise useful objections, check claims, stop repetition, and return the decision to the human.

| Member | Lens |
| --- | --- |
| Wildcard | Option generator — suggests alternative problem statements, assumptions, and examples. |
| Level | Claim checker — checks support, missing information, and confidence. |
| Killjoy | Loop stopper — stops repetition, fake disagreement, and unsupported speculation. |
| Splinter | Consensus challenger — questions easy agreement and ignored tradeoffs. |

Run it as `/bmad-party-mode --party anti-consensus-club --mode subagent` when the platform supports it. The room recommends that at session start, then stops nagging if you continue in another mode.

## Steering the conversation

You drive the room the whole way:

- Bring someone in: "Bring in the UX designer."
- Go deep on one voice: "Winston, take that apart." A direct ask is the cue for one persona to stretch out.
- Switch rooms mid-session: "Switch to the writers' room" swaps the active group and carries the thread over.
- Summon anyone by name, even a custom member who isn't in the current room.

Whichever mode is running, the orchestrator presents the result as one conversation rather than a stack of separate answers, and it keeps the personas in character — it won't break the fourth wall to narrate the mechanism.

:::tip[Mix more than one room]
You aren't limited to a single group. Pull members from several parties into the same conversation, or name a cast on the spot, and let them mix. Picture the Golden Girls thrown into an architecture review with Martin Fowler and Linus Torvalds, sparring over a change request: you can imagine how that goes.
:::

## The room remembers

Give a party a memory and it picks up where you left off. It keeps its own record of your past sessions — the dynamics that built up between members, the threads you left open, and where earlier conversations landed. Reopen it a week later and that history is intact: two members who came to blows last time still open a little frosty, and a sharp line from a past session can resurface as an organic callback.

It's memory, not a transcript. The room carries the few things worth remembering, not a log of everything said, so the next conversation feels continuous without dragging the whole past into it. It happens on its own, in the background — nothing to save, and the room never breaks character to announce it.

A character who turns up on the fly is remembered too — a walk-on from an open-cast scene, or someone you add mid-conversation. At the end of a session the room offers to keep the new arrivals, folding them into the party so they can come back next time.

Memory is set per party. When you create or save a party you're asked whether it should remember; the default installed-agent room remembers unless you turn it off. Set or change any of this through `/bmad-customize bmad-party-mode`.

## A keepsake of the session

When you wrap up, the orchestrator offers a keepsake: a single self-contained HTML document of the session to keep or share. It lays the conversation out by persona rather than dumping a raw transcript. Decline it and the party simply ends.

:::tip[Better decisions]
The value of a party is the disagreement. Diverse perspectives in one room catch what a single line of thinking misses.
:::


<!-- source: docs/explanation/preventing-agent-conflicts.md -->

---
title: "Preventing Agent Conflicts"
description: How architecture prevents conflicts when multiple agents implement a system
sidebar:
  order: 6
---

When multiple AI agents implement different parts of a system, they can make conflicting technical decisions. Architecture documentation prevents this by establishing shared standards.

## Common Conflict Types

### API Style Conflicts

Without architecture:
- Agent A uses REST with `/users/{id}`
- Agent B uses GraphQL mutations
- Result: Inconsistent API patterns, confused consumers

With architecture:
- ADR specifies: "Use GraphQL for all client-server communication"
- All agents follow the same pattern

### Database Design Conflicts

Without architecture:
- Agent A uses snake_case column names
- Agent B uses camelCase column names
- Result: Inconsistent schema, confusing queries

With architecture:
- Standards document specifies naming conventions
- All agents follow the same patterns

### State Management Conflicts

Without architecture:
- Agent A uses Redux for global state
- Agent B uses React Context
- Result: Multiple state management approaches, complexity

With architecture:
- ADR specifies state management approach
- All agents implement consistently

## How Architecture Prevents Conflicts

### 1. Explicit Decisions via ADRs

Every significant technology choice is documented with:
- Context (why this decision matters)
- Options considered (what alternatives exist)
- Decision (what we chose)
- Rationale (why we chose it)
- Consequences (trade-offs accepted)

### 2. FR/NFR-Specific Guidance

Architecture maps each functional requirement to technical approach:
- FR-001: User Management → GraphQL mutations
- FR-002: Mobile App → Optimized queries

### 3. Standards and Conventions

Explicit documentation of:
- Directory structure
- Naming conventions
- Code organization
- Testing patterns
