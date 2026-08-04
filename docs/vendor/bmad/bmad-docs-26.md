---
name: bmad-docs-26
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 26/30 (raw.githubusercontent.com)"
type: reference
---

### Recipes

**Default install — latest stable for everything:**

```bash
npx bmad-method install --yes --modules bmm,bmb,cis --tools claude-code
```

**Enterprise pin — reproducible byte-for-byte:**

```bash
npx bmad-method install --yes \
  --modules bmm,bmb,cis \
  --pin bmb=v1.7.0 --pin cis=v0.2.0 \
  --tools claude-code
```

**Bleeding edge — externals on main HEAD:**

```bash
npx bmad-method install --yes --modules bmm,bmb --all-next --tools claude-code
```

**Add a module to an existing install** (keep everything else):

```bash
npx bmad-method install --yes --action update \
  --modules bmm,bmb,gds
```

`--tools` is omitted intentionally — `--action update` reuses the tools configured during the first install.

**Mix channels — bmb on next, gds on stable:**

```bash
npx bmad-method install --yes --action update \
  --modules bmm,bmb,cis,gds \
  --next=bmb
```

### Module config overrides

`--set <module>.<key>=<value>` lets you set any module config option non-interactively. It's repeatable and scales to every module — present and future. The flag is applied as a post-install patch: the installer runs its normal flow first, then `--set` upserts each value into `_bmad/config.toml` (team scope) or `_bmad/config.user.toml` (user scope), and into `_bmad/<module>/config.yaml` so declared values carry forward to the next install.

**Example — install bmm with explicit project knowledge and skill level:**

```bash
npx bmad-method install --yes \
  --modules bmm \
  --tools claude-code \
  --set bmm.project_knowledge=research \
  --set bmm.user_skill_level=expert
```

**Discover available keys for a module:**

```bash
npx bmad-method install --list-options bmm
```

`--list-options` (no argument) lists every key the installer can find locally — built-in modules (`core`, `bmm`) plus any currently cached official modules. The cache is per-machine and can be cleared, so previously installed officials won't appear on a fresh checkout or an ephemeral CI worker until they're installed again. Community and custom modules aren't enumerated here; read the module's `module.yaml` directly to see what keys it declares.

**How it works:**

- **Routing.** The patch step looks for `[modules.<module>] <key>` (or `[core] <key>`) in `config.user.toml` first; if found there, it updates that file. Otherwise it writes to the team-scope `config.toml`. So user-scope keys (e.g. `core.user_name`, `bmm.user_skill_level`) end up in `config.user.toml` and team-scope keys end up in `config.toml`, matching the partition the installer uses.
- **Verbatim values.** The value is written exactly as you provided it — no `result:` template rendering. To get the rendered form (e.g. `{project-root}/research`), pass it explicitly: `--set bmm.project_knowledge='{project-root}/research'`.
- **Carry-forward, declared keys.** Values for keys declared in `module.yaml` survive subsequent installs because they're also written to `_bmad/<module>/config.yaml`, which the installer reads as the prompt default on the next run.
- **Carry-forward, undeclared keys.** A value for a key the module's schema doesn't declare lands in `config.toml` for the current install but won't be re-emitted on the next install (the manifest writer's schema-strict partition drops unknown keys). Re-pass `--set` if you need it sticky, or edit `_bmad/config.toml` directly.
- **No validation.** `single-select` values aren't checked against the allowed choices, and unknown keys aren't rejected — whatever you assert is written.
- **Modules not in `--modules`.** Setting a value for a module you didn't include prints a warning and the value is dropped (no file gets created for an uninstalled module).

The legacy core shortcuts (`--user-name`, `--output-folder`, etc.) still work and remain documented for backward compatibility, but `--set core.user_name=...` is equivalent.

:::note[Works with quick-update]
`--set` is a post-install patch, so it applies the same way regardless of action type. Under `bmad install --action quick-update` (or `--yes` against an existing install, where quick-update is the default), `--set` patches the central config files at the end just like a regular install.
:::

:::caution[Rate limit on shared IPs]
Anonymous GitHub API calls are capped at 60/hour per IP. A single install hits the API once per external module to resolve the stable tag. Offices behind NAT, CI runner pools, and VPNs can collectively exhaust this.

Set `GITHUB_TOKEN=<personal access token>` in the environment to raise the limit to 5000/hour per account. Any public-repo-read PAT works; no scopes are required.
:::

## What got installed

After any install, `_bmad/_config/manifest.yaml` records exactly what's on disk:

```yaml
modules:
  - name: bmb
    version: v1.7.0 # the tag, or "main" for next
    channel: stable # stable | next | pinned
    sha: 86033fc9aeae2ca6d52c7cdb675c1f4bf17fc1c1
    source: external
    repoUrl: https://github.com/bmad-code-org/bmad-builder
```

The `sha` field is written for git-backed modules (external, community, and URL-based custom). Bundled modules (core, bmm) and local-path custom modules don't have one — their code travels with the installer binary or your filesystem, not a cloneable ref.

For cross-machine reproducibility, don't rely on rerunning the same `--modules` command. Stable-channel installs resolve to the highest released tag **at install time**, so a later rerun lands on whatever has been released since. Convert the recorded tags from `manifest.yaml` into explicit `--pin` flags on the target machine, e.g.:

```bash
npx bmad-method install --yes --modules bmb,cis \
  --pin bmb=v1.7.0 --pin cis=v0.4.2 --tools claude-code
```

## Troubleshooting

### "Could not resolve stable tag" or "API rate limit exceeded"

You've hit GitHub's 60/hr anonymous limit. Set `GITHUB_TOKEN` and retry. If you already have a token set, it may be expired or rate-limited on its own budget — try a different token or wait for the hourly reset.

### "Tag 'vX.Y.Z' not found"

The tag you passed to `--pin` doesn't exist in the module's repo. Check the repo's releases page on GitHub for valid tags.

### A pinned install keeps upgrading

Pinned installs don't upgrade. Quick-update applies patches and minors on stable channel only; it won't touch `pinned` or `next`. If a pinned install changed, open `_bmad/_config/manifest.yaml` — `channel: pinned` plus a fixed `version` and `sha` should hold across runs unless you explicitly override via flags.

### `--pin bmm=X` didn't do anything

bmm is a bundled module — `--pin` and `--next=` don't apply. Use `npx bmad-method@next install` for a prerelease core/bmm, or check out the bmad-bmm repo and run the installer locally to get unreleased changes.


<!-- source: docs/how-to/install-custom-modules.md -->

---
title: 'Install Custom and Community Modules'
description: Install third-party modules from the community registry, Git repositories, or local paths
sidebar:
  order: 3
---

Use the BMad installer to add modules from the community registry, third-party Git repositories, or local file paths.
