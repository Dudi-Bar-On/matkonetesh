# Hybrid P/E-core scheduling on Windows — using MORE of the i9-14900 for the Playwright suite, reliably

**Status:** research only (owner-mandated deep research, §10.14). No suite runs, no builds, no config or
code changes. The only local actions taken were **read-only measurements** on this machine (CPU topology
dump, one perf-counter sample, a scratch-process affinity-inheritance test, `powercfg` queries) — no repo
file, power setting, priority, or affinity of any persistent process was modified. Every claim below is
either (a) a quote from an official Microsoft / Playwright / Chromium source, (b) an explicitly-labelled
community source, or (c) a **measured fact from this machine**, marked `[measured]`.

**Scope split:** the sibling task covers warm-page/pre-loading (making each navigation cheaper). This doc
covers the OS/scheduling/process side (making the machine schedule the existing work better). The two
compose.

**Repo context read (not modified):** `playwright.config.ts` (workers=8, timeout=30s,
navigationTimeout=15s, retries=0, two projects chromium/service-worker, `MK_TEST_PORT` overridable),
`serve.js` (now single-process in-memory), `package.json` (`@playwright/test ^1.61.1`),
`docs/process/development-discipline.md` §11a, `docs/research/cpu-32-core-utilization.md`,
`docs/research/playwright-reliability-research.md`.

**Environment `[measured]`:** Intel Core i9-14900 (non-K), 24 cores / 32 logical (`Win32_Processor`),
Windows 11 Pro build 10.0.26220, Node v24, Playwright 1.61.1. Active power scheme:
**"GameTurbo (High Performance)"** (an OEM scheme, GUID `fd689da4-…`), with
`HETEROPOLICY=0`, `SCHEDPOLICY=5 (Automatic)`, `SHORTSCHEDPOLICY=5 (Automatic)` on both AC and DC
(`powercfg /qh SCHEME_CURRENT SUB_PROCESSOR`).

---

## 0. §10.11 — graphify GLOBAL graph queried first: a genuine miss

Per the standing instruction, `~/.graphify/global-graph.json` was queried before any web search.
`graphify god-nodes --top 25` shows the corpus is playwright-docs / vitest-docs / superpowers-docs /
bmad-docs / serena-docs / Gemini-API docs / GSD methodology. Two vocabulary-expanded queries:

- `"workers parallel shard CPU"` → 51 nodes, all name-collisions: **Cloudflare Workers** (the word
  "workers"), GSD "Parallel Codebase Mappers", vitest docs. One genuine `shard` node exists
  (playwright-docs-20, sharding overview — already used by the sibling CPU report §6).
- `"affinity scheduler priority core efficiency"` → 26 nodes, again collisions: Gemini pricing's
  "Priority Inference", GSD STACK templates.

**No node exists for Windows scheduling, Thread Director, QoS/EcoQoS, CPU affinity, hybrid CPUs, or
Playwright worker internals.** Per §10.11's own rule the corpus has no relevant vocabulary → the web was
the correct next step. Deposit-worthy finds are listed at the end (none deposited — research-only task,
same precedent as the two sibling research docs).

---

## 1. This machine, measured — the ground truth everything else builds on

### 1.1 P/E topology and the exact logical-CPU indices `[measured]`

Dumped via `GetLogicalProcessorInformationEx(RelationProcessorCore)` (P/Invoke from PowerShell;
`EfficiencyClass` is the API's own field — higher = more performant core class):

| Cores | EfficiencyClass | SMT | Logical CPUs |
|---|---|---|---|
| 8 P-cores (Raptor Cove) | 1 | yes | **0–15** (pairs: 0,1 / 2,3 / … / 14,15) |
| 16 E-cores (Gracemont) | 0 | no | **16–31** (one LP each) |

So: **affinity mask `0xFFFF` = the 8 P-cores (16 threads); `0xFFFF0000` = the 16 E-cores.** This layout
(P-cores enumerated first, SMT pairs adjacent, E-cores after) matched the common convention, but it was
verified rather than assumed — the mapping is firmware-dependent and any pinning experiment must re-derive
it on another machine. Sysinternals **Coreinfo** reports the same thing without code: "Coreinfo is a
utility that shows you the mapping between logical processors and the physical processor", and its UI
marks "P-Cores (Performance cores)… E-Cores (Efficiency cores)" explicitly
([learn.microsoft.com/sysinternals/downloads/coreinfo](https://learn.microsoft.com/en-us/sysinternals/downloads/coreinfo)).

Clock spec for the i9-14900 (Intel ARK, via search snippet — intel.com blocks direct fetch): P-core max
turbo **5.4 GHz** (5.8 with TVB), E-core max turbo **4.3 GHz**; base 2.0 / 1.5 GHz
([Intel ARK i9-14900](https://www.intel.com/content/www/us/en/products/sku/236793/intel-core-i9-processor-14900-36m-cache-up-to-5-80-ghz/specifications.html)).
On clocks alone an E-core is ~74–80% of a P-core; with the IPC gap the practical single-thread ratio for
JS-parse-like work is commonly cited around **~50–65% of a P-core** (community figure — e.g. Alois Kraus
measures E-cores "2-3x slower" for his CPU-bound load on an earlier hybrid part, see §2.3; the exact ratio
for OUR 2.4 MB parse+execute is measurable in M4 below and should be measured, not assumed).

### 1.2 Per-core-class utilization IS measurable with stock tools `[measured]`

- `Get-Counter '\Processor Information(*)\% Processor Time'` works; instance names are
  **`Group,LogicalIndex`** — `"0,0"…"0,15"` = P-threads, `"0,16"…"0,31"` = E-cores (topology above). The
  task brief's `\Processor(*)\% Processor Time` also exists, but `Processor Information` is the
  hybrid-aware set and additionally provides **`% Processor Utility`**, `% of Maximum Frequency`, and
  `Actual Frequency` (all verified present on this machine). `% Processor Utility` is the
  frequency-normalized measure Task Manager itself uses (it can exceed 100 at turbo), which matters on a
  part whose P and E cores run at very different clocks — record BOTH counters in experiments.
- One idle spot-sample during this research: P-threads 0/1/15 at 12.7/4.9/0.2% while E-cores 16/30/31 sat
  at **51.6/37.6/29.8%** — i.e. even at rest, Windows is visibly keeping this session's background load on
  E-cores while P-cores idle. A single sample, not a study; the run-time sampler in M0 does it properly.
- **Task Manager**, Details tab: right-click column header → add **"Power throttling"** — shows per-process
  EcoQoS/throttling state live (the leaf icon / "Efficiency mode" UI is the same mechanism; the EcoQoS blog
  below is the official description). This is the fastest way to check whether anything in the Playwright
  tree got Eco-tagged during a run.
- Deeper (only if needed): **Windows Performance Recorder** CPU Precise profile shows per-thread core
  placement over time; Alois Kraus's blog (§2.3) demonstrates exactly this method on hybrid CPUs.

### 1.3 Child processes inherit the parent's affinity mask — verified locally `[measured]`

Official rule: *"Process affinity is inherited by any child process or newly instantiated local process."*
— [SetProcessAffinityMask, Remarks](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setprocessaffinitymask).
Verified on this machine: a transient `pwsh` set itself to `0xFFFF`, then spawned two `node` children —
both children reported `ProcessorAffinity = 0xFFFF`. This is the mechanism that makes ONE affinity call on
the top of the Playwright tree govern every worker, browser, renderer and GPU process under it (Chromium
spawns its children with ordinary `CreateProcess` — no per-child affinity-setting code appears in
`base/process/process_win.cc`, which handles priority/EcoQoS only; see §3.3 — so inheritance applies.
Marked INFERRED for the browser tree specifically; M0 verifies it empirically before anything relies on it).

### 1.4 The relevant power-plan policies on this machine `[measured]`

`powercfg /qh SCHEME_CURRENT SUB_PROCESSOR` (hidden settings included):

| Setting (alias) | Meaning | Current value |
|---|---|---|
| `SCHEDPOLICY` | "Heterogeneous thread scheduling policy" — **long-running** threads | **5 = Automatic** |
| `SHORTSCHEDPOLICY` | same, for **short-running** threads | **5 = Automatic** |
| `HETEROPOLICY` | "Heterogeneous policy in effect" (0–4) | 0 |

Official definition: *"SchedulingPolicy specifies the preference (or constraint) in processor scheduling
for long running threads on systems with processors with heterogeneous architecture"*; values
0 All processors · 1 Performant · 2 **Prefer performant** · 3 Efficient · 4 Prefer efficient ·
5 Automatic — *"Value of Automatic lets the OS determine the policy based on system configuration and QoS
type."* PowerCfg alias `SCHEDPOLICY`, **hidden setting: yes** —
[learn.microsoft.com … schedulingpolicy](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/configuration-for-hetero-power-scheduling-schedulingpolicy).
A 2.4 MB parse+execute is a *long*-running burst (hundreds of ms to seconds), so `SCHEDPOLICY` (not
`SHORTSCHEDPOLICY`) is the one that would govern it if changed from Automatic.

---

## 2. Q1 — why does work land on E-cores (or does it)?

### 2.1 The documented placement model: priority decides WHO runs, QoS influences WHERE

The authoritative page is Microsoft's **Quality of Service** doc
([learn.microsoft.com/windows/win32/procthread/quality-of-service](https://learn.microsoft.com/en-us/windows/win32/procthread/quality-of-service)):

> "While scheduling priority remains the main metric by which the system determines which thread to
> schedule next, QoS can influence core selection and processor power management. On platforms with
> heterogeneous processors, the QoS of a thread may restrict scheduling to a subset of processors, or
> indicate a preference for a particular class of processor."

The QoS levels that steer core class, with their **defaults** (same page, verbatim column content):

| QoS | Who gets it by default | Effect on cores |
|---|---|---|
| High | "Windowed applications that are in the foreground and in focus, or audible", or explicit opt-in | "Standard high performance" |
| Medium | Visible-but-unfocused windows | between High and Low |
| Low | "Windowed applications that are not visible or audible" | "**On battery**, selects most efficient CPU frequency and schedules to efficient core" |
| Utility | "Background services" | "**On battery**, selects most efficient CPU frequency and schedules to efficient cores" |
| **Eco** | only processes/threads that "**explicitly tag**" via `SetProcessInformation`/`SetThreadInformation` | "**Always** selects most efficient CPU frequency and schedules to efficient cores" |

And the classification sources: window-visibility rules apply only to "Processes which directly own a
window (or are descendants of window owning processes)"; everything else falls to:

> "**Heuristic** — Threads which are not classified by the above sources are automatically assigned a QoS
> level by the system. These heuristics include (but are not limited to) thread priority, where threads
> running with reduced thread priority can imply a lower QoS level."

**What this means for our tree.** `node.exe` (test workers) and headless Chromium own no window, play no
audio, and run at NORMAL priority → they are classified by the *Heuristic* source, not the Visible one.
Nothing in the documented model auto-assigns Eco to a windowless NORMAL-priority process, and the
Low/Utility "schedule to efficient cores" rows are **battery-conditioned** — this is a desktop on AC.
The often-repeated claim that "Windows shoves background apps onto E-cores" is documented for
*minimized/occluded windowed* apps (Intel's own support article says Windows 11 "heavily prioritizes the
E-cores" for apps "not being drawn on the screen (whose window is minimized or completely covered)" —
[Intel support 000091284](https://www.intel.com/content/www/us/en/support/articles/000091284/processors.html),
via search snippet; intel.com blocks direct fetch) — a category headless test processes are NOT in.

### 2.2 Thread Director: hardware feedback, consumed per-thread by the Win11 scheduler

Intel Thread Director is on-die telemetry that classifies each running thread's instruction mix and feeds
the OS scheduler so it can place demanding threads on P-cores and efficient/background work on E-cores;
Windows 11's scheduler consumes this feedback (Intel support article above; corroborated by
[Premio's explainer](https://premioinc.com/blogs/blog/what-are-p-cores-and-e-cores-in-intel-12th-and-13th-gen-cpu)
and [Military Embedded's overview](https://militaryembedded.com/radar-ew/rf-and-microwave/cores-and-threads-hybrid-processors-for-todays-multitasking-world)
— all community/vendor-marketing tier; Intel publishes no precise algorithm). The practical consequence,
consistent across sources: **a heavy single-thread burst gets a P-core while P-cores are available; when
more demanding threads are runnable than P capacity, the overflow runs on E-cores** — the OS does not hold
work hostage waiting for a P-core.

### 2.3 The best measured evidence: Alois Kraus's hybrid-CPU study (community, ETW-based)

[aloiskraus.wordpress.com — "Hybrid CPU Performance on Windows 10 and 11"](https://aloiskraus.wordpress.com/2024/02/08/hybrid-cpu-performance-on-windows-10-and-11/)
(a Windows perf engineer measuring with ETW):

- Windows 10, Balanced plan: "all threads of a Below Normal process run on the E-Cores only" — the
  priority→QoS→E-core demotion is real and total there, and E-cores were "2-3x slower" for his load.
- Windows 11: "not much difference between the Hetero settings at all" except when deliberately confining
  work to E-cores — i.e. **Win11's Automatic policy already does approximately the right thing**, and the
  Win10-era powercfg hetero tricks buy little on Win11.

### 2.4 So what starved the 10-worker run — E-core placement or P oversubscription?

Putting the documented model + repo evidence together:

- 10 workers × (1 renderer doing a ~seconds-long single-thread 2.4 MB parse+execute at init) = **10
  simultaneous P-class demand bursts against 8 P-cores**. Even with perfect placement two heavy inits are
  *always* on an E-core (or sharing a P-core SMT sibling at roughly half throughput each); Thread
  Director rotation spreads the penalty, the 30s test clock does not care. The failure being
  **deterministic on the heaviest-init specs** (§11a) is exactly the signature of "demand exceeds P
  capacity, slowest-init loses", NOT of random Eco-tagging.
- The repo's own 8-worker fix fits the same model: 8 heavy bursts ↔ 8 P-cores, E-cores absorb the
  browser/node/OS background threads, everything meets the timeout.
- **Verdict (hypothesis to confirm in M2, not an assumption):** the starvation is "more P-class runnable
  threads than P-core capacity, spillover onto slower E-cores/SMT siblings", with EcoQoS playing no
  documented role for these windowless AC-powered processes. The M0 sampler + Task Manager's
  Power-throttling column settle it with data: during a failing 10-worker window, P-threads should be
  pegged ~100% while E-cores show substantial-but-unsaturated load, and no chrome/node process should show
  power throttling. If instead E-cores are pegged and P-threads have idle gaps, the diagnosis flips and
  the QoS/priority levers (§4) move up the ranking.

**Answer to "are E-cores genuinely usable?": yes — for the right work.** They are full x86 cores at
~4.3 GHz; 16 of them idle is enormous wasted throughput. What they cannot do is run a P-sized
single-thread init burst inside a P-sized timeout budget. The winning shape is therefore not "keep off
the E-cores" but **"put bounded, known-lighter work on them, with a timeout class that fits them"** — which
is precisely what §5's split-worker-classes intervention does.

---

## 3. Q2 — CPU affinity control

### 3.1 The mechanisms, weakest to strongest

| Mechanism | Scope | Soft/hard | How |
|---|---|---|---|
| **CPU sets** | process default / per thread | **soft** — "declare application affinity in a 'soft' manner that is compatible with OS power management"; scheduler and system threads can deviate | `SetProcessDefaultCpuSets` / `SetThreadSelectedCpuSets` (P/Invoke only — no PowerShell/.NET surface) — [CPU Sets doc](https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets) |
| **Affinity mask** | process (inherited by children, §1.3) | **hard** — "a bit vector in which each bit represents a logical processor on which the threads of the process are allowed to run"; and "If a thread or process has a restrictive affinity mask set, the affinity mask is respected above any conflicting CPU Set assignment" ([CPU Sets doc](https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets)) | `SetProcessAffinityMask`; PowerShell `(Get-Process -Id X).ProcessorAffinity = 0xFFFF` ([.NET Process.ProcessorAffinity](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.processoraffinity)); `start /affinity <hexmask>` at launch ([start command](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/start)) |
| **Job object affinity** | every process in the job, enforced | hard, group-wide | `JOB_OBJECT_LIMIT_AFFINITY`: "Causes all processes associated with the job to use the same processor affinity… threads are free to subsequently set their affinity, as long as it is a subset… Processes cannot set their own affinity mask." ([JOBOBJECT_BASIC_LIMIT_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information)) — needs a small native/C# launcher; PowerShell alone can't do it |

All 32 LPs fit one processor group, so none of the >64-LP group complications apply
([SetProcessAffinityMask remarks](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setprocessaffinitymask)).

### 3.2 Do Chromium renderers inherit affinity? Yes (by Windows rule; verify once)

Renderers/GPU/utility processes are ordinary child processes of the browser process → the §1.3 inheritance
rule covers them. The fetched `process_win.cc` shows Chromium managing child **priority and EcoQoS**, not
affinity — no affinity-setting code to undo the inheritance. Practical corollary: **pinning the single
top-level `npx playwright test` process pins the entire suite** — workers, browsers, renderers — with one
command, e.g. from PowerShell:

```powershell
$p = Start-Process -PassThru -NoNewWindow cmd '/c npx playwright test'
$p.ProcessorAffinity = 0xFFFF     # whole tree → the 16 P-threads (set it BEFORE workers spawn — i.e. immediately)
```

(or `cmd /c start /affinity FFFF /b /wait cmd /c "npx playwright test"`). Caveat: set it immediately after
spawn — children created *before* the change would keep the old mask; a launcher that creates the process
suspended, sets affinity, then resumes is the airtight version (that is exactly what `start /affinity`
does internally at launch).

**Do NOT wrap the browser executable itself** (an `executablePath` shim that calls `start /affinity …
chrome.exe`): Playwright launches Chromium with a stdio remote-debugging pipe and supervises the child it
spawned; inserting a shim breaks the pipe fds and the process-tree ownership. Reasoned, not sourced —
but the failure mode is structural, and the top-of-tree approach makes shims unnecessary anyway.

### 3.3 Is pinning 8 workers to the 16 P-threads better than letting Windows schedule?

What the sources say:

- Microsoft built CPU sets precisely because hard affinity is a blunt instrument ("compatible with OS
  power management" is the contrast being drawn — [CPU Sets doc](https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets)).
- The .NET remarks give the one case where pinning helps: "Under heavy system loads, specifying which
  processor should run a specific thread can improve performance by reducing the number of times the
  processor cache is reloaded" ([ProcessorAffinity](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.processoraffinity)).
- Kraus's Win11 measurements (§2.3): the scheduler already places this well; hard confinement only showed
  effects when it *hurt* (E-only).

**Assessment:** whole-tree pinning to `0xFFFF` at the CURRENT 8 workers would mostly *shrink* the machine
(browser compositor/IO threads, node event loops, serve.js — all currently free to use E-cores — would be
forced to compete for the same 16 P-threads the renderers need). As a *permanent* setting it is the wrong
direction for the owner's goal (use MORE of the machine, not less). Its real value is **diagnostic** (M6):
at 10 workers, pinned-P vs unpinned cleanly separates "E-cores made the stragglers slow" from "8 P-cores
simply cannot run 10 init bursts in time" — one variable, decisive either way. Affinity's *productive*
form here is the **inverse split** — light-class workers pinned/preferred to E-cores so they cannot steal
P capacity from heavy-class inits (§5.3, M5) — and even that should first be tried WITHOUT pinning, since
per-project worker caps may achieve the same balance with zero OS surgery.

### 3.4 Known pitfalls

- Affinity defeats Thread Director for the pinned tree (the whole point of ITD is picking the core class
  per thread phase; a hard mask removes its choices). Use only with a measured reason. (Reasoned from the
  documented mechanisms; Intel's developer guidance pages are bot-blocked, so no direct Intel quote.)
- Affinity is NOT priority: a pinned tree still competes by priority inside its mask.
- `PROCESS_MODE_BACKGROUND_BEGIN` (the "background mode" that lowers priority+I/O class) is broken/abandoned
  territory — Chromium's source carries the comment "having a process put itself in background mode is
  broken in Windows 11 22H2. So, it is no longer supported. See https://crbug.com/1396155" (fetched from
  [process_win.cc](https://chromium.googlesource.com/chromium/src/+/main/base/process/process_win.cc)).
  Nothing in our plans should touch it; listed because it appears in older "how to background a process"
  advice.

---

## 4. Q3 — priority classes, EcoQoS, and opting out of throttling

### 4.1 What priority actually does (and does not do)

[Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities):
"The system assigns time slices in a round-robin fashion to all threads with the highest priority… If a
higher-priority thread becomes available to run, the system ceases to execute the lower-priority thread."
Priority classes IDLE→REALTIME map to base priorities 4/6/8/10/13/24 (at THREAD_PRIORITY_NORMAL).
**Nothing on the page ties priority class to core class** — placement is the QoS/ITD layer (§2.1). The
documented coupling is one-way and negative: *reduced* priority can imply *lower* QoS via the Heuristic
classifier (§2.1) — which on Win10/Balanced literally meant "Below Normal ⇒ E-cores only" (§2.3).

Two operationally important rules from the same page:

- **Inheritance is asymmetric:** "If the calling process is IDLE_PRIORITY_CLASS or
  BELOW_NORMAL_PRIORITY_CLASS, the new process will inherit this class." Raising a parent to
  ABOVE_NORMAL/HIGH does **not** propagate to children — so bumping the `npx` node process does nothing
  for the browsers. Raising the whole tree requires either a **job object**
  (`JOB_OBJECT_LIMIT_PRIORITY_CLASS`: "Causes all processes associated with the job to use the same
  priority class") or a post-launch sweep (`Get-Process chrome, node | % { $_.PriorityClass = 'AboveNormal' }`).
  Conversely — and this is the trap — running the suite from a shell that something ELSE demoted to
  BELOW_NORMAL would silently demote every worker and browser, and on a battery-Balanced machine that
  historically meant E-cores-only. Worth one `Get-Process` assertion in M0.
- **HIGH is dangerous at fleet scale:** "If a thread runs at the highest priority level for extended
  periods, other threads in the system will not get processor time." Thirty-plus browser processes at
  HIGH would do exactly that to the desktop. ABOVE_NORMAL is the sane ceiling for a test fleet.

**What ABOVE_NORMAL buys here:** not core-class placement, but **victory over competing NORMAL work** —
i.e. it converts §11a's "the suite flakes under competing subagent load" from a scheduling coin-toss into
a rule ("the suite preempts background agents, not vice versa"). That directly serves the serialized-run
constraint without needing the machine to actually be idle.

### 4.2 EcoQoS / power throttling — the mechanism, and both directions of control

- What Eco does: "Windows will take this as a hint to automatically schedule this work to the most
  efficient processors, and to configure the processors to run at the most efficient clock speed" —
  [Introducing EcoQoS (devblogs)](https://devblogs.microsoft.com/performance-diagnostics/introducing-ecoqos/).
  It is **opt-in**: "Developers can call APIs to explicitly opt in their processes and threads."
- The API contract, with Microsoft's own code for all three states (enable Eco / force High / reset to
  system-managed) — [SetProcessInformation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation):
  "When a process opts into enabling `PROCESS_POWER_THROTTLING_EXECUTION_SPEED`, the process will be
  classified as EcoQoS… If an application does not explicitly enable it, **the system will use its own
  heuristics to automatically infer a Quality of Service level**." Opt-out is
  `ControlMask = PROCESS_POWER_THROTTLING_EXECUTION_SPEED; StateMask = 0` ("HighQoS"), callable from
  PowerShell via a 15-line `Add-Type` P/Invoke on any PID.
- **No-code per-EXE opt-out exists and is present on this machine** `[measured]`:
  `powercfg /powerthrottling disable /path <exe>` ("Control or query power throttling settings for an
  application", verified in local `powercfg` help; `/powerthrottling list` shows current overrides). The
  three relevant paths here:
  `C:\Program Files\nodejs\node.exe` (or wherever `node` resolves),
  `%LOCALAPPDATA%\ms-playwright\chromium-1228\chrome-win64\chrome.exe`, and
  `%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe`
  (both browser binaries are installed `[measured]`; which one a default headless run uses is confirmed in
  M0 by looking at the live process list, then both get the override — it is idempotent and harmless).
- The user-inactivity demotion ("Windows may lower the QoS policy of a foreground application to Medium…
  after a period of user inactivity where no input is detected", reg value `DisableUserPresenceQos`) is
  documented **on battery only** — noted for completeness because unattended test runs are exactly
  "automated tests lacking user input" (the doc's own warning), but it should be a non-issue on this AC
  desktop — [QoS doc](https://learn.microsoft.com/en-us/windows/win32/procthread/quality-of-service).

### 4.3 Does Chromium Eco-tag its own children? Yes for background ones — and Playwright already disarms it

From [base/process/process_win.cc](https://chromium.googlesource.com/chromium/src/+/main/base/process/process_win.cc)
(fetched): `BASE_FEATURE(kUseEcoQoSForBackgroundProcess, FEATURE_ENABLED_BY_DEFAULT)`, and in
`SetPriority()`: EcoQoS is **enabled for any child whose priority != kUserBlocking** (and `kBestEffort`
children additionally get `IDLE_PRIORITY_CLASS`). So a renderer Chromium considers "backgrounded" gets
EcoQoS → E-cores, by design.

Playwright's default launch switches (fetched from
[chromiumSwitches.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts))
include **`--disable-renderer-backgrounding`, `--disable-backgrounding-occluded-windows`,
`--disable-background-timer-throttling`** — i.e. test renderers are never demoted to background priority,
so the Eco path stays cold. This is the mechanism answer to "does Chromium spawned from a background agent
get Eco-tagged": **not the renderers under Playwright defaults**; utility-class children (network/storage
service) may legitimately show Eco/low priority — they are not on the init critical path, but M0's
Power-throttling column check will show them and they should not be mistaken for a problem.

---

## 5. Q4 — split worker classes: the out-of-box lever, verified in current Playwright

### 5.1 Per-project `workers` EXISTS since Playwright 1.52 (repo is on 1.61.1)

- API: `testProject.workers` — "The maximum number of concurrent worker processes to use for
  parallelizing tests from this project." — [class-testproject](https://playwright.dev/docs/api/class-testproject)
  (the page also confirms per-project `timeout` — "Timeout for each test in milliseconds" — plus `retries`,
  `fullyParallel`, `use`, `testMatch`/`testIgnore`, `grep`, `dependencies`, `teardown`).
- Release note, v1.52: "New property testProject.workers allows to specify the number of concurrent worker
  processes to use for a test project. **The global limit of property testConfig.workers still applies.**"
  — [release notes](https://playwright.dev/docs/release-notes). The long-standing feature request
  [#21970](https://github.com/microsoft/playwright/issues/21970) is CLOSED/COMPLETED (2025-03-10,
  verified via `gh`).
- Projects run **concurrently** by default: "By default, these projects will run in parallel, subject to
  the maximum workers limit." — [test-projects](https://playwright.dev/docs/test-projects). (Dependencies
  serialize; we would not use them.)

The prior belief recorded in this task's brief ("workers is global — verify") was true until 1.52 and is
**now false** — exactly the kind of stale fact §10.14 research exists to catch.

### 5.2 The design this unlocks (single run, one server, no §11a conflict)

```ts
// Sketch — NOT applied. Numbers are M3 starting points, to be measured.
workers: 22,                                   // global ceiling: sum of the classes, fits 64 GB comfortably
projects: [
  { name: 'heavy',                             // the ~10 heaviest-init specs (active-hub, adaptive-home, …)
    testMatch: ['**/active-hub*.spec.ts', '**/adaptive-home*.spec.ts', /* … */],
    workers: 6,                                // ≤ P-core count minus browser overhead — never oversubscribes P
    timeout: 30_000,                           // unchanged: heavy specs keep the strict budget ON P-cores
    use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, serviceWorkers: 'block' } },
  { name: 'light',
    testIgnore: [/* the heavy list */, '**/service-worker.spec.ts'],
    workers: 16,                               // the rest of the machine, E-cores included
    timeout: 45_000,                           // E-core-sized budget for a known-lighter class
    use: { /* same */ } },
  { /* service-worker project unchanged */ },
]
```

Why this matches the hardware: the heavy class can never exceed ~6 simultaneous P-sized init bursts
(P-cores stay unsaturated → their 30s budget holds), while the light class supplies enough runnable work
to soak the 16 E-cores; Thread Director keeps doing placement per-thread, no OS surgery at all. Both
classes share ONE Playwright process, ONE managed webServer on 8123 — §11a's one-server/one-run rules are
untouched. Cost: a curated heavy list (start = the 10 specs §11a already names as the deterministic
failures) and accepting a longer timeout class for light specs — which is a *widened* budget, not a
weakened assertion (DoD 11/12 semantics unchanged; retries stay 0).

Two honest unknowns for M3 to answer: (a) Playwright's scheduler does not promise *which* worker slots run
concurrently, so instantaneous heavy-concurrency ≤6 is guaranteed but P-core *placement* of exactly those
6 is the OS's call — the E-cores absorb the light class statistically, not by decree; (b) total-worker
sweet spot (22? 18? 24?) is an empirical question with memory as the second ceiling (~24 headless
Chromiums + node workers in 64 GB is fine on paper; watch the working set in M0).

### 5.3 Sharding on one machine: possible, not needed, and rule-encumbered

`--shard` is documented as a multi-**machine** lever ("you can further scale Playwright test execution by
running tests on multiple machines"; with `fullyParallel` it distributes individual tests evenly) —
[test-sharding](https://playwright.dev/docs/test-sharding). Two local shard processes with different
`MK_TEST_PORT`s (the config comment explicitly supports two servers on two ports) WOULD work mechanically
and would allow per-shard affinity/priority… but it means two concurrent suite runs — §11a's standing
"never run two suite runs concurrently" rule was written about a same-port accident, and the sibling
`cpu-32-core-utilization.md` already flagged relaxing it as an owner decision. **With per-project workers
available, local sharding buys nothing that projects don't, at the cost of two processes, two servers,
blob-report merging, and a rule change. Ranked last; revisit only if per-project scheduling proves too
coarse.**

---

## 6. Q5 — Chromium process/threading flags

- **Playwright's defaults already cover the backgrounding class** (§4.3 list). Nothing to add there.
- **`--renderer-process-limit`**: real switch, but each worker's context here has one page → one renderer;
  Chromium's own "soft process limit based on the memory available" logic
  ([process model docs](https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md))
  never binds at our scale. No expected effect.
- **`--single-process`**: Chromium's docs are unambiguous — "generally not a safe or robust process model,
  since it prevents the use of the sandbox and cannot survive any crash in renderer process code… mainly
  used for older low-resource Android WebView scenarios, and for debugging or testing" (same doc). It
  would also serialize renderer work INTO the browser process — the opposite of what a parallel suite
  wants. **Rejected.**
- **GPU / `--disable-gpu`**: new headless "has unified Headless and headful modes" (shares full browser
  code — [developer.chrome.com headless doc](https://developer.chrome.com/docs/chromium/headless)); the
  doc makes **no** recommendation to pass `--disable-gpu` for automation, and this app is a DOM-heavy
  static page, not a raster-heavy canvas app. If M0's process census shows GPU processes eating
  meaningful CPU, a `--disable-gpu` A/B is a cheap follow-up experiment; until then, adding flags on
  vibes is exactly what Playwright warns about ("use custom browser args at your own risk" —
  [browser-type-launch](https://playwright.dev/docs/api/class-browsertype#browser-type-launch)).
- **V8/JS flags** (`--js-flags=…`): deliberately out of scope — they change the engine under test; the
  sibling warm-page task addresses parse cost the honest way.

---

## 7. Q6 — what do big shops do?

- **Playwright's own default** is "half of the number of logical CPU cores" locally
  ([testconfig.workers](https://playwright.dev/docs/api/class-testconfig#test-config-workers)) — hybrid-blind,
  by construction. **No official Playwright guidance for P/E hybrids exists** (searched; the sibling
  reliability doc reached the same conclusion independently). The maintainer position on saturation is
  issue [#26739](https://github.com/microsoft/playwright/issues/26739): "the main reason is system
  saturation. As the wall time passes, only some processes get a chance to run. As a result, tests
  timeout."
- **Microsoft (Azure Playwright Workspaces / App Testing)** — the closest thing to vendor prior art for
  "browser farm meets client CPU": "Beyond a certain point, adding more workers leads to resource
  contention, which slows down each worker and **introduces test flakiness**"; their scale ladder is
  experiment → **move browsers off the client machine** → "Increase the computing resources on the client
  machine… Alternatively, if you have hardware limitations, you can shard" —
  [optimal configuration](https://learn.microsoft.com/en-us/azure/app-testing/playwright-workspaces/concept-determine-optimal-configuration).
  I.e. the industry answer to "one box is saturated" is *more boxes/cloud browsers*, not hybrid-aware
  tuning.
- **Community per-core budgets** (currents.dev, test-farm vendor): "A CI runner with four physical cores
  works well with 2–4 workers, while an eight-core machine can handle 6–8 workers before losing
  efficiency" — [sharding vs workers](https://currents.dev/posts/optimizing-test-runtime-playwright-sharding-vs-workers).
  Note the repo's measured 8-on-8-P-cores lands exactly on the top of that band **when you count only
  P-cores** — the E-cores simply don't show up in anyone's worker arithmetic.
- **Hybrid-specific browser-farm prior art: none found.** Searches for Playwright/browser-CI guidance
  naming P/E-cores returned generic worker advice only. The hybrid-aware knowledge lives in the Windows
  performance community (Kraus, §2.3) and game-dev world, not in test-infra literature — this doc is,
  as far as the research could find, ahead of published practice, which is why every intervention below
  carries its own measurement.

---

## 8. Ranked interventions

| # | Intervention | Expected effect | Risk | Cost |
|---|---|---|---|---|
| **1** | **Split worker classes** via `testProject.workers` + per-project `timeout` (§5.2): heavy≤6 workers/30s, light 16/45s, global ~22 | The machine's idle 16 E-cores finally carry the ~420 light tests while P-cores serve heavy inits; plausible wall-time drop from ~2.4m toward the 1.5–2m range (hypothesis — M3 measures) | Playwright schedules classes, OS places threads — no hard guarantee; memory footprint at 22 browsers; a wrong heavy-list means a heavy spec in the light class rides an E-core with 45s to spare (safe by construction) | Config-only; curate the heavy list (§11a already names the 10) |
| **2** | **`powercfg /powerthrottling disable`** for node.exe + both Playwright Chromium exes (§4.2) | Insurance: forecloses the Heuristic-QoS/Eco demotion path for the whole fleet; likely near-zero visible change on AC (nothing is expected to be Eco-tagged) — cheap to verify via Task Manager column | Effectively none (per-exe, reversible with `/powerthrottling reset`); machine-level persistent setting → note it in §11a if adopted | One admin command per exe |
| **3** | **ABOVE_NORMAL for the suite tree** during runs — post-launch sweep or job object (§4.1); never HIGH | Converts "suite must run on an idle machine" (§11a) into "suite preempts background NORMAL work" — protects the P-core budget from competing agents rather than pausing them | Background agents/desktop get visibly slower during a run (intended); must sweep AFTER workers spawn (inheritance asymmetry §4.1); HIGH would starve input — forbidden | Small PS helper; or accept §11a's pause-the-agents rule as-is |
| **4** | **Affinity pinning as an instrument** (§3.3): M6 pinned-P diagnostic; M4 E-only calibration | No production effect — produces the two numbers everything else is sized by: (a) is 10-worker failure P-capacity or placement; (b) the true E/P init-time ratio for timeout budgeting | Pinning fights Thread Director if left on — these are one-run experiments, reverted by process exit (affinity dies with the process) | One PowerShell line per experiment |
| **5** | **`SCHEDPOLICY=2` (Prefer performant)** via powercfg on the active scheme (§1.4) | Marginal on Win11 per Kraus ("not much difference between the Hetero settings") — would bias long bursts toward P at the expense of E utilization: the OPPOSITE of the owner's goal except as a narrow experiment | Machine-wide, persists across runs, hidden setting on an OEM scheme — owner-decision territory; must record+restore exact indices | One command; kept LAST deliberately |
| — | Local sharding (§5.3), `--single-process`, `--renderer-process-limit`, V8 flags | — | — | Rejected / no expected effect (reasons in §5.3, §6) |

---

## 9. Measurement plan — serialized per §11a, one variable at a time

Ground rules for every experiment: machine otherwise idle (heavy subagents paused), manual `serve.js`
stopped, runs go to completion (never killed), config edits stay local-only until a winner is chosen and
§11a + the config comment are updated with the numbers (existing convention). Each experiment states its
PREDICTION first (§12 PREDICT→TEST→OBSERVE→CONCLUDE); verdict-bearing reliability claims need **6–9 clean
runs** (§11a: a 3-run sample already lied once). The per-second counter sampler is ~zero-cost and runs
inside the measured window by design; it is the instrument, not competing load.

**M0 — instrument, no config change (one 8-worker baseline run).**
Start the sampler, run the suite once, and capture:
```powershell
# sampler: per-LP utilization + frequency-normalized utility, 1 Hz, to CSV
Get-Counter '\Processor Information(0,*)\% Processor Time','\Processor Information(0,*)\% Processor Utility' `
  -SampleInterval 1 -MaxSamples 400 |
  ForEach-Object { $t=$_.Timestamp; $_.CounterSamples |
    ForEach-Object { [pscustomobject]@{t=$t; c=$_.Path; v=[math]::Round($_.CookedValue,1)} } } |
  Export-Csv "$env:TEMP\pw-cpu.csv" -NoTypeInformation
```
Also during the run: (a) process census — which browser binary actually runs (chrome.exe vs
chrome-headless-shell.exe), how many processes per worker, `PriorityClass` of node/chrome (assert
Normal — §4.1 trap), Task Manager Details "Power throttling" column (expect renderers: Disabled;
utilities: maybe Enabled — §4.3); (b) affinity-inheritance spot check on one worker tree
(`Get-Process` → `ProcessorAffinity`, expect 0xFFFFFFFF everywhere). **Deliverable: the P-vs-E utilization
timeline at 8 workers — the baseline every later claim compares against. Prediction: P-threads ~saturated
during init storms, E-cores <40% average.**

**M1 — reproduce the 10-worker failure WITH the instruments (one run, expected red).**
`workers: 10` locally, sampler + census on. Prediction (from §2.4): the failing window shows P-threads
pegged while E-cores retain headroom, failing specs' renderers show no power-throttling, and their
init-burst threads visibly time-share/migrate. If instead E-cores are pegged and P-threads gap, the
diagnosis shifts to placement and intervention 3/2 move up. This is the experiment that turns §2.4 from
hypothesis into fact. (One run suffices — the failure is documented deterministic.)

**M2 — E/P calibration for the timeout class (no suite run).**
Run the heaviest spec alone twice: once pinned to P (`0xFFFF`), once pinned to E (`0xFFFF0000`), via the
§3.2 launcher on `npx playwright test <spec>`. Deliverable: the real E/P init-time ratio for THIS app
(prediction from clocks+IPC: ~1.5–2.0×). Sizes the light-class timeout (§5.2) with data instead of the
45s guess; if the heavy specs' E-time already fits 45s comfortably, the heavy list can be shorter.

**M3 — the split-classes config (the candidate winner; 6–9 runs).**
Apply §5.2 with M2-informed numbers. Success = all runs 433-clean at retries:0 AND wall time beats the
8-worker 2.3–2.5m floor meaningfully; also compare the M0 sampler shape (E-cores should now carry visible
load through the run — the owner's "use the machine" goal made visible in one chart). Failure modes to
watch: memory ceiling (working set), light-class stragglers at the new timeout (would indicate the class
split is wrong, not the timeout). Stop-rule: any non-clean run → systematic-debugging, never a re-roll.

**M4 — powerthrottling opt-out on top of M3's best (2–3 runs).**
Apply intervention 2, re-run. Prediction: no measurable change (nothing was Eco-tagged in M0/M1) — in
which case it stays as documented insurance, cheap and inert. If it DOES move numbers, that is a finding
(heuristic QoS was biting after all) and it gets written back into §2.4.

**M5 — only if M3 leaves heavy-class flake: ABOVE_NORMAL sweep (intervention 3), 3 runs.**
One variable: the priority sweep on top of M3. Measures whether residual flake was competing-load
preemption rather than P-capacity.

**M6 — only if M1's verdict was ambiguous: pinned-P at 10 workers (1–2 runs).**
The §3.3 diagnostic. Not needed if M1's counters were conclusive.

Order: M0 → M1 → M2 → M3 → M4, each gated on the previous verdict; M5/M6 conditional. Everything before
M3 changes no config at all; M3 is the first candidate change and lands only via the normal loop
(config comment + §11a update with pasted numbers, per the established convention).

---

## 10. Sources

**Microsoft (official):**
[Quality of Service](https://learn.microsoft.com/en-us/windows/win32/procthread/quality-of-service) ·
[SetProcessInformation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation) (EcoQoS code samples) ·
[PROCESS_POWER_THROTTLING_STATE](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/ns-processthreadsapi-process_power_throttling_state) ·
[Introducing EcoQoS](https://devblogs.microsoft.com/performance-diagnostics/introducing-ecoqos/) ·
[Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities) ·
[CPU Sets](https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets) ·
[SetProcessAffinityMask](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setprocessaffinitymask) ·
[JOBOBJECT_BASIC_LIMIT_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) ·
[start command](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/start) ·
[Process.ProcessorAffinity](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.processoraffinity) ·
[SchedulingPolicy power setting](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/configuration-for-hetero-power-scheduling-schedulingpolicy) ·
[Coreinfo](https://learn.microsoft.com/en-us/sysinternals/downloads/coreinfo) ·
[Playwright Workspaces optimal configuration](https://learn.microsoft.com/en-us/azure/app-testing/playwright-workspaces/concept-determine-optimal-configuration)

**Playwright (official):**
[class-testproject](https://playwright.dev/docs/api/class-testproject) ·
[release notes (v1.52 per-project workers)](https://playwright.dev/docs/release-notes) ·
[test-projects](https://playwright.dev/docs/test-projects) ·
[test-sharding](https://playwright.dev/docs/test-sharding) ·
[testconfig.workers](https://playwright.dev/docs/api/class-testconfig#test-config-workers) ·
[chromiumSwitches.ts (source)](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts) ·
issues [#21970](https://github.com/microsoft/playwright/issues/21970) (closed COMPLETED, via `gh`) ·
[#26739](https://github.com/microsoft/playwright/issues/26739)

**Chromium (official source/docs):**
[base/process/process_win.cc](https://chromium.googlesource.com/chromium/src/+/main/base/process/process_win.cc) ·
[process model & site isolation](https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md) ·
[headless](https://developer.chrome.com/docs/chromium/headless)

**Intel:** [support article 000091284](https://www.intel.com/content/www/us/en/support/articles/000091284/processors.html)
and [ARK i9-14900](https://www.intel.com/content/www/us/en/products/sku/236793/intel-core-i9-processor-14900-36m-cache-up-to-5-80-ghz/specifications.html)
(both via search snippets — intel.com returns 403 to direct fetch; so did Intel's game-dev hybrid guide, noted as a gap).

**Community (labelled):**
[Alois Kraus — Hybrid CPU Performance on Windows 10 and 11](https://aloiskraus.wordpress.com/2024/02/08/hybrid-cpu-performance-on-windows-10-and-11/) ·
[currents.dev — sharding vs workers](https://currents.dev/posts/optimizing-test-runtime-playwright-sharding-vs-workers) ·
[Premio P/E-core explainer](https://premioinc.com/blogs/blog/what-are-p-cores-and-e-cores-in-intel-12th-and-13th-gen-cpu) ·
[Military Embedded hybrid overview](https://militaryembedded.com/radar-ew/rf-and-microwave/cores-and-threads-hybrid-processors-for-todays-multitasking-world)

**Local measurements on this machine (2026-07-23):** `GetLogicalProcessorInformationEx` topology dump ·
`Get-Counter` Processor Information sample + counter-list · pwsh→node affinity-inheritance test ·
`powercfg /getactivescheme`, `/qh SUB_PROCESSOR`, `/powerthrottling /?` · `ms-playwright` binary census.

## §10.11 usefulness gate — deposit-worthy (not deposited; research-only task)

The global graph demonstrably lacks all Windows-scheduling vocabulary (§0). Genuinely reusable across
projects and worth a future `graphify add` pass as a `windows-scheduling-docs` (or extending
`playwright-docs`) tag: the **Quality of Service** page, **SetProcessInformation** (the only page with the
EcoQoS code samples), **CPU Sets**, **Scheduling Priorities**, **SetProcessAffinityMask**, the
**SchedulingPolicy** power-setting page, and Playwright's **class-testproject** + **release-notes** (the
per-project-workers fact that this repo's config comments and two prior research docs all believed
impossible). One-off, skip: the Intel marketing-tier explainers, the b&w spec pages.
