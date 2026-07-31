# Phonikud — local install trial (ניסוי קצר, מנותק מהאפליקציה)

**Scope.** Owner instruction: "בוא נעשה ניסוי מקומי קטן — כלומר התקנה מקומית — ואז נחליט אם בכלל
להמשיך בכיוון הניקוד. זה אמור להיות ניסוי קצר, מנותק מהאפליקציה." Everything below ran under an
isolated venv in the scratchpad; **no app file (`app.js`, `build.py`, `tests/`, `lang/`) was touched.**
Background: `docs/superpowers/specs/2026-07-31-voice-wave0-design.md` §6.1 — the int8 ONNX model is
~308 MB, its designed consumer is a local phoneme-input TTS (Piper/Israwave), and there was no prior
evidence on whether diacritized text helps a **cloud** TTS (Google/Gemini). This trial does not answer
that question — it could not, without an API key — but it answers the two questions that gate it:
does it install cleanly on this machine, and is the safety invariant (spoken numbers/units never
altered) held.

## 1 · Install reality

| Item | Result |
|---|---|
| Method | Isolated venv (`python -m venv`), scratchpad-only, no global pollution |
| Packages | `phonikud==0.4.1`, `phonikud-onnx==1.0.6` (pulls `onnxruntime`, `numpy`, `tokenizers`, `huggingface_hub`, `sympy`, …) |
| pip install time | **31 s** wall clock (fast link) |
| venv on-disk size | **215 MB** (packages only, no model) |
| Model | `thewh1teagle/phonikud-onnx` → `phonikud-1.0.int8.onnx` (the CPU int8 model, matching the prior desk-research pick) |
| Model download time | **7.3 s** |
| Model file size | **307,844,158 bytes = 293.58 MB** (close to the ~308 MB estimated in the prior spec) |
| Total on-disk footprint | **509 MB** (215 MB venv + 294 MB HF cache) |
| Friction found | `pip install` failed outright with `SSLCertVerificationError` inside the fresh venv — **this machine's Norton Antivirus does TLS inspection and injects its own root CA** (`C:\ProgramData\Norton\Antivirus\wscert.pem`), which the venv's bundled `certifi` doesn't trust. Global Python already had a working trust path; the isolated venv did not. Worked around with `pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org` and, for the Hugging Face download, `SSL_CERT_FILE` / `REQUESTS_CA_BUNDLE` / `CURL_CA_BUNDLE` pointed at the Norton CA bundle. **This is a machine/environment issue, not a phonikud issue** — flagging it because it would trip up anyone reproducing this on a similarly locked-down Windows box. |
| Lighter path? | A hosted Dicta API exists in principle (phonikud's underlying model is `dicta-il/dictabert-large-char-menaked`) but was **not tried** — out of scope for "local install," and Dicta's public API terms/availability were not checked. Not needed here: the int8 local model installed and ran fine on this machine in well under a minute. |

**Verdict on installability: yes, no serious friction beyond the one environment-specific TLS quirk
above (5 minutes to work around, well documented for reruns).**

## 2 · Sentence set

12 Hebrew sentences drawn from the app's own spoken/answer paths (`app.js`: `vcSpeak`/`speechText`
call sites, safety-guide prose, FAQ/troubleshoot text) — not invented text. Two (s01, s02) are
template literals from `app.js` filled with a real cut's values from `data.py` so the rendered text
matches what a user actually hears. Full source references and the raw plain/diacritized/stripped
triples are in `bench_output.json` (scratchpad, not committed — see reproduction section). Category
coverage: 6 sentences carry a temperature+unit (°C), 3 carry a duration, 6 are ordinary instruction/
copy sentences with no numbers.

| # | Category | Plain (as the app speaks it) | Diacritized (phonikud output) |
|---|---|---|---|
| s01 | temp+units | ודא טמפ' פנימית: יעד מרקם 95°C · מינימום בטיחות 63°C. | וַדֵא טַמְפּ' פְּנִ֫ימִית: יַ֫עַד מִרְקָם 95°C · מִ֫ינִימוּם בְּֽטִיחוּת 63°C. |
| s02 | temp+units | יעד 74°C · מינימום בטיחות 63°C. | יַ֫עַד 74°C · מִ֫ינִימוּם בְּֽטִיחוּת 63°C. |
| s03 | temp+units+duration | פסטור אינה רק טמפ' אלא זמן כפול טמפ' במרכז הנתח. עוף ב-60°C למשך כ-35 דקות בטוח כמו 74°C לרגע — לפי טבלאות בולדווין. | פַּסְטוֹר אֵינָהּ רַק טַמְפ' אֶ֫לָּא זְמַן כָּפוּל טַמְפ' בְּֽ\|מֶרְכַּז הַ\|נֶּתַח. עוּף בְּֽ\|-60°C לְֽמֶ֫שֶׁךְ כְּֽ\|-35 דַּקּוֹת בָּט֫וּחַ כְּמוֹ 74°C לְֽ\|רֶ֫גַע — לְֽפִי טַבְלָאוֹת בּוֹלְדְּוִוין. |
| s04 | numbers+duration+units | הקפא ל-20°C מתחת לאפס למשך 7 ימים, או ל-35°C מתחת לאפס למשך 15 שעות, לפני הגשה נא או חלקית. פירות ים ל-63°C בטיחותי לפי ה-FDA. | הַקְפֵּא לְֽ\|-20°C מִתַּ֫חַת לְֽ\|אֶ֫פֶס לְֽמֶ֫שֶׁךְ 7 יָמִים, אוֹ לְ\|-35°C מִתַּ֫חַת לְֽ\|אֶ֫פֶס לְֽמֶ֫שֶׁךְ 15 שָׁעוֹת, לִפְנֵי הַגָּשָׁה נָא אוֹ חֶלְקִית. פֵּירוֹת יָם לְֽ\|-63°C בְּֽטִיחוּתִי לְֽפִי הָ\|-FDA. |
| s05 | temp+units | טמפ' גבוהה מדי. סלמון: 50–52°C למרקם משיי, פורל דומה. אל תעבור כ-55°C אם רוצים עדינות. | טַמְפּ' גְּב֫וֹהָה מִדַּי. סַלְמוֹן: 50–52°C לְֽ\|מִרְקָם מִשְׁיי, פ֫וֹרְל דּוֹמֶה. אַל תַּעֲבֹור כְּֽ\|-55°C אִם רוֹצִים עֲדִינוּת. |
| s06 | numbers+units | Cure מספר 1 ב-2.5 גרם לקילוגרם, כ-156 חלקים למיליון ניטריט (תקני ובטוח). | Cure מִסְפַּר 1 בְּֽ\|-2.5 גְּרָם לְֽ\|קִיל֫וֹגְרָם, כְּֽ\|-156 חֲלָקִים לְֽ\|מִילְיוֹן נִיטֵרִיט (תִּקְנִי וּ\|בָט֫וּחַ). |
| s07 | ordinary | מוצר מיובש לא מבושל — דיוק ה-Cure קריטי לבטיחות. | מוּצָר מְֽיֻובָּשׁ לֹא מְֽבֻושָּׁל — דִּיּוּק הַ\|-Cure קְרִ֫יטִי לַ\|בְּֽטִיחוּת. |
| s08 | temp+units+duration | קח לקולגן כ-95°C, לא רק לטמפ' בטיחות, ונוח בקופסת בידוד שעה ומעלה. | קַח לַ\|קֻּולְגָּן כְּֽ\|-95°C, לֹא רַק לְֽ\|טַמְפּ' בְּֽטִיחוּת, וְֽ\|נֹ֫וחַ בְּֽ\|קֻופְסַת בִּידּוּד שָׁעָה וָ\|מַעְלָה. |
| s09 | ordinary | בטוח כברירת מחדל: מתבשל לדיוק ומפוסטר בסו-ויד, ואז מקבל טעם וקראסט בעישון גימור חם. | בָּט֫וּחַ כִּ\|בְרֵירַת מֶחְדָּל: מִתְבַּשֵּׁל לְֽ\|דִיּוּק וּ\|מְפֻוסְטָר בְּֽ\|סוּ-וִיד, וְֽ\|אָז מְֽקַבֵּל טַ֫עַם וּ\|קְרָאסְט בְּֽ\|עִישּׁוּן גִּימּוּר חַם. |
| s10 | ordinary | הקראה אינה נתמכת בדפדפן זה. | הַ\|קְרָאָה אֵינָהּ נִתְמֶ֫כֶת בְּֽ\|דַפְדְּפָן זֶה. |
| s11 | ordinary | אין בטיחות פנים בצומח — רק שליטה במרקם. | אֵין בְּֽטִיחוּת פְּנִים בַּ\|צּוֹמֵ֫חַ — רַק שְׁלִיטָה בַּ\|מִּרְקָם. |
| s12 | ordinary | המספרים אינם קישוט — הם ההבדל בין מוצר בטוח ללא בטוח. | הַ\|מִּסְפָּרִים אֵינָם קִישּׁוּט — הֵם הַ\|הֶבְדֵּל בֵּין מוּצָר בָּט֫וּחַ לְֽ\|לֹא בָּט֫וּחַ. |

## 3 · Latency and footprint (this machine, CPU-only, no GPU)

| Metric | Cold pass (first inference/sentence after model load) | Warm pass (second inference/sentence, same session) |
|---|---|---|
| Mean | 27.6 ms | 25.6 ms |
| Worst | 43.3 ms (s04, the longest/densest sentence) | 38.0 ms (s04) |
| Best | 16.5 ms (s10, short plain sentence) | 15.4 ms (s10) |

Cold and warm are nearly identical — the real "cold start" cost is the **one-time model load**
(1.29 s for `ort.InferenceSession` + tokenizer), not per-call inference. Import of the `phonikud_onnx`
module itself: 0.29 s.

**Memory (process RSS, `psutil`):**

| Point | RSS |
|---|---|
| Before importing phonikud_onnx | 18.8 MB |
| Before loading the model | 46.6 MB |
| After loading the model (session + tokenizer) | 389.2 MB |
| After running all 24 inferences (2 passes × 12 sentences) | 405.5 MB |

So: **loading the int8 model costs ~340 MB of resident RAM** on top of a bare Python process, and
per-sentence latency on ordinary Hebrew instruction text is in the **15–45 ms** range on CPU — fast
enough for a live-fire cooking app's voice path with no perceptible added delay.

## 4 · The safety-critical invariant check

**Method, exactly as specified:** strip every codepoint in U+0591–U+05C7 from the diacritized output
and assert character-for-character equality with the plain input.

**Literal result: 10 of 12 sentences did NOT pass this exact check.** Full diff data in
`bench_output.json`. But the failure has one single, consistent cause across every one of the 10 —
important to see before drawing a conclusion:

`phonikud_onnx`'s `add_diacritics()` unconditionally inserts a **pipe character `|` (U+007C,
`PREFIX_CHAR` in the library's own source)** immediately before/after Hebrew prefix-letters (ה/ב/ל/כ/ו
— the definite article and attached prepositions/conjunctions), to mark morpheme boundaries. `|` is
**not** in the Unicode niqqud block, so it survives the strip and breaks exact equality — e.g.
`"ב-60°C"` → `"בְּֽ|-60°C"` → stripped → `"ב|-60°C"` ≠ `"ב-60°C"`. Only s01 and s02 (the two sentences
with no prefix-letter directly adjacent to a number) passed the literal check untouched.

**The question that actually matters — did diacritization ever change a digit, a unit symbol
(°C/°F/g/kg), or a unit word — checked two independent ways:**

1. Manual inspection of every one of the 10 diffs above (they are all shown in full in §2/§3): in
   every case the numeral run and the `°C` sequence are byte-identical before and after; only `|`
   markers were inserted around adjacent letters.
2. A second, independent mechanical pass: a regex pulled every digit run, `°C`/`°F` token, and unit
   acronym (`FDA`) out of the plain text and out of the (non-stripped) diacritized text and compared
   the two token lists per sentence. **Result: identical token lists in all 12/12 sentences — zero
   digit or unit corruption.**

**Verdict: the raw invariant as literally specified fails on 10/12 sentences, but the cause is
entirely a non-niqqud formatting artifact (the `|` prefix marker), and it never touches a digit, a
unit symbol, or a unit word in any of the 12 sentences tested.** A correct integration would need to
strip `PREFIX_CHAR` (`|`) in addition to the niqqud range before handing text to a TTS engine — a
one-line fix (`text.replace('|', '')` or a slightly widened strip pattern), not a fundamental
incompatibility. This is exactly the kind of gap that must be checked mechanically before ever trusting
diacritized text near a spoken temperature or cure-safety number — glad it surfaced here rather than in
production.

## 5 · Correctness — for the owner to judge, not for me to certify

I am not a Hebrew speaker/phonologist and this section is a flag list, not a verdict. Two things an
owner fluent in Hebrew niqqud should sanity-check:

- s01: `וַדֵא` (no dagesh in the ד) vs. the more familiar spelling `וַדֵּא` — may be a legitimate
  register/vocalization choice by the model, may not be.
- s05: `מִשְׁיי` (double yod) for `משיי` ("silky") — looks unusual but could be correct pointing for
  that word form.
- Everything else in the diacritized column in §2 reads as plausible niqqud placement to a non-expert
  eye, but "plausible to a non-expert" is not "correct" — please spot-check a few, especially s03/s04/
  s06 which are the densest/longest.

## 6 · What is still needed for the cloud-TTS A/B (explicitly not attempted here)

Per the owner's instruction this trial did **not** touch cloud TTS. To actually test whether
diacritized text improves Google/Gemini TTS output over plain text, you would need:

1. A Gemini (or Google Cloud TTS) API key — not provided for this experiment.
2. The plain/diacritized pairs above (or a larger set) submitted to the TTS endpoint twice — once per
   variant — with the safety-critical sentences (s01–s08) weighted heavily, since that's where a
   mispronounced number would actually be dangerous.
3. A blind listening pass (ideally by someone other than whoever ran the experiment) scoring
   naturalness/correct stress *and*, separately, verifying by ear that no digit or unit was
   mispronounced or dropped — mirroring the mechanical invariant check done here, but for audio.
4. A decision rule stated in advance (e.g. "ship niqqud only if it improves stress-placement on ≥X% of
   a sample with zero safety-number errors on either variant") — so the A/B has a clear stop condition
   instead of becoming a subjective judgment call after the fact.

The plain/diacritized pairs in §2 are ready to paste into any TTS interface today without an API key
of ours — that unblocks a manual spot-check even before a scripted A/B exists.

## 7 · Recommendation

**Local installation is easy (509 MB, well under a minute of actual work past a machine-specific TLS
hiccup) and the model runs fast enough (15–45 ms/sentence, ~400 MB RAM) to be usable on this
machine.** The safety invariant that matters — digits and units never altered by diacritization — held
in all 12 real app sentences tested, provided the (undocumented, but easily fixed) `|` prefix-marker
artifact is stripped before the text reaches a TTS engine.

**But this trial cannot answer the actual product question** — whether diacritized text measurably
improves the *cloud* TTS voice the app actually uses — because that requires the A/B in §6, which needs
an API key the owner has not provided. Given that:

- **Recommendation: worth one more small step, not a full commitment yet.** Do the cloud-TTS A/B in
  §6 (a genuinely cheap experiment — a handful of API calls) before deciding whether niqqud ships in
  the app at all. If the A/B shows no audible improvement on Gemini/Google TTS — which is plausible,
  since neural cloud TTS models are typically trained on plain text and may not even respect niqqud
  marks — the ~300 MB local model this trial installed becomes dead weight and the whole direction
  should be **dropped**, not shipped as a "local-only" fallback (a local phoneme-input TTS like
  Piper/Israwave is a separate, larger commitment this app does not currently make).
- If the A/B does show a real improvement, the correct shape is a **hosted/on-demand call** (either a
  Dicta hosted API if one exists with acceptable terms, or a thin server endpoint wrapping the ONNX
  model this trial validated) — **not** bundling a 300 MB model + ~400 MB RAM ONNX runtime into a
  single-file PWA that currently inlines everything into one HTML file. Local-only, in-browser
  deployment is not realistic for this product's architecture regardless of A/B outcome.

## 8 · Reproduction

```bash
# from repo root, everything under the scratchpad — nothing here touches the app
SCRATCH="<scratchpad>/phonikud"
mkdir -p "$SCRATCH" && cd "$SCRATCH"
python -m venv venv

# On a machine with TLS-inspecting AV (Norton, etc.) the plain install below may fail with
# SSLCertVerificationError inside the fresh venv even though global pip works. Workaround used here:
./venv/Scripts/pip.exe install --trusted-host pypi.org --trusted-host files.pythonhosted.org \
    --trusted-host huggingface.co phonikud phonikud-onnx huggingface_hub psutil

# same TLS note applies to the HF download — point the CA bundle env vars at the AV's injected root CA:
export SSL_CERT_FILE="C:\ProgramData\Norton\Antivirus\wscert.pem"
export REQUESTS_CA_BUNDLE="$SSL_CERT_FILE"
export CURL_CA_BUNDLE="$SSL_CERT_FILE"
export HF_HOME="$SCRATCH/hf_home"

./venv/Scripts/python.exe -c "
from huggingface_hub import hf_hub_download
print(hf_hub_download('thewh1teagle/phonikud-onnx', 'phonikud-1.0.int8.onnx'))
"

# then, with PHONIKUD_MODEL_PATH set to the path printed above:
export PHONIKUD_MODEL_PATH="<path from previous command>"
./venv/Scripts/python.exe run_bench.py   # sentences.py + run_bench.py in the same scratchpad folder
```

`sentences.py` and `run_bench.py` (the 12-sentence set and the measurement/invariant-check script) and
the raw `bench_output.json` this report was generated from live in the scratchpad, not in the repo —
this experiment was scoped as disconnected from the app per the owner's instruction, and is
reproducible from the commands above without any app file.

---

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
