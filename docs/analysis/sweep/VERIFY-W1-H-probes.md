# VERIFY-W1-H — Adversarial verification of `W1-H-probes.md`

Verifier: adversarial (attempted refutation of every substantive claim)
Date: 2026-07-22
Method: (a) opened every cited `app.js:line` and re-derived the claim; (b) grepped repo-wide for the
claimed-missing mechanisms under other names; (c) fetched every external source and checked it actually
says what the report attributes to it. No source file modified.

**Counts: 28 CONFIRMED · 8 REFUTED · 4 UNVERIFIABLE (40 substantive claims).**

Headline: the report's *code* section is accurate line-for-line, and its two lead recommendations (Anova
official API, log-import CSV) survive verification. Eight claims fail — one of them (the MEATER
"previous-cook via API" path in §3) is load-bearing for recommendation #3's framing, and one
(`watchAdvertisements()`) invalidates the "Govee is the easiest target" framing.

---

## 1. Section 0 — current state in code

| # | Claim | Verdict | Independent evidence |
|---|---|---|---|
| 1 | `probeChannels()` at `app.js:229` sums `cap.channels` over `equipByCat('probe')`; renders one static footer chip at `app.js:6425`; no live data | **CONFIRMED** | `app.js:229` is verbatim the reduce; `app.js:6425` is the `🎯 …probes · …channels` template. `grep -n probeChannels app.js` → only 229 and 6425. Display-only. |
| 2 | `navigator.bluetooth` absent; zero Bluetooth code | **CONFIRMED (stronger)** | Repo-wide `grep -rn "navigator\.bluetooth\|requestDevice\|GATT\|gatt" --include=*.js --include=*.py --include=*.html --include=*.ts` (node_modules excluded) → **zero hits**, not just in `app.js`. |
| 3 | `channels` capacity at `app.js:85` (`capKey:'channels'`), `accuracy` at `app.js:88` (`bounds:[0.1,5]`, unit `±°C`) | **CONFIRMED** | Both lines exact, in the `{cat:'probe', …}` block. |
| 4 | …"that nothing currently reads" | **REFUTED (wording)** | `chipsFor()` at `app.js:6388`, loop at `6394-6399`, generically renders **every** declared prop — `d.cap[p.key]` — as a device chip, so `accuracy` **is** read and displayed (and is editable in the equipment form). What is true, and what §5.3 says correctly ("decorative"), is that *no planning/safety logic consumes it*: `grep -n accuracy app.js` returns only the definition at :88 plus unrelated cure-scale lines (1835, 1869-1871, 1924). Substance survives; the phrase does not. |
| 5 | `copilotPace` (`5395-5416`) consumes `session.probes[]`; stall = flat 65–77 °C; ETA/verdict vs `serveTs`; readings appended **only** by manual `copilotLogProbe` (`5381`), wired to `#copProbe`/`#copProbeLog` | **CONFIRMED** | `5395` = `function copilotPace(session){`, closing brace at `5416`. Stall test at `5408`: `if(rate<=1 && b.tempC>=65 && b.tempC<=77)`. Verdict at `5413-5414` against `s.serveTs-(s.restMin||0)*60000`. Sole writer to `s.probes` is `5381`; its sole caller is the click handler at **`app.js:5512`**. Minor: the cited UI range `5471-5484` also spans the Timing/adjust card — the actual input+button is `app.js:5476`. |
| 6 | `bcheck` is the manual safety gate at `3261`, `5159-5161`, `5815`, `5993` | **CONFIRMED** | All four exact. `3261` builds the stage; `5159-5161` is the voice branch ("check with a probe before serving"); `5815` the task row; `5993` the timeline row commented "D1: internal-temp safety gate". |

## 2. Section 1 — Web Bluetooth reality

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 7 | Chrome 56+, Edge 79+, Opera 43+, Samsung Internet 6.2+; ~76 % global | **CONFIRMED** | caniuse.com/web-bluetooth: **76.78 %**, and those exact version floors. |
| 8 | Safari (macOS + iOS) and Firefox implement none of it — hard wall | **CONFIRMED** | caniuse: Safari unsupported 3.1 → 26.5-TP; Firefox unsupported 2 → 155; Mozilla's standards position is "Harmful". |
| 9 | Bluefy is a real shipping iOS browser that bridges Web Bluetooth to CoreBluetooth | **CONFIRMED** | App Store listing: "smart Web Browser with support of advanced IoT technology — Web Bluetooth APIs!… connect to remote GATT Servers over a BLE connection." |
| 10 | Bluefy requires "iOS 11+" | **REFUTED** | Same App Store listing: **"Requires iOS 12.0 or later."** |
| 11 | mattdsteele gist = working `navigator.bluetooth` BBQ-probe client | **CONFIRMED** | Gist README: "Tested on Chrome for Android, and OS X"; hardcoded custom service `2899fe00-c277-48a8-91cb-b29ab0f01ac4`; temp via `startNotifications()` + `value.getUint16(12,true)/10`. |
| 12 | Quote *"A PWA that runs a Bluetooth-connected service in the background, like a native app, is currently not possible on any platform"* (Chrome team framing) + "Bluetooth traffic is throttled once a tab is backgrounded and further throttled once the screen turns off" — sourced to Progressier | **REFUTED (citation)** | Two independent fetches of `progressier.com/pwa-capabilities/bluetooth`, the second asking for *every* sentence containing "background/throttl/screen/native app", returned only: "Just like a native app, a PWA can connect to nearby devices via Bluetooth…" and "If your app requires Bluetooth on iOS, you will have to create a native app rather than a PWA." **The quoted sentence is not on that page, and there is no throttling text at all.** Progressier is also a third-party PWA vendor, not "the Chrome team". The throttling mechanics have no verified source → **DROP them**. |
| 13 | Substance: a web page cannot hold a background Bluetooth service | **CONFIRMED (re-sourced)** | MDN *Web Bluetooth API*: "**This API is not available in Web Workers** (not exposed via `WorkerNavigator`)" — so no Service Worker path; plus secure-context and **transient activation** requirements. WebBluetoothCG/web-bluetooth issue **#422** ("Service Worker support for WebBluetooth"), opened 2018-12-16, still **open/unimplemented**. Conclusion stands on better evidence than the report cited. |
| 14 | An Android foreground service is a native-only escape hatch, not a Web Bluetooth concept | **CONFIRMED** | developer.android.com …/ble/background: "Start a foreground service with the `connectedDevice` type… foreground service launch restrictions apply starting in Android 12"; and connections "are closed if your process is killed". It is native-app guidance throughout. |
| 15 | Deep Doze defers scans / drops connections when screen-off and stationary | **UNVERIFIABLE** | The cited Android page does **not** say this (no Doze/screen-off/stationary discussion). The only other cite is `devsflow.ca`, a low-authority personal blog I could not corroborate against Android documentation. Directionally plausible, not evidenced. |
| 16 | Screen Wake Lock is released automatically once the tab is backgrounded/minimized | **CONFIRMED** | Progressier wake-lock page, verbatim: "If the user minimizes a tab, closes a window, or navigates away from the PWA in which a screen wake lock is active, the lock will be released automatically." |
| 17 | …"it drains battery" and "a `visibilitychange` handler can attempt to re-acquire it" | **UNVERIFIABLE from the cited sources** | Neither statement appears on the cited Progressier page. (Both are standard MDN guidance, but the report's citations do not carry them.) |
| 18 | Bottom line: a 12 h screen-off unattended GATT connection cannot be trusted | **CONFIRMED** | Follows from #13 (no worker/background context, transient-activation gated) + #16 (wake lock dies with visibility). |

## 3. Section 2 — vendor landscape

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 19 | MEATER probe BLE has no official spec; only reverse-engineering (`nathanfaber/meaterble`) | **CONFIRMED** | Repo: "The goal of this project is to reverse engineer the communicaton with Meater Bluetooth Low Energy probes"; documents proprietary handles 31/43, no standard service. |
| 20 | MEATER Cloud REST API: official-but-BETA, JWT, `/login` `/devices` `/devices/{id}`, internal+ambient+target+elapsed/remaining, 2 req/60 s recommended & 60/60 s max, requires app-or-Block bridging | **CONFIRMED (verbatim)** | apption-labs README: "The MEATER Cloud REST API is in BETA."; `Authorization: Bearer <JWT>`; those three endpoints; "Recommended: 2 requests per 60 seconds. Maximum: 60 requests per 60 seconds."; "The MEATER app or Block must have an active Bluetooth connection with the device" **and** "an active MEATER Cloud connection." |
| 21 | ThermoWorks: no public BLE spec, no official API, CSV/Excel export exists, `thermoworks-cloud` is unofficial reverse-engineering | **CONFIRMED** | help.thermoworks.com: "Export data to an Excel 2007+ or .csv file" (+ .pdf/.png/.jpg graphs), **no API mentioned anywhere**. PyPI/GitHub `a2hill/python-thermoworks-cloud`: "unofficial library written using the observed behavior of the ThermoWorks Cloud web client" (GPLv3). |
| 22 | Inkbird: community reverse-engineering only; auth handshake + FF00 service telemetry | **CONFIRMED** | home-assistant discussion #716: INT-12-BW, BLE auth function reverse-engineered from the official Android app, FF01 telemetry ("int16_t little-endian °C×10"), explicitly *no* official spec, published MIT. |
| 23 | Inkbird apps export CSV history up to 2 years, per-probe | **UNVERIFIABLE** | Sole cite is an Inkbird community forum post; not independently corroborated by vendor documentation. Low stakes, but not evidence-backed. |
| 24 | Combustion Inc: fully open MIT BLE probe spec + official iOS (Swift) and Android (Kotlin) SDKs; probe advertises data openly | **CONFIRMED** | github.com/combustion-inc: `combustion-documentation` = "Probe BLE specification and other public documentation"; `combustion-ios-ble` (Swift) and `combustion-android-ble` (Kotlin), MIT. Advertisement-based data corroborated by the Python SDK docs ("temperatures and other data are continually updated by incoming BLE advertising messages"). |
| 25 | …"and a Python package (`combustion-ble`, using `bleak`)" listed inside the "**Yes — fully open, official**" cell | **REFUTED (attribution)** | `combustion-ble` on PyPI is **community**, authored by legrego (`github.com/legrego/combustion_ble`) — it is **not** under the `combustion-inc` org (whose 8 repos contain no Python SDK). The `bleak` dependency is correct; the "official" framing is not. |
| 26 | Govee: BLE-advertisement decoding, no pairing; HA `govee_ble` integration built on it | **CONFIRMED** | GoveeWatcher: "The Govee H5075 Thermometer Hygrometer broadcasts the current temperature and humidity through Bluetooth low energy (BLE) advertisement data." HA `govee_ble` lists meat thermometers H5191, 5055, 5181-5185, 5198. |
| 27 | …"two-byte temp/humidity values" | **REFUTED** | GoveeWatcher documents **three** octets concatenated into one integer carrying *both* values: `03 21 5d` → 205149; temp = /10000 = 20.5149 °C, humidity = %1000/10 = 14.9 %. Not two bytes, and not two separate values. |
| 28 | Govee Home exports ~2 years of history to CSV by email | **CONFIRMED (better source)** | Govee's own FAQ "How to export data" + 2-year cloud storage on product pages. (The report cited an Amazon Q&A — weak; the claim nevertheless holds.) |
| 29 | "Web Bluetooth can technically read advertisement data via `watchAdvertisements()`" — making Govee "the easiest reverse-engineering target of any vendor here" | **REFUTED (material)** | WebBluetoothCG `implementation-status.md`: "The `getDevices()` and `watchAdvertisements()` APIs are **behind the `chrome://flags/#enable-experimental-web-platform-features` 🚩 flag**" (Chrome 85 🚩 on ChromeOS/Android/Mac). A shipped browser **cannot** read raw BLE advertisements without the user manually enabling an experimental flag — so this is not a buildable path for real users, and Govee is *not* the easiest target. Combustion (GATT connect, no flag) is strictly easier. |
| 30 | Weber: no official spec; BLE for pairing then encrypted cloud/WebSocket; RE incomplete; `sanjay900/igrill` community; CSV export | **CONFIRMED** | HA thread 194199: "The first connection must be Bluetooth, then the device connects over WiFi (to AWS over TCP 443)"; "I believe I have the decryption key but I need to test" (latest activity Jan 2024, still incomplete); Weber support: "we are not able to give this information out". `sanjay900/igrill` is a community HACS integration. Weber Connect 2.0 CSV graph export confirmed via Weber's own 2023 release material. |
| 31 | Anova publishes BLE UUIDs; Nano = Protocol Buffers + COBS; older models JSON+Base64 | **CONFIRMED** | developer.anovaculinary.com/docs/devices/nano/overview: service `0e140000-0af1-4582-a242-773e63054c68` (TX `…0001`, RX `…0002`, Async `…0003`) — **exact match** to the report; "Commands and responses use Protocol Buffers"; "Message framing uses Consistent Overhead Byte Stuffing". The JSON/Base64 path is the **Mini** (`/docs/devices/mini/ble-protocol`); A2/A3 use a text protocol — so "older models" is loose but not wrong. |
| 32 | Anova ships an official public Developer API "available to everyone", covering BLE **and** WiFi/cloud, exposing setpoint/stage/remaining time/sensor status/history | **CONFIRMED (verbatim)** | Anova blog: "available to everyone"; covers "connected Precision® Cooker and Precision™ Oven products"; "Whether your device communicates over Bluetooth or Wi-Fi, the API can be used to read the current state"; exposes "temperature setpoints, cooking stage, remaining time, sensor status" plus historical telemetry for charting. |

## 4. Section 3 — log-import fallback

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 33 | Every non-open vendor converges on in-app CSV export; a paste/upload log-import is buildable today and platform-neutral | **CONFIRMED** | ThermoWorks (#21), Weber (#30), Govee (#28) each verified from vendor material; the feature needs no permission, no BLE, no API. |
| 34 | "a GitHub discussion specifically covers pulling previous-cook info via the API — so import doesn't strictly need a file, it could poll the same JSON the app uses" | **REFUTED** | meater-cloud-public-rest-api **discussion #34** is an *unanswered customer complaint* (0 comments, no maintainer reply) that "Previous Cooks" shared via weblink show incorrect data — it does not describe, let alone confirm, retrieving previous-cook data via the API. Worse, the API's own README (#20) exposes only `/devices` and `/devices/{id}` *current* state, and returns a device **only while the app or Block holds an active Bluetooth + Cloud connection** — so MEATER Cloud cannot act as a retrospective log source at all, and can only be polled *during* a cook the phone app is already bridging. |

## 5. Section 4 — sous-vide circulators

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 35 | Anova WiFi bath temp/setpoint readable from a browser over HTTPS via the official cloud API — the best cross-platform integration in the survey | **CONFIRMED** | Per #32; WiFi device auth/endpoints documented at `/docs/devices/wifi/authentication`. |
| 36 | Joule: "once the cook has started, Joule will continue maintaining temperature even if you leave Bluetooth range," **implying it relies on Wi-Fi/cloud for anything beyond the initial pairing** | **REFUTED (inference)** | The quote is real, but the *same* ChefSteps article continues: "**Additionally, to make changes during a cook, you will need to be back within Bluetooth range.**" That is the opposite implication — the device cooks autonomously with *no* connection, and control requires returning to BLE range; it does not evidence Wi-Fi/cloud dependence. (The cited section URL also 403s; the quote lives in the "Pairing… using Bluetooth only" article.) The separate claim that no public Joule API exists is not contradicted by anything found. |
| 37 | CORS behaviour of the Anova / MEATER cloud APIs | **UNVERIFIABLE** | Cannot be settled from the repo or from documentation — neither vendor documents `Access-Control-Allow-Origin`; it requires a live cross-origin request with real credentials. The report already flags this honestly and proposes a proxy; that hedge is correct. |

## 6. Sections 5–6 — what it unlocks / recommendation

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 38 | `copilotPace()` is agnostic to how readings arrive; wiring one source needs zero changes to the pace math | **CONFIRMED** | `copilotPace` (`5395-5416`) is a pure function of `session.probes`; the only writer is `copilotLogProbe` (`5381`), invoked from exactly one place (`5512`). A poller calling `copilotLogProbe(v)` is a drop-in. |
| 39 | `probeChannels()` is an inert display count that could become a real gear-gap check | **CONFIRMED** | Only consumer is the footer template at `6425` (plus `tests/equipment.spec.ts`, `tests/equipment-props.spec.ts`). No planning code reads it. |
| 40 | Staged ordering (log-import → Anova cloud → MEATER cloud → Combustion Web Bluetooth) | **CONFIRMED, with one correction** | Ordering follows from the verified evidence. Correction from #34: step 3 (MEATER) must be described as **live-only, and only while the user's MEATER app/Block is actively bridging** — it is not a retrospective import path, and it cannot be polled when the user's phone app is closed. |

---

## What to change in `W1-H-probes.md`

1. **Delete** the Progressier background-Bluetooth quotation and the throttling sentence; replace with MDN ("not available in Web Workers", transient activation required) + WebBluetoothCG issue #422. Do not attribute anything to "the Chrome team" that came from a vendor blog.
2. **Rewrite §3's MEATER bullet.** Discussion #34 does not say what it is cited for; the API returns live state for currently-bridged devices only. MEATER is not a log-import source.
3. **Add the flag caveat to `watchAdvertisements()`** and drop "easiest reverse-engineering target of any vendor here" for Govee — that path needs `chrome://flags/#enable-experimental-web-platform-features`.
4. **Fix the Joule inference** — the source says you must return to Bluetooth range to change anything.
5. **Move `combustion-ble` out of the "official" cell** (community, legrego).
6. Small factual fixes: Bluefy is **iOS 12.0+**; Govee advertisements are **three** concatenated octets encoding temp *and* humidity; `accuracy` **is** rendered (`chipsFor`, `app.js:6394-6399`) — say "no logic consumes it", not "nothing reads it".
7. Drop or re-source the unevidenced details: Android Doze scan-deferral, wake-lock battery drain / `visibilitychange` re-acquisition, Inkbird 2-year CSV export.
