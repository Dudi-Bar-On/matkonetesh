---
name: bmad-docs-04
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 04/30 (raw.githubusercontent.com)"
type: reference
---

### Definition Rules

| Do                            | Don't                                       |
| ----------------------------- | ------------------------------------------- |
| Start with what it IS or DOES | Start with "This is..." or "A [term] is..." |
| Keep to 1-2 sentences         | Write multi-paragraph explanations          |
| Bold term name in cell        | Use plain text for terms                    |

### Context Markers

Add italic context at definition start for limited-scope terms:

- `*Direct-entry implementation only.*`
- `*BMad Method/Enterprise.*`
- `*Phase N.*`
- `*BMGD.*`
- `*Established projects.*`

### Glossary Checklist

- [ ] Terms in tables, not individual headers
- [ ] Terms alphabetized within categories
- [ ] Definitions 1-2 sentences
- [ ] Context markers italicized
- [ ] Term names bolded in cells
- [ ] No "A [term] is..." definitions

## FAQ Sections

```md
## Questions

- [Do I always need architecture?](#do-i-always-need-architecture)
- [Can I change my plan later?](#can-i-change-my-plan-later)

### Do I always need architecture?

Only for work that benefits from architecture. Clear work can enter implementation directly.

### Can I change my plan later?

Yes. The `bmad-correct-course` workflow handles scope changes mid-implementation.

**Have a question not answered here?** [Open an issue](...) or ask in [Discord](...).
```

## Validation Commands

Before submitting documentation changes:

```bash
npm run docs:fix-links            # Preview link format fixes
npm run docs:fix-links -- --write # Apply fixes
npm run docs:validate-links       # Check links exist
npm run docs:build                # Verify no build errors
```


<!-- source: docs/explanation/advanced-elicitation.md -->

---
title: "Advanced Elicitation"
description: Push the LLM to rethink its work using structured reasoning methods
sidebar:
  order: 4
---

Make the LLM reconsider what it just generated. You pick a reasoning method, it applies that method to its own output, you decide whether to keep the improvements.

## What is Advanced Elicitation?

A structured second pass. Instead of asking the AI to "try again" or "make it better," you select a specific reasoning method and the AI re-examines its own output through that lens.

The difference matters. Vague requests produce vague revisions. A named method forces a particular angle of attack, surfacing insights that a generic retry would miss.

## When to Use It

- After a workflow generates content and you want alternatives
- When output seems okay but you suspect there's more depth
- To stress-test assumptions or find weaknesses
- For high-stakes content where rethinking helps

Workflows offer advanced elicitation at decision points - after the LLM has generated something, you'll be asked if you want to run it.

## How It Works

1. LLM suggests 5 relevant methods for your content
2. You pick one (or reshuffle for different options)
3. Method is applied, improvements shown
4. Accept or discard, repeat or continue

## Built-in Methods

Dozens of reasoning methods are available. A few examples:

- **Pre-mortem Analysis** - Assume the project already failed, work backward to find why
- **First Principles Thinking** - Strip away assumptions, rebuild from ground truth
- **Inversion** - Ask how to guarantee failure, then avoid those things
- **Red Team vs Blue Team** - Attack your own work, then defend it
- **Socratic Questioning** - Challenge every claim with "why?" and "how do you know?"
- **Constraint Removal** - Drop all constraints, see what changes, add them back selectively
- **Stakeholder Mapping** - Re-evaluate from each stakeholder's perspective
- **Analogical Reasoning** - Find parallels in other domains and apply their lessons

And many more. The AI picks the most relevant options for your content - you choose which to run.

:::tip[Start Here]
Pre-mortem Analysis is a good first pick for any spec or plan. It consistently finds gaps that a standard review misses.
:::


<!-- source: docs/explanation/adversarial-review.md -->

---
title: "Adversarial Review"
description: Forced reasoning technique that prevents lazy "looks good" reviews
sidebar:
  order: 9
---

Force deeper analysis by requiring problems to be found.

## What is Adversarial Review?

A review technique where the reviewer *must* find issues. No "looks good" allowed. The reviewer adopts a cynical stance - assume problems exist and find them.

This isn't about being negative. It's about forcing genuine analysis instead of a cursory glance that rubber-stamps whatever was submitted.

**The core rule:** You must find issues. Zero findings triggers a halt - re-analyze or explain why.

## Why It Works

Normal reviews suffer from confirmation bias. You skim the work, nothing jumps out, you approve it. The "find problems" mandate breaks this pattern:

- **Forces thoroughness** - Can't approve until you've looked hard enough to find issues
- **Catches missing things** - "What's not here?" becomes a natural question
- **Improves signal quality** - Findings are specific and actionable, not vague concerns
- **Information asymmetry** - Run reviews with fresh context (no access to original reasoning) so you evaluate the artifact, not the intent

## Where It's Used

Adversarial review appears throughout BMad workflows - code review, implementation readiness checks, spec validation, and others. Sometimes it's a required step, sometimes optional (like advanced elicitation or party mode). The pattern adapts to whatever artifact needs scrutiny.

## Human Filtering Required

Because the AI is *instructed* to find problems, it will find problems - even when they don't exist. Expect false positives: nitpicks dressed as issues, misunderstandings of intent, or outright hallucinated concerns.

**You decide what's real.** Review each finding, dismiss the noise, fix what matters.

## Example

Instead of:

> "The authentication implementation looks reasonable. Approved."

An adversarial review produces:

> 1. **HIGH** - `login.ts:47` - No rate limiting on failed attempts
> 2. **HIGH** - Session token stored in localStorage (XSS vulnerable)
> 3. **MEDIUM** - Password validation happens client-side only
> 4. **MEDIUM** - No audit logging for failed login attempts
> 5. **LOW** - Magic number `3600` should be `SESSION_TIMEOUT_SECONDS`

The first review might miss a security vulnerability. The second caught four.

## Iteration and Diminishing Returns

After addressing findings, consider running it again. A second pass usually catches more. A third isn't always useless either. But each pass takes time, and eventually you hit diminishing returns - just nitpicks and false findings.

:::tip[Better Reviews]
Assume problems exist. Look for what's missing, not just what's wrong.
:::


<!-- source: docs/explanation/analysis-phase.md -->

---
title: "Analysis Phase: From Idea to Foundation"
description: What brainstorming, research, product briefs, and PRFAQs are — and when to use each
sidebar:
  order: 2
---

The Analysis phase (Phase 1) helps you think clearly about your product before committing to building it. Every tool in this phase is optional, but skipping analysis entirely means your PRD is built on assumptions instead of insight.
