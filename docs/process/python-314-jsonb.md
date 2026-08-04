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
