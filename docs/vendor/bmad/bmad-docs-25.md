---
name: bmad-docs-25
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 25/30 (raw.githubusercontent.com)"
type: reference
---

### Why core and bmm don't have their own channel

They're stapled to the installer binary you ran:

- `npx bmad-method install` → latest stable core and bmm
- `npx bmad-method@next install` → prerelease core and bmm
- `node /path/to/local-checkout/tools/installer/bmad-cli.js install` → whatever your local checkout has

`--pin bmm=v6.3.0` and `--next=bmm` are silently ineffective against bundled modules, and the installer warns you when you try. A future release extracts bmm from the installer package; once that ships, bmm gets a proper channel selector like bmb has today.

## Updating an existing install

Running `npx bmad-method install` in a directory that already contains `_bmad/` gives you a menu:

| Choice             | What it does                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick Update**   | Re-runs the install with your existing settings. Refreshes files, applies patches and minor stable upgrades, refuses major upgrades. Fast, non-interactive. |
| **Modify Install** | Full interactive flow. Add or remove modules, reconfigure settings, optionally review and switch channels for existing modules.                             |

### Upgrade prompts

When Modify detects a newer stable tag for a module you've installed on `stable`, it classifies the diff and prompts accordingly:

| Upgrade type | Example         | Default |
| ------------ | --------------- | ------- |
| Patch        | v1.7.0 → v1.7.1 | Y       |
| Minor        | v1.7.0 → v1.8.0 | Y       |
| Major        | v1.7.0 → v2.0.0 | **N**   |

Major defaults to N because breaking changes frequently surface as "instability" when they weren't expected. The prompt includes a GitHub release-notes URL so you can read what changed before accepting.

Under `--yes`, patch and minor upgrades apply automatically. Majors stay frozen — pass `--pin <code>=<new-tag>` to accept non-interactively.

### Switching a module's channel

**Interactively:** choose Modify → answer **Yes** to "Review channel assignments?" → each external module offers Keep, Switch to stable, Switch to next, or Pin to a tag.

**Via flags:** the recipes in the next section cover the common cases.

## Headless CI installs

### Flag reference

| Flag                                                                                       | Purpose                                                                                                                           |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `--yes`, `-y`                                                                              | Skip all prompts; accept flag values + defaults                                                                                   |
| `--directory <path>`                                                                       | Install into this directory (default: current working dir)                                                                        |
| `--modules <a,b,c>`                                                                        | Exact module set. Core is auto-added. Not a delta — list everything you want kept.                                                |
| `--tools <a,b>`                                                                            | IDE/tool selection. Required for fresh `--yes` installs. Run `--list-tools` for valid IDs.                                        |
| `--list-tools`                                                                             | Print all supported tool/IDE IDs (with target directories) and exit.                                                              |
| `--action <type>`                                                                          | `install`, `update`, or `quick-update`. Defaults based on existing install state.                                                 |
| `--custom-source <urls>`                                                                   | Install custom modules from Git URLs or local paths                                                                               |
| `--channel <stable\|next>`                                                                 | Apply to all externals (aliased as `--all-stable` / `--all-next`)                                                                 |
| `--all-stable`                                                                             | Alias for `--channel=stable`                                                                                                      |
| `--all-next`                                                                               | Alias for `--channel=next`                                                                                                        |
| `--next=<code>`                                                                            | Put one module on next. Repeatable.                                                                                               |
| `--pin <code>=<tag>`                                                                       | Pin one module to a specific tag. Repeatable.                                                                                     |
| `--set <module>.<key>=<value>`                                                             | Set any module config option non-interactively (preferred — see [Module config overrides](#module-config-overrides)). Repeatable. |
| `--list-options [module]`                                                                  | Print every `--set` key for built-in and locally-cached official modules, then exit. Pass a module code to scope to one module.   |
| `--user-name`, `--communication-language`, `--document-output-language`, `--output-folder` | Legacy shortcuts equivalent to `--set core.<key>=<value>` (still supported)                                                       |

Precedence when flags overlap: `--pin` beats `--next=` beats `--channel` / `--all-*` beats the registry default (`stable`).

:::note[Example resolution]
`--all-next --pin cis=v0.2.0` puts bmb, gds, and tea on next while pinning cis to v0.2.0.
:::
