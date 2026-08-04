---
name: bmad-docs-24
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 24/30 (raw.githubusercontent.com)"
type: reference
---

## Troubleshooting

**Override not taking effect?** Check that the file is under `_bmad/custom/` with the exact skill directory name (e.g. `bmad-agent-dev.toml`, not `bmad-dev.toml`). See [How to Customize BMad](./customize-bmad.md#troubleshooting).

**MCP tool name unknown?** Use the exact name the MCP server exposes in the current session. Ask Claude Code to list available MCP tools if unsure. Hardcoded names in `persistent_facts` or `on_complete` won't work if the MCP server isn't connected.

**Pattern doesn't apply to my setup?** The recipes above are illustrative. The underlying machinery (three-layer merge, structural rules, agent-spans-workflow) supports many more patterns; compose them as needed.


<!-- source: docs/how-to/get-answers-about-bmad.md -->

---
title: 'How to Get Answers About BMad'
description: Use an LLM to quickly answer your own BMad questions
sidebar:
  order: 5
---

Use BMad's built-in help, source docs, or the community to get answers — from quickest to most thorough.

## 1. Ask BMad-Help

The fastest way to get answers. The `bmad-help` skill is available directly in your AI session and handles over 80% of questions — it inspects your project, sees what you've completed, and tells you what to do next.

```
bmad-help I have a SaaS idea and know all the features. Where do I start?
bmad-help What are my options for UX design?
bmad-help I'm stuck on the PRD workflow
```

:::tip
You can also use `/bmad-help` or `$bmad-help` depending on your platform, but just `bmad-help` should work everywhere.
:::

## 2. Go Deeper with Source

BMad-Help draws on your installed configuration. For questions about BMad's internals, history, or architecture — or if you're researching BMad before installing — point your AI at the source directly.

Clone or open the [BMAD-METHOD repo](https://github.com/bmad-code-org/BMAD-METHOD) and ask your AI about it. Any agent-capable tool (Claude Code, Cursor, Windsurf, etc.) can read the source and answer questions directly.

:::note[Example]
**Q:** "Tell me the fastest way to build something with BMad"

**A:** Run `bmad-build`. Give it direct intent, an issue, a spec, or a planned story; it uses the available context and chooses the clarification, planning, implementation, and review depth needed.
:::

**Tips for better answers:**

- **Be specific** — "What does step 3 of the PRD workflow do?" beats "How does PRD work?"
- **Verify surprising claims** — LLMs occasionally get things wrong. Check the source file or ask on Discord.

### Not using an agent? Use the docs site

If your AI can't read local files (ChatGPT, Claude.ai, etc.), fetch [llms-full.txt](https://bmad-code-org.github.io/BMAD-METHOD/llms-full.txt) into your session — it's a single-file snapshot of the BMad documentation.

## 3. Ask Someone

If neither BMad-Help nor the source answered your question, you now have a much better question to ask.

| Channel                 | Use For                    |
| ----------------------- | -------------------------- |
| `help-requests` forum   | Questions                  |
| `#suggestions-feedback` | Ideas and feature requests |

**Discord:** [discord.gg/gk8jAdXWmj](https://discord.gg/gk8jAdXWmj)

**GitHub Issues:** [github.com/bmad-code-org/BMAD-METHOD/issues](https://github.com/bmad-code-org/BMAD-METHOD/issues)
_You!_
_Stuck_
_in the queue—_
_waiting_
_for who?_

_The source_
_is there,_
_plain to see!_

_Point_
_your machine._
_Set it free._

_It reads._
_It speaks._
_Ask away—_

_Why wait_
_for tomorrow_
_when you have_
_today?_

_—Claude_


<!-- source: docs/how-to/install-bmad.md -->

---
title: 'How to Install BMad'
description: Install, update, and pin BMad for local development, teams, and CI
sidebar:
  order: 1
---

Use `npx bmad-method install` to set up BMad in your project. One command handles first installs, upgrades, channel switching, and scripted CI runs. This page covers all of it.

## When to Use This

- Starting a new project with BMad
- Adding or removing modules on an existing install
- Switching a module to main-HEAD or pinning to a specific release
- Scripting installs for CI pipelines, Dockerfiles, or enterprise rollouts

:::note[Prerequisites]

- **Node.js** 20.12+ (the installer requires it)
- **Git** (for cloning external modules)
- **An AI tool** such as Claude Code or Cursor (run `npx bmad-method install --list-tools` to see all supported tools)

:::

## First-time install (the fast path)

```bash
npx bmad-method install
```

The interactive flow asks you five things:

1. Installation directory (defaults to the current working directory)
2. Which modules to install (checkboxes for core, bmm, bmb, cis, gds, tea)
3. **"Ready to install (all stable)?"** — Yes accepts the latest released tag for every external module
4. Which AI tools/IDEs to integrate with (claude-code, cursor, and others)
5. Per-module config (name, language, output folder)

Accept the defaults and you land on the latest stable release of every module, configured for your chosen tool.

:::tip[Just want the newest prerelease?]

```bash
npx bmad-method@next install
```

Runs the prerelease installer, which ships a newer snapshot of core and bmm. More churn, fewer delays between development and release.
:::

## Picking a specific version

Two independent axes control what ends up on disk.

### Axis 1: external module channels

Every external module — bmb, cis, gds, tea, and any community module — installs on one of three channels:

| Channel            | What gets installed                                                          | Who picks this                          |
| ------------------ | ---------------------------------------------------------------------------- | --------------------------------------- |
| `stable` (default) | Highest released semver tag. Prereleases like `v2.0.0-alpha.1` are excluded. | Most users                              |
| `next`             | Main branch HEAD at install time                                             | Contributors, early adopters            |
| `pinned`           | A specific tag you name                                                      | Enterprise installs, CI reproducibility |

Channels are per-module. You can run bmb on `next` while leaving cis on `stable` — the flags below let you mix freely.

### Axis 2: installer binary version

The `bmad-method` npm package itself has two dist-tags:

| Command                               | What you get                                                      |
| ------------------------------------- | ----------------------------------------------------------------- |
| `npx bmad-method install` (`@latest`) | Latest stable installer release                                   |
| `npx bmad-method@next install`        | Latest prerelease installer, auto-published on every push to main |

**The installer binary determines your core and bmm versions.** Those two modules ship bundled inside the installer package rather than being cloned from separate repos.
