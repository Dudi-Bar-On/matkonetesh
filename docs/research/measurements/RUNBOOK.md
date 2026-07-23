# CPU-max program — measurement RUNBOOK

**Status of this document:** the instruments are BUILT and smoke-tested (throwaway numbers, seconds-scale
runs). **No real measurement has been taken yet.** This runbook is what the controller follows to take
the real, trustworthy measurements on an idle machine. It assumes zero prior context — read it cold.

**Source specs** (read these FIRST for the *why*; this runbook only covers the *how* and the *order*):
- `docs/research/warm-page-architecture-research.md` — §"Measurement plan (W0 — decides everything)"
- `docs/research/hybrid-cpu-scheduling-research.md` — §9 "Measurement plan"

**The instruments:**
| Script | What it measures | Touches |
|---|---|---|
| `scripts/w0-warm-page-measure.mjs` | cold `page.goto` vs warm `page.reload()` timing, 200 vs 304 server modes | its OWN server on **:8124** — never :8123, never serve.js |
| `scripts/m-cpu-sampler.ps1` | per-logical-processor P-class vs E-class CPU utilization + process census | read-only OS counters/process list — nothing under test |
| `scripts/m2-pinned-spec.ps1` | E-core vs P-core wall time for one spec, affinity-pinned | spawns a normal `npx playwright test <spec>` (own :8123 lifecycle) |

None of the three scripts modify `serve.js`, `playwright.config.ts`, or any test file. `M1` below uses a
**command-line** `--workers=10` override (not a config edit) — this is the same technique the config's own
history comment already used to establish the current `workers: 8` setting.

---

## 0 — Preconditions for the WHOLE session (check every time, not just once)

These come straight from CLAUDE.md §11a and its L18/L20 lessons — a measurement taken while any of these
is violated is not trustworthy, however clean the numbers look.

1. **Machine otherwise idle.** Pause other CPU-heavy background agents/subagents for the duration of this
   whole runbook, not just for individual suite runs — §11a: "a single run at the measured ceiling still
   flakes ... if other heavy subagents/processes run at the same time."
2. **No manual `serve.js` running on 8123.** Check: `Get-NetTCPConnection -LocalPort 8123 -State Listen
   -ErrorAction SilentlyContinue` (or just try step 2/3 below — `m2-pinned-spec.ps1` refuses outright if
   8123 is busy, and Playwright's own managed `webServer` will error the same way since
   `reuseExistingServer:false`).
3. **Port 8124 free** (W0's own server). Nothing in this repo normally binds it, but check if a previous
   W0 run was killed uncleanly: `Get-NetTCPConnection -LocalPort 8124 -State Listen -ErrorAction
   SilentlyContinue`.
4. **`dist/index.html` exists and is fresh.** If in doubt, `python build.py` once before starting. W0
   fails loudly (exits 1) if `dist/index.html` is missing entirely, but it cannot tell "missing" from
   "stale" — rebuild if the app changed since the last build.
5. **Run steps SERIALIZED, start to finish, never two of them at once.** W0, M0, M1, and M2 are each their
   own CPU-timing experiment; running any two concurrently contaminates both (this is the exact failure
   mode §11a was written to close — 12-then-127 phantom failures from two racing suite runs). **Let each
   step's process/run COMPLETE before starting the next — never kill one mid-flight** (§11a
   setup⟺teardown; a killed `serve.js`-adjacent process can leave a respawning zombie that wedges 8123 for
   every later step).
6. **The suite runs inside M0/M1 are executed by the controller AT THAT TIME, not pre-run or cached.**
   Nothing about this runbook is satisfied by a suite run from earlier in the session — the sampler must
   be wrapped around a run that happens *while it is sampling*.

---

## Step 1 — W0: warm-page timing (cold goto vs warm reload)

**Preconditions:** §0 items 3–4 (port 8124 free, `dist/` fresh). Independent of 8123/the suite — safe to
run even if you're unsure about serve.js state elsewhere, since W0 never touches 8123.

**Command (full plan, one shot — recommended):**
```powershell
node scripts/w0-warm-page-measure.mjs
```
This runs all three arms (`cold`, `warm-ephemeral`, `warm-persistent`) under both server modes (`200`,
`304`) with the doc's own defaults (cold ×30, warm ×60 reloads each, CDP trace on the cold arm's first 3
iterations, JS-heap sample every 10 warm reloads). Takes a few minutes — it is doing ~30 + 4×60 = 270
real browser navigations.

**Narrower re-runs** (e.g. to isolate one arm after reading the full result):
```powershell
node scripts/w0-warm-page-measure.mjs --arms warm-ephemeral --mode 304 --warm-count 60
node scripts/w0-warm-page-measure.mjs --arms warm-persistent --mode 304 --warm-count 60
node scripts/w0-warm-page-measure.mjs --help   # full flag reference
```

**Where it lands:** `docs/research/measurements/w0-<UTC-timestamp>.json` (gitignored — read it locally;
promote the *conclusion*, not the raw file, into a tracked doc if a decision follows from it) plus a
human-readable summary + GO/NO-GO verdict printed to stdout.

**What to look for (from the research doc's own gate, §Measurement plan item 5):**
- **GO** if `warm-ephemeral@304` p50 ≤ **60%** of `cold` p50 (the JSON's `gate.result` field says this
  directly — do not hand-recompute it).
- **Escalate to Option B** (`warm-persistent`) only if it beats Option A (`warm-ephemeral@304`) by a
  further ≥ **15%** (`gate.escalateToB`).
- Below the 60% gate → write the numbers down, stop, and report the architecture as measured-out
  (execution-dominated init) — per the doc, this is a valid, useful answer, not a failed run.
- Also sanity-check `selfVerification.ok` in the JSON — if `false`, the run's numbers are explicitly
  self-flagged as untrustworthy (e.g. the 304 mechanism never actually round-tripped); re-run before
  trusting anything.

**Known, already-diagnosed quirk (not a bug in the instrument):** during smoke-testing, individual warm
reloads under `--mode 304` did NOT all get an HTTP 304 for the main document — some reloads round-tripped
a full 200 even though the ETag was unchanged and a raw HTTP conditional-GET test (bypassing the browser)
confirmed the server's ETag/If-None-Match logic is 100% deterministic in isolation. This means **Chrome's
own decision to send a conditional request on a given reload is inconsistent for this 2.7 MB resource**,
not a defect in `scripts/w0-warm-page-measure.mjs`. Expect to see a mix of 200-sized and 304-sized
`transferSize` values within a single `warm-*@304` arm's raw per-iteration `results` array — this is real
signal, worth its own line in whatever conclusion doc follows, not something to "fix" in the harness.

---

## Step 2 — M0: CPU sampler around a NORMAL 8-worker suite run (baseline)

**Preconditions:** §0 items 2, 5 (8123 free, nothing else running). This is the **first time in this
runbook the real suite runs** — it must be a genuine `npx playwright test` happening live under the
sampler, not a past run.

**Start the sampler in the background, THEN immediately start the suite in the foreground of the same
session** (sized to comfortably outlast the suite's measured ~2.3–2.5 min — see `playwright.config.ts`'s
own comment):
```powershell
$sampler = Start-Process pwsh -ArgumentList '-File','scripts\m-cpu-sampler.ps1','-DurationSeconds','400','-Label','m0-baseline-8w' -NoNewWindow -PassThru

npx playwright test

if (-not $sampler.HasExited) { Stop-Process -Id $sampler.Id }   # stop early once the suite is done — no need to wait out the full 400s window
```

**Optional but recommended — a mid-run process census** (in a *third*, separate PowerShell invocation,
run once while the suite from above is still mid-flight, e.g. ~30–60s after starting it):
```powershell
pwsh scripts\m-cpu-sampler.ps1 -DurationSeconds 0 -Census -Label m0-census-midrun
```
This is the scriptable equivalent of Task Manager's Details tab "Power throttling" column, plus a
priority/affinity spot-check on every `node`/`chrome`/`chrome-headless-shell` process — it can only see
something meaningful while those processes exist, i.e. while the suite is actually running.

**Where it lands:** `docs/research/measurements/cpu-sampler-m0-baseline-8w-<timestamp>.csv` (raw, one row
per LP per counter per second) + `...summary.json` (P-class vs E-class mean/median/max, both `%
Processor Time` and `% Processor Utility`) + `census-m0-census-midrun-<timestamp>.csv` if you ran the
census step.

**What to look for** (research doc §9 M0 prediction, to confirm or refute with data): P-threads (LP 0-15)
should read close to saturated during the init-heavy early part of the run; E-cores (LP 16-31) should
average **under ~40%**. The suite itself should be **433 passed, clean** (this is a normal run — anything
short of clean here is a real regression, handled via `systematic-debugging` like any other failing suite
run, NOT part of this research).

---

## Step 3 — M1: same sampler, around a `--workers=10` run (reproduce the known failure, instrumented)

**Preconditions:** same as Step 2. Run this **after** Step 2 completes and its processes have fully torn
down (§0 item 5) — never overlapping.

**`--workers=10` is a command-line override, not a config edit** — `playwright.config.ts` is not touched.
This mirrors exactly how the current `workers: 8` setting was originally established (see the config's own
comment history).

```powershell
$sampler = Start-Process pwsh -ArgumentList '-File','scripts\m-cpu-sampler.ps1','-DurationSeconds','400','-Label','m1-10-workers' -NoNewWindow -PassThru

npx playwright test --workers=10

if (-not $sampler.HasExited) { Stop-Process -Id $sampler.Id }
```

**This run is EXPECTED to fail ~10 tests, always the same specs** (per §11a's own prior measurement:
"10 workers -> 10 FAILED (P-core oversubscription)"). **That is the point of M1** — it is a diagnostic
reproduction, not a DoD-covered production run. Do not "fix" it, do not re-run it hoping for green, and do
not treat the failures as a new bug — the entire purpose is to have the CPU sampler's timeline covering
the moment those specific specs starve.

**Where it lands:** same shape as Step 2, labelled `m1-10-workers`.

**What to look for** (research doc §9 M1 prediction — this is the experiment that turns §2.4's hypothesis
into fact): during the failing window, P-threads should read pegged while E-cores retain headroom, and the
failing specs' renderer processes should show **no** power-throttling in a mid-run `-Census` snapshot (take
one the same way as Step 2, labelled e.g. `m1-census-midrun`). **If instead E-cores are pegged and
P-threads show idle gaps, the diagnosis flips** — write that down plainly, it changes which intervention
in the research doc's ranked list (§8) moves up.

---

## Step 4 — M2: pinned-spec E/P calibration

**Preconditions:** §0 items 2, 5 (8123 free — `m2-pinned-spec.ps1` checks this itself and refuses to run
if busy; nothing else running).

Pick one of the heaviest-init specs already named by §11a's own prior measurement — both exist in this
repo:
```powershell
pwsh scripts\m2-pinned-spec.ps1 -SpecPath tests\active-hub.spec.ts -Mask P
pwsh scripts\m2-pinned-spec.ps1 -SpecPath tests\adaptive-home.spec.ts -Mask P   # optional second spec for cross-check
```
Then, **after the P run fully completes**, the E run:
```powershell
pwsh scripts\m2-pinned-spec.ps1 -SpecPath tests\active-hub.spec.ts -Mask E
```

Each invocation runs a completely normal, unpinned-in-every-other-respect `npx playwright test <spec>` —
same `webServer` (`python build.py && node serve.js 8123`), same config — with only the OS-level affinity
of the whole process tree pinned before it starts executing (P = `0xFFFF`, the 16 P-threads; E =
`0xFFFF0000`, the 16 E-cores — this machine's topology, verified in the hybrid research doc §1.1).

**Where it lands:** `docs/research/measurements/m2-P-<timestamp>.json` and `m2-E-<timestamp>.json`, each
with `wallTimeSeconds`, `exitCode`, and `affinityApplied` (self-verified — the script hard-fails if the
pin didn't actually take).

**Compute the ratio:** `E wallTimeSeconds / P wallTimeSeconds`. This is the real number the research doc's
§5.2 light-class timeout (currently a 45s *guess*) should be sized from — the doc's own prediction is
roughly **1.5–2.0×** based on clock/IPC differences, but the whole point of M2 is to stop guessing.

**Sanity check before trusting the ratio:** `pwsh scripts\m2-pinned-spec.ps1 -SelfTest` proves the
underlying `CreateProcess(SUSPENDED) → SetProcessAffinityMask → ResumeThread` pinning mechanism itself is
correct (a nested process reports back its own observed affinity mask, compared byte-for-byte against what
was requested) — cheap (well under a second) and worth re-running once if the P vs E numbers ever come
back suspiciously close to each other.

---

## After M0/M1/M2 — what NOT to do yet

The hybrid-CPU research doc's own order is **M0 → M1 → M2 → M3 → M4**, each gated on the previous verdict.
**M3 (the split-worker-classes config) is a real change to `playwright.config.ts`** — sizing it from this
runbook's data is a *design* decision, not a mechanical next step, and per CLAUDE.md's pipeline that means
brainstorming → an approved spec → a plan, same as any other feature change. This runbook's job stops at
producing the M0/M1/M2 numbers; turning them into a config change is the next task, not an extension of
this one.

---

## Where everything lands, summarized

| Path | Tracked in git? |
|---|---|
| `docs/research/measurements/RUNBOOK.md` (this file) | yes |
| `docs/research/measurements/*.json` | **no** — gitignored (raw, regenerated per run) |
| `docs/research/measurements/*.csv` | **no** — gitignored (raw, regenerated per run) |
| A written-up conclusion (new `.md` in `docs/research/`) | yes, once someone writes one |

If a measurement run produces a number worth remembering past the next `git status`, write it into a
tracked `.md` — the JSON/CSV files themselves are working data, not the record.
