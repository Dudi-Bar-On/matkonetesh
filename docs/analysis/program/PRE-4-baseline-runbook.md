# PRE-4 · Baseline-capture runbook (owner action)

**Who:** the repo owner. **What:** provision one GitHub Actions secret, then trigger the eval workflow
once to capture the incumbent baseline. **Why it cannot wait:** the numbers below are hard calendar dates.

> ## ⏰ Deadlines — read first
> - **Capture the baseline before 2026-09-01.** This is the program charter's target for "incumbent
>   baseline recorded" (`docs/analysis/program/PRE-4-eval-harness-design.md` §9).
> - **`gemini-2.5-flash` retires 2026-10-16.** After that date the incumbent no longer exists and a fresh
>   measurement of it becomes **permanently impossible** — the scorecard captured now is the only record
>   that will ever exist (design doc §10). The harness (code) survives; the baseline (data) does not.

The CI wiring is already shipped: `.github/workflows/eval.yml`, a `workflow_dispatch`-only workflow. It
runs today with **no** secret set — the live cases skip cleanly and the deterministic scorers pass. The
one thing only the owner can do is add the paid API key. This runbook is that step, start to finish.

---

## Step A — create the `GEMINI_EVAL_KEY` repo secret

Use a **new, dedicated, billing-enabled Gemini API key** — *not* the Worker's `GEMINI_KEY`. They serve
different trust boundaries: the Worker key is server-side production infrastructure behind a metered proxy;
this one is a CI-only, low-volume, paid-tier key used exclusively by the eval harness. Mixing them would
give an eval-harness bug or leak blast radius on production billing (design doc §8).

Use the **paid tier**, not the free tier — free-tier rate limits for this model family are inconsistently
documented by Google and a reliability gate should not depend on an undocumented quota (design doc §8). The
whole baseline run costs roughly **$2.50** (≈93 live calls; design doc §9), so paid-tier spend here is
negligible.

**Get the key:** create a new API key in Google AI Studio / the Gemini API console under a
billing-enabled project. Keep it in your password manager; it goes **only** into the GitHub secret below —
never into this repo, never pasted into a report, never echoed (`CLAUDE.md` § "Secrets never enter the repo").

### Option 1 — web UI
1. Open **`https://github.com/Dudi-Bar-On/matkonetesh/settings/secrets/actions`**
   (repo → **Settings** → **Secrets and variables** → **Actions**).
2. Click **New repository secret**.
3. **Name:** `GEMINI_EVAL_KEY` (exact — the workflow reads `secrets.GEMINI_EVAL_KEY`).
4. **Secret:** paste the key value.
5. Click **Add secret**.

### Option 2 — `gh` CLI
Reads the value from your clipboard-free, history-free prompt — the key is never written to a file or shell
history:
```bash
gh secret set GEMINI_EVAL_KEY --repo Dudi-Bar-On/matkonetesh
# → paste the key at the "Paste your secret:" prompt, press Enter
```
Verify it registered (shows the name and updated time, never the value):
```bash
gh secret list --repo Dudi-Bar-On/matkonetesh
```

---

## Step B — trigger the baseline capture

With the secret set, run the workflow. The live baseline cases now call the real `gemini-2.5-flash`; the
`test.skip` guard no longer fires.

### Option 1 — `gh` CLI
```bash
gh workflow run eval.yml --ref main
# then watch it (grab the id from the top of the list):
gh run list --workflow eval.yml --limit 1
gh run watch <run-id> --exit-status
```

### Option 2 — Actions UI
1. Open **`https://github.com/Dudi-Bar-On/matkonetesh/actions/workflows/eval.yml`**.
2. Click **Run workflow** → branch **main** → **Run workflow**.
3. Watch the run to completion (it should be **green**).

**Recommended: run it 2–3 times before 2026-09-01.** A single sample cannot tell "the model is unreliable
on this case" from "it got unlucky once" — the harness runs each case N=3 within a run, and repeating the
whole run resolves any run-to-run instability in the suite itself (design doc §5, §9).

---

## Step C — where the scorecard lands

Each live run writes, inside the CI job's checkout:

```
docs/analysis/program/eval/baseline-gemini-2.5-flash-<YYYY-MM-DD>.json   # raw model responses (irreplaceable)
docs/analysis/program/eval/baseline-gemini-2.5-flash-<YYYY-MM-DD>.md     # human-readable scorecard
```

The workflow uploads that folder as the **`eval-scorecard`** build artifact (retained 90 days). Download it
from the run's **Summary** page (Artifacts section), or:
```bash
gh run download <run-id> --name eval-scorecard --repo Dudi-Bar-On/matkonetesh
```

**Then commit the scorecard into the repo** — it is the one artifact in the whole program that cannot be
regenerated after 2026-10-16 (design doc §10 explicitly wants the raw baseline committed, not `.gitignore`d).
The CI run produces it inside the runner's checkout but does not push; move the downloaded JSON + markdown to
`docs/analysis/program/eval/` on `main` and commit them.

---

## What is already done vs. what needs the owner

| | Status |
|---|---|
| Eval harness (`evals/`), deterministic scorers, live runner | ✅ shipped (Task 4) |
| `workflow_dispatch`-only CI workflow (`.github/workflows/eval.yml`) | ✅ shipped (Task 5) — verified green on a no-secret dispatch (live cases skip, scorers pass) |
| **`GEMINI_EVAL_KEY` repo secret** | ⛔ **owner only** — Step A above |
| **Baseline capture run(s) before 2026-09-01** | ⛔ **owner only** — Step B above |
| Commit the captured scorecard to `main` | ⛔ **owner** — Step C above |
