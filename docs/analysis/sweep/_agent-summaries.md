# Agent returned summaries — verbatim

Each agent writes a full report file in this directory AND returns a compact summary to the controller.
Those returned summaries are recorded here **verbatim**, because a summary can carry a verdict or caveat
phrased differently from the report file. Nothing is paraphrased in this document.

Controller corrections (where a claim was independently verified and found wrong) are added as clearly
marked `> CONTROLLER:` notes beneath the relevant summary — the original text is never edited.

---

## W1-H · Probe & sous-vide telemetry feasibility
**Completed:** 2026-07-22 · **Report:** `W1-H-probes.md` · **Cost:** ~134k tokens, 40 tool uses

**Browser-BLE verdict:** Web Bluetooth works today on Android Chrome/Edge/Samsung Internet and desktop Chromium (proven with a live BBQ-probe demo), but is completely absent on iOS/iPadOS Safari with no Apple roadmap — hard platform wall, not a version gap. Even on Android, a backgrounded/screen-off tab cannot reliably hold a GATT connection for a 12+ hour cook; this is a page-lifecycle limit, not a fixable bug.

| Vendor | BLE spec | Cloud API | Verdict |
|---|---|---|---|
| Meater | reverse-engineered only | **Yes (official beta)** | Cloud API, not BLE |
| ThermoWorks | none found | none (CSV export only) | Neither — log-import only |
| Inkbird | reverse-engineered per-model | none (CSV export) | Neither — log-import |
| Combustion Inc | **Yes, open MIT-licensed spec** | no | Best case for direct BLE |
| Govee | reverse-engineered advertisements | none (CSV export) | Neither — log-import |
| Weber Connect | none (WebSocket, encrypted) | none (CSV export) | Neither — log-import |
| Anova | **Yes (WiFi models)** | **Yes, official, open to all** | Best case overall — BLE + cloud |
| Joule | Bluetooth for pairing only | none found | Neither |

**iOS blocker:** absolute for native Web Bluetooth; only workaround is Bluefy, a niche third-party iOS browser bridging to CoreBluetooth — real but poor UX, unclear if it works with an installed PWA.

**Staged recommendation:** (1) log-import first — CSV upload from vendor apps (ThermoWorks/Weber/Govee/Inkbird all export it), works identically on iOS/Android, zero new permissions; (2) Anova cloud API for WiFi sous-vide models — plain HTTPS, no Bluetooth, works on iOS too (pending a CORS check, likely needs a thin proxy); (3) MEATER Cloud REST API, same shape, officially beta; (4) Web Bluetooth live readings via Combustion Inc's open GATT spec, scoped explicitly as Android/desktop-only, screen-on, not a background/unattended feature.

> **CONTROLLER:** accepted as-is. This axis was feasibility research, not an audit — the app has no probe
> integration today beyond `probeChannels()` summing channels into a footer chip (app.js:229, ~6425), and
> `navigator.bluetooth` appears nowhere. The finding that materially changes product thinking: **live BLE
> cannot be the primary design** (iOS wall + no background GATT over a long cook), so log-import must be the
> baseline path and live BLE an Android/desktop enhancement. Anova's official open API is the one place
> live sous-vide telemetry is genuinely reachable on every platform.
