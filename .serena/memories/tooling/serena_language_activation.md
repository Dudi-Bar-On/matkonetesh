# matconetesh — Serena per-language activation recipe (this sandbox, 2026-07-24)

Context: this sandbox sits behind a TLS-inspecting proxy. Tools using the WINDOWS CERT STORE trust it
(npm, winget, choco, .NET/PowerShell's own HttpClient). Tools using a BUNDLED/vendored CA bundle do NOT
(Python's own `certifi`/urllib, Rust's `uv`/`uvx`, Taplo's own Rust HTTP client at runtime). This is the
one fact that explains every fix below — always try the system-cert-store tool first.

## python — pyright, via `ls_specific_settings.python.ls_base_cmd`
Serena's `PyrightServer._create_dependency_provider` unconditionally shells out to
`uvx -p 3.13 --from pyright==1.1.403 pyright-langserver --stdio` — fails here:
`error sending request for url (https://pypi.org/simple/pyright/): ... invalid peer certificate:
UnknownIssuer` (uv's own bundled CA store, `--system-certs` flag exists upstream but Serena's own
`_build_uvx_base_command` does not pass it — not something project.yml can inject either, since
`ls_args`/`ls_extra_args` only ever APPEND, they cannot be inserted before `--from`).
**Fix**: `npm install -g pyright` (npm trusts the system store here) → gives a real, complete
`pyright-langserver.js` (pyright's actual implementation is Node-based; the PyPI package is a thin
wrapper). Point Serena at it directly, bypassing uv/PyPI entirely, via `ls_base_cmd` (NOT `ls_path` —
the npm-installed `pyright-langserver.cmd` is a `.cmd` shim, and Windows can't `CreateProcess` a `.cmd`
directly without `shell=True`; Serena spawns without a shell, so `ls_base_cmd: [node.exe absolute path,
pyright-langserver.js absolute path]` is used instead — a genuine native `.exe` as the literal spawned
process, `--stdio` gets appended automatically by the Uvx dependency provider's `_extra_args`).

## bash — bash-language-server (npm, worked already) + ShellCheck (pre-provisioned binary)
`bash-language-server` itself installs fine via plain `npm install` (registry reachable). Its ShellCheck
v0.10.0 dependency is fetched as a raw GitHub-releases zip via Python's own `download_and_extract_archive_verified`
— fails: `SSLCertVerificationError: unable to get local issuer certificate`. There is no ls_path-style
override for this specific sub-dependency. **Fix**: `winget install koalaman.shellcheck` (got 0.11.0;
version doesn't matter — Serena's own check is only `if os.path.exists(binary_path): return`, no
version verification) → copy the resulting `shellcheck.exe` to the EXACT path Serena's
`bash_language_server.py` expects: `_shellcheck_binary_path()` =
`{ls_resources_dir}/BashLanguageServer/bash-lsp/shellcheck/shellcheck.exe` (Windows). Once present,
`_install_shellcheck_if_missing` short-circuits and never attempts its own download.

## toml — Taplo, via `shutil.which` (built-in) + explicit `ls_specific_settings.toml.ls_path` (belt-and-braces)
Taplo's OWN dependency provider already checks `shutil.which("taplo")` BEFORE attempting its own
GitHub-release download — genuinely the easiest of the five. **Fix**: `winget install tamasfe.taplo`
(0.10.0 — exactly Serena's own pinned version, though again version doesn't matter to the which-check).
Also set `ls_path` explicitly to the winget Links absolute path, since the live Serena PROCESS's PATH
is whatever it inherited at spawn time (winget's install broadcasts a PATH update that an
ALREADY-RUNNING parent process, e.g. Claude Code itself, will not see until it too restarts) —
`ls_path` sidesteps that uncertainty entirely.
**Caveat, not a failure**: even fixed, Taplo's own RUNNING PROCESS separately tries to fetch an online
JSON-schema catalog (`https://www.schemastore.org/api/json/catalog.json`) via ITS OWN bundled Rust TLS
stack at LSP-initialize time — this fails the same `invalid peer certificate: UnknownIssuer` way, logged
as ERROR/WARN, but is NON-FATAL: `Language server startup (language=toml) completed` regardless, and
`get_symbols_overview` on a real `.toml` file works correctly. Only the "validate against a known public
schema" convenience feature is degraded; core symbol/reference functionality is intact (verified).

## yaml / json / html — pure npm installs, needed NO fix at all
`yaml-language-server`, `vscode-json-languageserver`, `vscode-langservers-extracted` (html) are ALL
installed via plain `npm install` with no secondary binary/GitHub-release download — since npm already
works in this sandbox (proven by pyright's own npm step and by bash-language-server itself), these three
activated on the very first attempt with zero intervention. YAML's `_start_server` also configures an
online schemaStore URL in its `initializationOptions` but did NOT log a fetch error the way Taplo did —
worth a closer look only if a future yaml-schema-validation feature is reported broken; core symbol
navigation confirmed working regardless.

## powershell — PowerShell Editor Services (PSES) + PSScriptAnalyzer, both pre-provisioned manually
`PowerShellLanguageServer` is the ONE language class that does NOT go through the generic
`LanguageServerDependencyProvider*` framework at all (no `_create_dependency_provider` override) — so
there is no `ls_path`/`ls_base_cmd` override available for it, full stop. Three preconditions, checked/
fixed in order:
1. `pwsh` (PowerShell 7+) itself — already installed on this machine (`C:\Program Files\PowerShell\
   7-preview\pwsh.exe`), nothing to do.
2. PSES (the language server) — normally a direct GitHub-releases zip download
   (`PowerShellEditorServices.zip`) via Python's own downloader (same TLS failure class as ShellCheck).
   **Fix**: downloaded via PowerShell's OWN `Invoke-WebRequest` instead (confirmed empirically: HTTP 200
   — .NET's HttpClient trusts the system store here, unlike Python's), SHA256-verified BYTE-IDENTICAL
   to Serena's own pinned checksum (`690b91092989a0f66e6f43986166aaef69d64b559a9fda51feed882e1103fbcc`),
   extracted directly to the exact expected path:
   `{ls_resources_dir}/PowerShellLanguageServer/powershell/PowerShellEditorServices/Start-EditorServices.ps1`.
3. PSScriptAnalyzer (a PowerShell Gallery module PSES needs) — normally `pwsh -Command "Save-Module
   -Name PSScriptAnalyzer -RequiredVersion 1.25.0 ..."`, which ALSO uses .NET's TLS stack.
   **Confirmed working directly** (exit 0) — saved into
   `.../PowerShellEditorServices/PSScriptAnalyzer/1.25.0/`, the exact path
   `_setup_runtime_dependency` checks before deciding whether to invoke `Save-Module` itself.
Once both files exist at their exact expected paths, `_setup_runtime_dependency` finds everything
present and starts PSES with ZERO runtime network calls.

## The restart mechanics that made testing all of this possible without breaking typescript
See `mem:tooling/serena_usage` point 2 (fail-fast/all-or-nothing on a full restart) — the working
sequence used twice this session: fix N languages' underlying binaries/config → put ONLY the
known-good set in `languages:` (trim anything unverified) → tree-kill the current `serena.exe` process
from its root PID (`taskkill /PID <root> /T /F`, then verify port 24282 is freed and zero orphan PIDs
remain — the exact same "kill from the primary, verify zero orphans" discipline CLAUDE.md §11a already
mandates for `serve.js`) → make ANY Serena MCP tool call, which Claude Code auto-respawns transparently
(confirmed: the respawned process picks up ALL config changes fresh, since a brand-new `Project`/
`ProjectConfig` object is constructed from the on-disk YAML at that point) → poll
`GET /get_config_overview` until `"languages"` shows the expected full set → verify each language with
a REAL query (get_symbols_overview/find_symbol on an actual file of that type), not just trusting the
list.
