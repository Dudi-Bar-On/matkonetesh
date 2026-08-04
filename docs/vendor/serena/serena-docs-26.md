---
name: serena-docs-26
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 26/26 (docs)"
type: reference
---

#### TypeScript via `vtsls`

The actual configuration key for vtsls is `typescript_vts`, not `vts`.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `vtsls_version` | `0.2.9` | Override the `@vtsls/language-server` npm package version Serena installs. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |
| `initialization_options` | `null` | Dict forwarded to vtsls on three LSP channels: the `initializationOptions` field of the `initialize` request, a `workspace/didChangeConfiguration` notification sent right after initialize, and as the response to `workspace/configuration` pull requests (section-scoped). Typical use is Yarn PnP: point `typescript.tsdk` at the Yarn-generated SDK and enable `vtsls.autoUseWorkspaceTsdk`. |

Example (Yarn PnP project with TypeScript in a subdirectory; run `yarn dlx @yarnpkg/sdks vscode` in the project once to generate the SDK):

```yaml
ls_specific_settings:
  typescript_vts:
    initialization_options:
      typescript:
        tsdk: "project/.yarn/sdks/typescript/lib"
      vtsls:
        autoUseWorkspaceTsdk: true
```

vtsls reads `typescript.tsdk` through the `workspace/configuration` pull, not through `initializationOptions`, so Serena answers those pulls from the same dict (and also pushes it on `workspace/didChangeConfiguration` for compatibility with servers that expect the notification). Without `autoUseWorkspaceTsdk: true`, vtsls falls back to its bundled TypeScript and ignores `tsdk` (there is no UI prompt to confirm the switch in a headless LSP).

The dict is forwarded to vtsls verbatim — Serena does not validate its structure. For the list of supported keys and their expected types, refer to the vtsls [configuration schema](https://github.com/yioneko/vtsls/blob/main/packages/service/configuration.schema.json) and the underlying [VS Code TypeScript settings](https://code.visualstudio.com/docs/languages/typescript). `null` (the default) and `{}` are both treated as "unset": no `initializationOptions` are sent and no `workspace/didChangeConfiguration` notification is pushed. A non-dict value (e.g. a string or list) raises an error at server start.

**Troubleshooting:**

- *vtsls keeps using its bundled TypeScript and ignores `tsdk`* — ensure `vtsls.autoUseWorkspaceTsdk: true` is set alongside `typescript.tsdk`. Without it vtsls does not auto-switch to the workspace TS in a headless LSP.
- *tsserver fails to start after pointing at a custom `tsdk`* — verify the path resolves to a directory containing `tsserver.js` (e.g. `.yarn/sdks/typescript/lib`, not `.yarn/sdks/typescript`). Relative paths are interpreted relative to the project root.
- *Setting appears in `solidlsp` logs but vtsls does not react* — cross-check the key against the vtsls configuration schema linked above. The dict is forwarded as-is, so an unknown or wrong-typed key is silently ignored by vtsls.
- *Need to inspect what Serena is actually forwarding* — the dict is logged at INFO level via the `Forwarding user-provided initializationOptions to vtsls: …` line at language server startup.

#### Vue

Serena uses `@vue/language-server` (Volar) for the `vue` language key, together with a companion TypeScript language server.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `vue_language_server_version` | `3.1.5` | Override the bundled `@vue/language-server` npm package version Serena installs. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. If unset on `vue`, Serena falls back to `ls_specific_settings.typescript.npm_registry`. |

Notes:
- `typescript_version` and `typescript_language_server_version` are read from `ls_specific_settings.typescript`, not from `ls_specific_settings.vue`.

#### YAML

Serena uses `yaml-language-server` for the `yaml` language key.

Supported settings:

| Setting | Default | Description |
|---|---|---|
| `ls_path` | managed install | Override the `yaml-language-server` executable path. |
| `yaml_language_server_version` | `1.19.2` | Override the npm package version Serena installs when `ls_path` is not set. |
| `npm_registry` | `null` | Override the npm registry Serena uses for the managed install. |

### Custom Prompts

All of Serena's prompts can be fully customized.
We define prompt as jinja templates in yaml files, and you can inspect our default prompts [here](https://github.com/oraios/serena/tree/main/src/serena/resources/config/prompt_templates).

To override a prompt, simply add a .yml file to the `prompt_templates` folder in your Serena data directory
which defines the prompt with the same name as the default prompt you want to override.
For example, to override the `system_prompt`, you could create a file `~/.serena/prompt_templates/system_prompt.yml` (assuming default Serena data folder location) 
with content like:

```yaml
prompts:
  system_prompt: |
    Whatever you want ...
```

It is advisable to use the default prompt as a starting point and modify it to suit your needs.

### Usage Reporting

On startup, Serena reports anonymous usage data to help us understand Serena usage.
Specifically, we collect the Serena version, the operating system & language backend being used as well as the dashboard enabled status.
No personally identifiable information or project-specific information is collected.

If you want to opt out of usage reporting, set the environment variable `SERENA_USAGE_REPORTING` to `false`.
