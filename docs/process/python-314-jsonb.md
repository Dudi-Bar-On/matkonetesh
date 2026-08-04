# Python 3.14.6 · the JSONB prerequisite (2026-08-04)

Owner requirement: the SQLite we adopt must support **JSONB**. This records how that was
established, what was installed, and what remains a decision.

## The constraint

`JSONB` landed in **SQLite 3.45.0** (Jan 2024). Measured on this machine before the upgrade:

| runtime | SQLite | JSONB |
|---|---|---|
| `node:sqlite` (Node 24, built in) | 3.53.1 | ✅ |
| `sqlite3` (Python 3.10.4 stdlib) | **3.37.2** | ❌ `no such function: jsonb` |

`build.py` is Python, so the content store (R-88) would have been cut off from JSONB regardless
of which runtime wrote the file.

## The evidence for upgrading

CPython pins a SQLite version per branch in `PCbuild/get_externals.bat`. Read from source:

| branch | pinned SQLite |
|---|---|
| 3.10 | 3.37.2 |
| 3.12 | 3.49.1.0 |
| **3.14** | **3.50.4.0** |
| main (3.15, pre) | 3.53.2.0 |

Latest stable at the time: **3.14.6, 10 June 2026** (python.org).

Risk assessed before installing, and it was near zero: **no dependency manifest exists** (no
`requirements.txt`, `pyproject.toml` or `setup.py`), and the 17 project `.py` files import only
stdlib — `collections, csv, hashlib, json, os, re, sys` — plus each other. Python 3.10 also
reaches EOL in **October 2026**, so the upgrade was due on its own.

## What was installed

Official python.org installer, **per-user, no elevation**. Authenticode verified before running:
`CN=Python Software Foundation`, status Valid.

```
python-3.14.6-amd64.exe /quiet InstallAllUsers=0 PrependPath=0 Include_test=0 \
    Include_launcher=0 InstallLauncherAllUsers=0 AssociateFiles=0 Shortcuts=0 Include_pip=1
```

**`Include_launcher=0` is load-bearing.** The first attempt used the default, which plans
`launcher_AllUsers` and makes the bundle *"Launch an elevated engine process"* — a UAC prompt
that is invisible to a non-interactive session, so the installer hangs at `Apply begin` forever
having written nothing. The `py` launcher already exists machine-wide from 3.10 and picks 3.14 up
through the core install's registry keys; the component is not needed.

Also load-bearing: **`curl` cannot download from python.org on this machine** —
`schannel: CRYPT_E_NO_REVOCATION_CHECK`. `node -e 'fetch(...)'` returned 200 and the full
30,774,112 bytes. Same tool-not-network shape as **L46**.

## Verified after install

```
python      : 3.14.6
sqlite      : 3.50.4        <- matches the get_externals.bat pin exactly
jsonb       : 7             <- json_extract(jsonb('{"a":{"b":7}}'),'$.a.b')
jsonb_valid : 1
jsonb type  : blob          <- a real binary representation, not text
py -0p      : 3.14-64 and 3.10-64, both listed
```

**`build.py` output is byte-identical between 3.10 and 3.14** — same sha256 and same length for
both `dist/index.html` (2,461,341 bytes) and `dist/items.json`. 10/10 phase-A tests green against
the 3.14-produced build, exit 0.

## Open decision — the default interpreter

Installed with `PrependPath=0`, so `python` on PATH is **still 3.10**. Nothing switched
underneath anyone. Two ways forward, and this is the owner's call:

1. **Pin the project.** Point `playwright.config`'s webServer command and any SQLite-touching
   script at `py -3.14`. Contained; the rest of the machine is untouched.
2. **Switch the machine default** by putting 3.14 ahead on PATH. Simpler day to day, but it
   changes every terminal the owner opens.

Recommendation: **(1) when step B starts**, since that is the first code that needs JSONB, and it
keeps the change inside the repo where it is reviewable. 3.10 stays installed either way.

---

## Consolidation to a single interpreter (2026-08-04, owner instruction)

> "תשאיר רק 3.14 תסיר את 3.10 ממילא רק 14 ב path"

**The premise was inverted, and saying so changed the order of work.** PATH held *only* 3.10 —
3.14 had been installed with `PrependPath=0` precisely so nothing switched underneath anyone.
Removing 3.10 first would have left the machine with no `python` at all: `build.py` and
Playwright's `webServer` both invoke it by bare name. So: swap PATH, verify, *then* remove.

### What was done, in order

1. **User PATH swapped** — `Python310\` and `Python310\Scripts\` out, `Python314\` and
   `Python314\Scripts\` in, prepended. Prior value backed up verbatim to
   `~\path-user-backup-2026-08-04.txt`.
2. **Verified in a fresh process** before deleting anything: `python` → 3.14.6, sqlite 3.50.4.
3. **Inspected the leftovers before deleting them** — 6,171 files survived the uninstaller, and
   `Lib\site-packages` turned out to hold real capability: `openpyxl` (the owner's spreadsheet),
   `pymupdf`/`fitz` and `pypdf` (the corpus PDF extraction), `pillow`, `numpy`, `html2text`,
   plus a stale copy of `graphify` and its tree-sitter grammars.
4. **Confirmed graphify and serena were not at risk.** Both run from `uv`-managed venvs on
   `AppData\Roaming\uv\python\cpython-3.13`, with `include-system-site-packages = false`. The
   3.10 copies were dead weight from an old `pip install`. `graphify global list` answered
   correctly throughout.
5. **Reinstalled the six real packages into 3.14** — openpyxl 3.1.5, pymupdf 1.28.0, pypdf
   6.14.2, pillow 12.3.0, numpy 2.5.1, html2text 2025.4.15 — and verified all six import.
6. **Removed `Python310\`**, then the stale `HKCU:\SOFTWARE\Python\PythonCore\3.10` key.
7. **Found a SECOND 3.10** the first pass missed: a Microsoft Store install,
   `PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0`. `py -3.10` still answered "alive" after
   step 6, which is what exposed it. Removed via `Remove-AppxPackage`.

### End state, verified

```
py -0p      : 3.14-64 only
python      : 3.14.6  |  sqlite 3.50.4  |  C:\...\Programs\Python\Python314\python.exe
packages    : openpyxl, pymupdf, pypdf, pillow, numpy, html2text — all import
python.org 3.10 : gone      Store 3.10 : gone
build.py    : exit 0, dist/index.html sha256 C8742C03CDAB2262 — IDENTICAL to the 3.10 build
tests       : 17/17 green (organ floor, cure rate, doneness, data-integrity), exit 0
```

The earlier open question about pinning the interpreter is now moot: there is only one.

### One operational note

A shell started **before** the PATH change still carries the old value, and with 3.10 deleted a
bare `python` there falls through to the WindowsApps stub — *"Python was not found; run without
arguments to install from the Microsoft Store"*. That is a stale-environment symptom, not a
broken install. **Any terminal opened after this change is fine.** Long-lived sessions should be
restarted.
