# PRE-7 · Viewport standardization — failure register

**Change:** `playwright.config.ts` — the `chromium` project now sets `viewport: { width: 390, height: 844 }`
on top of `devices['Desktop Chrome']`. Every spec that does not override now runs at the size DoD line 8
mandates for UI evidence.

**Before:** 412 passed, **1 failed** at Desktop Chrome (1280 × 720). *(The task brief predicted 413 passed —
the one failure is pre-existing, intermittent, and unrelated to the viewport. It is recorded in §3.)*
**After:** **413 passed, 0 failed** at 390 × 844. Exit code 0.

---

## 1. Failures attributable to the viewport change

| # | Spec file : line | Test name | Failure | Category |
|---|---|---|---|---|
| — | — | — | **none** | — |

**The register is empty. Zero tests failed as a result of running at 390 × 844.**

A null result on a change that was expected to break things is exactly the shape of an inert change, so it
was verified rather than assumed — see §2.

## 2. Why the null result is real, and how that was proved

Per `docs/process/skills/verify-against-the-runtime-path/SKILL.md` ("prefer executing to reading"), a green
suite was not accepted as evidence that the viewport had actually reached the browser. A temporary probe
spec asserted `window.innerWidth` / `window.innerHeight` after `page.goto('/index.html')`:

| Config | Probe result | Verdict |
|---|---|---|
| `devices['Desktop Chrome']` only (stashed) | `{"w":1280,"h":720}` — test **FAILED** | RED witnessed |
| with `viewport: { width: 390, height: 844 }` | `{"w":390,"h":844}` — test **passed** | GREEN |

The probe also captured a screenshot at 390 × 844, which was looked at (DoD 8): the Hebrew RTL home screen
renders in its mobile layout — search bar, greeting, category rails, the Ask-the-Fire card and the
five-item bottom nav — with nothing clipped or overlapping. The probe spec was deleted after use.

**Why nothing broke — the structural reason.** This suite asserts almost entirely on *state and DOM text*,
not on geometry. Tests drive the app through `page.evaluate` against its own functions (`openCopilot()`,
`cRefreshHome()`, `copilotPace()`) and assert on `textContent`, stored values and selector presence. Only
4 of 82 specs touch layout geometry at all (`adaptive-home`, `equipment-walkthrough`, `occ-css-tokens`,
`occupancy-view`), and the CSS is mobile-first, so narrowing the viewport moves the layout *toward* the
width those specs were written against. Nothing depended on a desktop-only element.

## 3. Pre-existing finding — NOT caused by this change

> **This did not come from the viewport change and was not fixed here. It is raised for the owner.**

| # | Spec file : line | Test name | Failure | Category |
|---|---|---|---|---|
| P1 | `tests/copilot.spec.ts:87` | W2-P3: probe check-in UI logs a reading and updates the pace card | 30 s timeout at `copilot.spec.ts:99` (`waitForFunction` on `/another/` in `.cop-probe`) | **PRE-EXISTING FLAKE** (viewport-independent) |

**Evidence it is not mine:** it failed in the **baseline** run, at Desktop Chrome, *before* the config was
touched. It then **passed** in the 390 × 844 full run, and Task 1's suite run recorded 413/413 at Desktop
Chrome. So: intermittent, and independent of viewport.

**What the failure state proves** (from Playwright's own snapshot,
`test-results/copilot-W2-P3-probe-check--4ec14-.../error-context.md`): the Copilot panel was open and
correct, but still showed the **"Set target"** input row and the pace note *"Set a target internal temp to
get a finish-time estimate."* — i.e. `sess.targetC` was never set — while `liveSession().probes.length===1`
had already succeeded. The probe was logged; the target was not.

**The mechanism that makes this silent** (`app.js:5513`):

```js
{ const tb=$("#copTargetSet"); if(tb) tb.addEventListener('click',function(){ const inp=$("#copTarget"); const v=inp?parseFloat(inp.value):NaN; if(!isNaN(v)){ copilotSetTarget(v); openCopilot(); } }); }
```

There is no `else`. If the input's value is absent when the button is clicked, the handler **does nothing at
all** — no target set, no re-render, no user feedback. The test's `fill` (`copilot.spec.ts:91`) and `click`
(`:92`) are two separate round-trips; anything that replaces `#panel`'s markup in between discards the typed
value and lands the app in exactly the observed state.

**Not asserted:** *what* clears the value in the failing run. Two candidates were checked against the source
and **ruled out** — there is no periodic re-render of the Copilot panel (`openCopilot` has no interval
caller; `app.js:9454`, `:7734`, `:2381` tick other things), and `hydrateMT` (`app.js:6987`) only assigns
`textContent` on `[data-mt]` nodes and cannot clear an input. The root cause is **unproven** and is
deliberately not guessed at here.

**Proposed gap — `GAP-PRE7-A`:** the silent no-op at `app.js:5513` (and the identical shape at `:5512` for
`copProbeLog`) is worth closing on its own merits, independently of the flake: a user who taps "Set target"
with an empty or unparsable field gets no feedback whatsoever. That is a product change and is **not** made
here.

## 4. Hand-off note for Task 3 (removing the redundant overrides)

Task 3 is described as removing now-redundant `page.setViewportSize` calls. **They are not uniformly
redundant.** There are **19 call sites across 5 specs** — not the 2 the plan assumed:

| Spec | Call sites | Size(s) set |
|---|---|---|
| `tests/adaptive-home.spec.ts` | 12 | 390 × 820, 390 × 900, 390 × 1000 |
| `tests/timeline-enhancements.spec.ts` | 3 | 390 × 780, 390 × 820 |
| `tests/scheduler-placement.spec.ts` | 2 | 390 × 900 |
| `tests/occupancy-view.spec.ts` | 1 | 390 × 844 |
| `tests/occupancy-unknown-footprint.spec.ts` | 1 | 390 × 844 |

Every one already uses **width 390**, so the new default changes nothing for them. Only the **2 sites at
exactly 390 × 844** are strictly redundant. The other **17 deliberately set a different height** (780 → 1000)
and several are set *before* `page.goto` on specs that assert height-adaptive behaviour. Dropping those would
change the height under test, not just remove duplication. Remove the 2 exact matches freely; treat the other
17 as behaviour changes requiring their own evidence.

## 5. Correction to the task brief's premise

The brief (and the comment text it specified verbatim) states *"only 2 of 82 specs set a mobile viewport"*.
Measured: **5 of 82 specs, 19 call sites** — 2 of which use exactly 390 × 844. The comment committed to
`playwright.config.ts` was corrected to say this accurately rather than repeat the wrong count.
