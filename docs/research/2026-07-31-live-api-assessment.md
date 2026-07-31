# Live API (native audio, `bidiGenerateContent`) — הערכת מצב והחלטה מול קשת v281 (2026-07-31)

**Status:** Research + decision document. אין קוד מוצר במסמך הזה.
**Question:** האם ה-Live API (מודלי native-audio על WebSocket, כולל `gemini-2.5-flash-native-audio-latest` שאינו preview) צריך **להחליף** את קשת v281 (metered streaming), **להשלים** אותה, או להידחות — ולמה.
**Why now (עובדות מדודות, לא נגזרו מחדש):** ‏`gemini-3.1-flash-tts-preview` חסום קשיח ב-**100 בקשות/יום** (`GenerateRequestsPerDayPerProjectPerModel`, ‏quotaValue 100, אומת מ-envelope חי של 429) גם ב-Tier 1 עם קרדיט; ‏`gemini-2.5-flash-preview-tts` פנוי אך איטי (7.5s ל-10s אודיו מול ~4.4s) ופחות יציב (`finishReason: OTHER` בלי אודיו); סטרימינג על `streamGenerateContent` נותן פריים ראשון ב-**1,101 ms** — והוא הבסיס של v281.
**Method:** תיעוד רשמי (URL + תאריך גישה) + **בדיקה אמפירית חיה** — סשן Live אמיתי מ-Node (WebSocket מובנה, Node 24; המפתח מ-env, לא הודפס ולא נשמר) — כולל אימות מסלול ה-ephemeral-token מקצה-לקצה. הפרדה מפורשת בין verified ל-reported.

---

## 0 · Executive answer

1. **הסשן התחבר ועבד.** מודל `gemini-2.5-flash-native-audio-latest`, תור טקסט בעברית → תשובה קולית בעברית נכונה ("74 מעלות צלזיוס"). ‏Setup ‏420–1,040 ms; **פריים אודיו ראשון 1,097–1,708 ms אחרי השאלה** (עם `thinkingBudget:0`; ברירת המחדל חושבת ומגיעה ל-3,230 ms).
2. **המפתח המרכזי יכול להישאר בצד שרת — אומת אמפירית.** ה-Worker יכול להנפיק ephemeral token ‏(`POST /v1beta/auth_tokens`) והדפדפן מתחבר איתו ישירות ל-`BidiGenerateContentConstrained`. אין ממצא חוסם.
3. **המדידה (metering) היא הבעיה הארכיטקטונית:** בטופולוגיה הישירה ה-Worker לא רואה את הזרם — מדידת-הטוקנים של v281 מתנוונת ל"ספירת סשנים בזמן הנפקה". ‏usageMetadata פר-תור קיים בפרוטוקול, אבל רק מי שמחזיק את ה-socket רואה אותו.
4. **שאלת הבטיחות מכריעה נגד החלפה:** ב-Live המודל מדבר ישירות; התמליל (`outputTranscription`) זורם **לצד** האודיו ומושלם רק אחרי שהאודיו כבר הושמע. ‏`vcGuardSpoken` (v278) הוא answer-scoped — אין לו רגע לרוץ בו לפני שהמשתמש שומע. לשמר את השומר = לחצוץ (buffer) את כל התור, וזה מוחק את יתרון ה-latency כולו.
5. **המלצה:** ‏v281 ממשיכה כמתוכנן; ‏Live נרשם כקשת-המשך היברידית (צד קלט: האזנה רציפה/VAD/barge-in במודאליות TEXT) — לא כתחליף לפלט הדבור.

---

## 1 · Q1 — Quota & tier reality: איך Live נמדד, והאם ה-100/יום חל עליו

### 1.1 Verified

- **דף ה-rate-limits הרשמי כבר לא מפרסם טבלאות פר-מודל.** ‏([ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits), accessed 2026-07-31): ‏"Rate limits depend on a variety of factors (such as your usage tier) and can be viewed in Google AI Studio." המספרים הסמכותיים לפרויקט הזה נמצאים רק ב-UI של AI Studio (`aistudio.google.com/rate-limit`) — לא ניתן לאמת אותם מ-CLI.
- **אמפירית:** ‏**5 סשנים** נפתחו היום (כולל שני ניסיונות-אימות כושלים) — אף אחד לא נדחה, אף envelope של quota לא הופיע. הסשן המוצלח החזיר `usageMetadata` פר-תור: ‏`{promptTokenCount:387, responseTokenCount:117, totalTokenCount:504}` עם פירוק לפי מודאליות (TEXT in / AUDIO out).
- **המטריקה של ה-429 שחסם את ה-TTS היא `generate_requests_per_model_per_day`** — מטריקת בקשות `generateContent`. ‏Live אינו `generateContent`: הוא סשן WebSocket מתמשך שבתוכו תורים. אותה מטריקה אינה יכולה לספור "בקשות" באותו מובן.

### 1.2 Reported (secondary — פורומים ומקורות משניים, לא תיעוד רשמי עדכני)

- ‏Live נמדד ב-**concurrent sessions + TPM**, לא RPD: ‏Tier 1 ≈ **50 סשנים במקביל**, ‏≈1M TPM ([discuss.ai.google.dev — "Tier 2 project still limited to 50 concurrent connections"](https://discuss.ai.google.dev/t/gemini-live-api-tier-2-project-still-limited-to-50-concurrent-connections-and-billed-as-tier-1/94634); ‏[שם — "Official concurrent session / RPS limits… where are they documented?"](https://discuss.ai.google.dev/t/official-concurrent-session-rps-limits-for-gemini-live-api-where-are-they-documented/174664), surfaced via search 2026-07-31). עצם קיום השרשור השני מעיד שגם לקהילה אין מקור רשמי לטבלה.
- **מגבלות סשן** (verified מ-[capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)): ‏"Audio-only sessions are limited to 15 minutes"; חלון-קונטקסט "128k tokens for native audio output models".

### 1.3 Pricing (verified — [docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), accessed 2026-07-31)

| Model | Input | Audio output |
|---|---|---|
| 2.5 Flash **Native Audio** (Live) | $0.50/1M text · $3.00/1M audio | **$12.00/1M** |
| gemini-3.1-flash-tts-preview | $1.00/1M text | $20.00/1M |
| gemini-2.5-flash-preview-tts | $0.50/1M text | $10.00/1M |

**Bottom line על Q1:** ‏Live **נמדד אחרת** — סשנים-במקביל + טוקנים, לא בקשות/יום; אין שום עדות למקבילה של תקרת ה-100/יום, והתשובה המדודה שלנו עלתה 117 טוקני-אודיו (~$0.0014). אבל: את המספרים הרשמיים לפרויקט הזה **לא הצלחתי לאמת מהתיעוד** (הטבלאות הוסרו) — האימות הסופי הוא מבט אחד של הבעלים ב-AI Studio → §8.

---

## 2 · The probe — סשן Live אמיתי (2026-07-31, מכונת הפיתוח)

Script: scratchpad `live-probe.mjs` (Node v24.18.0, WebSocket מובנה — אפס תלויות, כלום לא הותקן ברפו). Endpoint: ‏`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` (ול-ephemeral: ‏`…Constrained`). שאלה: ‏"מה הטמפרטורה הפנימית הבטוחה לחזה עוף? ענה בקצרה בעברית."

### 2.1 שלוש ריצות מוצלחות (תמצית, credential redacted)

| Run | Auth | Setup done | First transcript | **First audio (after ask)** | Turn complete | usage |
|---|---|---|---|---|---|---|
| 1 · ברירת מחדל (thinking on) | API key | 543 ms | 3,039 ms | **3,230 ms** | 7,480 ms | — |
| 2 · `thinkingBudget:0` | API key | 420 ms | 1,359 ms | **1,708 ms** | 6,473 ms | 504 tok (387 TEXT in · 117 AUDIO out) |
| 3 · `thinkingBudget:0` | **ephemeral token** | 1,040 ms | 1,754 ms | **1,097 ms** | 6,798 ms | 510 tok |

- אודיו: ‏`audio/pcm;rate=24000`, ‏72–96 חלקי `inlineData`, ‏~180–230 KB לתשובה.
- תמליל (שתי הריצות הנקיות): ‏**"הטמפרטורה הפנימית הבטוחה לחזה עוף היא 74 מעלות צלזיוס."** — נכון (עוף 74°C).
- ריצה 1 מלמדת ש**ברירת המחדל חושבת**: חלק-מחשבה טקסטואלי הופיע ב-2,602 ms לפני כל אודיו. ‏`thinkingBudget:0` חובה לקול.
- ‏`usageMetadata` מגיע **בסוף התור** (יחד עם `turnComplete`) — קיים, אבל מאוחר, ורק על ה-socket עצמו.

### 2.2 מסלול ה-ephemeral token — הרצף המדויק, כולל שני הכשלונות המלמדים

1. ‏`POST /v1beta/auth_tokens` עם המפתח (‏`{uses:1}`) → **HTTP 200** ב-~385 ms, מחזיר `name: "auth_tokens/…"`.
2. ‏WS אל `BidiGenerateContent` עם `?access_token=<token>` → **close 1008: "Method doesn't allow unregistered callers"**.
3. ‏WS אל `BidiGenerateContent` עם `?key=<token>` → **close 1007: "API key not valid"**.
4. ‏WS אל **`BidiGenerateContentConstrained`** עם `?access_token=<token>` → ✅ עובד מקצה-לקצה (ריצה 3 בטבלה).

המתכון הנכון אינו כתוב בתיעוד במפורש (הוא קבור ב-SDK): ‏endpoint נפרד `…Constrained` + פרמטר `access_token`. התיעוד ([ephemeral-tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens), accessed 2026-07-31) מאשר: ‏"Ephemeral tokens are only compatible with Live API at this time"; ברירות מחדל — ‏`expireTime` ‏30 דק', ‏`newSessionExpireTime` דקה אחת, ‏`uses` 1; ‏`liveConnectConstraints` נועל את הטוקן למודל/קונפיג ספציפיים.

---

## 3 · Q2 — מה Live נותן מעבר למהירות, ממופה לתרחיש שלנו

מקור: ‏[live-api/capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities) + ‏[docs/live](https://ai.google.dev/gemini-api/docs/live), accessed 2026-07-31. ‏✔ = נצפה גם ב-probe.

| Capability | What it is (verified) | ליד המעשנה, ידיים תפוסות |
|---|---|---|
| **Barge-in** | ‏"When VAD detects an interruption, the ongoing generation is canceled"; השרת שולח `interrupted` | ערך אמיתי: לקטוע תשובה ארוכה בקול בלי לגעת במסך. אצלנו קיים barge-in ידני (`vcSpeakGen`) — Live נותן אותו קולית |
| **VAD אוטומטי** | מובנה, ניתן לכוונון (`endOfSpeechSensitivity`, ‏`silenceDurationMs` ~800ms מומלץ) | הופך "לחץ-דבר-שחרר" ל"פשוט דבר". בסביבה רועשת (מפוח, חצר) רגישות-VAD היא סיכון שצריך מדידה בשטח |
| **האזנה רציפה** | סשן stateful; אודיו-בלבד עד 15 דק', ‏context 128k | זה הפיצ'ר שהתרחיש באמת רוצה — שיחה מתמשכת בלי מגע. ‏15 דק' מספיק לאינטראקציה, לא ל"ליווי בישול" של שעות (נדרש reconnect/resumption) |
| **Session state** | ההיסטוריה חיה בסשן; ‏session resumption קיים | חוסך שליחת היסטוריה פר-תור; מקביל ל-`previous_interaction_id` של Interactions |
| **Function calling תוך-שיחה** | נתמך; קריאות תלויות נזרקות ב-interruption | עתידי (copilot) — לא צורך נוכחי |
| **תמלול דו-כיווני** ✔ | ‏`outputAudioTranscription` + ‏`inputAudioTranscription` | קריטי ל-§5 (הבטיחות) ול-`vcLastQA`. **זורם לצד האודיו, לא לפניו** |
| **Proactive audio / affective dialog** | המודל בוחר מתי לענות; מתאים טון | נחמד להדגמות; לא צורך |
| **מספרים בטיחותיים בקול** | — | **הבעיה, לא הפיצ'ר** — ראו §5 |

---

## 4 · Q3 — מה זה עולה לנו ארכיטקטונית (הקודבייס הקונקרטי)

המצב היום: ‏single-file PWA; ‏seam יחיד `gemTransport` (app.js ~5501) בונה URL+headers לשני backends; ‏**ה-Worker מפרוקסה HTTP בלבד** וממדוד מ-`usageMetadata` שב-envelope (debit-first, reserve 2000, reconcile); המפתח המרכזי הוא Worker secret בלבד.

| Aspect | HTTP היום / v281 | Live API | המשמעות |
|---|---|---|---|
| Transport | ‏fetch/SSE דרך ה-Worker | ‏WebSocket stateful — **לא עובר דרך המסלול הקיים בכלל** | ‏`gemTransport` לא רלוונטי; שכבת transport חדשה בצד לקוח (WS + jitter-buffer PCM + מכונת-מצבים לסשן) |
| **מפתח** | לעולם בצד שרת | ✅ **נשאר בצד שרת** — ה-Worker מנפיק ephemeral token (אומת §2.2); ‏`liveConnectConstraints` נועל מודל/קונפיג; ‏`uses:1` | **לא ממצא חוסם.** ה-Worker הופך מ"פרוקסי" ל"מנפיק כרטיסים" |
| **Metering** | ‏debit-first + reconcile מ-`usageMetadata` על כל תשובה | בטופולוגיה הישירה **ה-Worker לא רואה אף byte**. אפשרויות: (א) מדידה בזמן-הנפקה בלבד — סשנים/יום פר-קוד, בלי token-reconcile; (ב) דיווח-עצמי מהלקוח — לא אמין להגנת חשבון; (ג) **WS relay מלא דרך ה-Worker** (Cloudflare תומך) — משחזר מדידה אמיתית (`usageMetadata` פר-תור עובר על ה-socket) במחיר hop, קוד relay, ומודל-עלות של חיבורים ארוכים. לא נמדד | זו העבודה הגדולה. ‏B19 לימד שסטרימינג לא-ממודד = חשבון פתוח; ‏Live בטופולוגיה ישירה הוא בדיוק זה, מרוכך רק ע"י constraints + uses:1 + תקרת סשנים |
| Client audio | ‏v281 Task 1 כבר מנגן PCM סטרימי (WebAudio cursor) | דומה אבל דו-כיווני: גם **קלט** מיקרופון 16kHz PCM ב-chunks | חצי מהעבודה הזו כבר קיימת (הצד המנגן) |
| Fallback | ‏BYOK/managed באותו קוד | נדרש מסלול נפרד לגמרי + fallback ל-v281 כשה-WS נופל | שני מסלולי-קול מלאים לתחזוקה |

**אומדן כנות:** קשת Live מלאה (relay ממודד או ticket-issuer + לקוח WS + אודיו דו-כיווני + בדיקות) ≈ **סדר גודל של v281 כולה (~9 משימות) ומעלה**, על גבי פרוטוקול שרובו preview (המודל `-latest` הוא ה-alias היציב היחיד ברשימה).

---

## 5 · Q4 — שאלת הבטיחות: האם לשומר יש רגע לרוץ בו

**האינווריאנט (v278 + spec v281 §6):** ‏`vcGuardSpoken` הוא **answer-scoped** — רץ פעם אחת על התשובה השלמה; ‏marker נקשר למספר הנבדק; ‏wrong-field נכשל-סגור; מותר לדבר מוקדם רק משפטים חסרי-ספרות (`vcStreamSafe`). ‏"שומר על חצי משפט גרוע מחסר-תועלת."

**מה נמדד ב-Live (ריצה 2):** התמליל מתחיל ב-1,359 ms — לפני האודיו הראשון (2,129 ms) — אבל הוא **זורם אינקרמנטלית לצד האודיו** ומושלם רק סמוך ל-`generationComplete` (3,860 ms), בזמן שהאודיו כבר מתנגן באוזן. סדר ההודעות שנצפה: תמליל-חלקי → אודיו → אודיו+תמליל שזורים → ‏generationComplete → ‏usage+turnComplete.

**המסקנה, בשלוש דרכים לחתוך אותה:**

1. **להשמיע כמו ש-Live מתכוון** (אודיו ישיר לרמקול): המשתמש שומע את המספר **לפני** שהתשובה השלמה קיימת כטקסט → השומר לא רץ בכלל. הפרה ישירה של v278. **פסול.**
2. **לחצוץ עד סוף התור ואז לשמר** (buffer את כל ה-PCM, להריץ את השומר על התמליל השלם, לנגן רק אם עבר): כשר בטיחותית, אבל הצליל הראשון נדחה ל-‏generationComplete + guard ≈ **4 שניות ומעלה** — גרוע מה-2.3s הצפוי של v281, והרגנו את כל מה ש-Live בא לתת. וגם: השומר **מתקן** טקסט (redaction/substitution) — ב-Live אין דרך לתקן את האודיו שהמודל כבר הפיק; תיקון = לזרוק את האודיו ולסנתז מחדש ב-TTS ⇒ חזרנו ל-v281 בדרך הארוכה.
3. **שומר פר-משפט על התמליל הזורם:** שינוי סמנטיקה של השומר שהמפרט אוסר במפורש (משפט חד-מספרי בתוך תשובה תלת-מספרית "שואל" marker שהכלל השלם מונע). **פסול.**

**Verdict: ה-Live API כערוץ-פלט דבור אינו ניתן לשילוח תחת אינווריאנטי הבטיחות הנוכחיים.** זה מכריע כשלעצמו, בלי קשר למדידה ולמכסות. הדרך היחידה שבה Live כן נכנס: **צד הקלט בלבד** — ‏`responseModalities:['TEXT']`, האזנה רציפה + VAD + barge-in + תמלול-קלט, והתשובה חוזרת כטקסט אל הצינור הקיים (guard → ‏ttsText → ‏TTS ממודד). כך השומר נשאר בדיוק איפה שהוא, ו-INV-T לא נגוע.

---

## 6 · Q5 — מחליף או משלים את v281? (עם מה נזרק בכל מסלול)

מצב v281: מפרט מאושר, 9 משימות, ‏Task 1 (streaming TTS צד-לקוח) **כבר הוקם** (`31d3037`).

| Option | What it is | Cost | Risk | What it buys | What is wasted |
|---|---|---|---|---|---|
| **A · Stay** (בלי v281) | להישאר על TTS חוסם | 0 | הדגמות אבודות: 7.6s לצליל ראשון | כלום | ‏Task 1 + המפרט |
| **B · v281 as planned** ⭐ | סטרימינג ממודד על המשטח הקיים | ‏8 משימות שנותרו | **נמוך** — כל leg נמדד (1.24s משפט ראשון, 1.1s אודיו) | ‏≤3.0s לצליל ראשון, שומר שלם, מדידה שלמה, ‏BYOK/managed באותו קוד | כלום |
| **C · Live replacement arc** | ‏WS דו-כיווני, המודל מדבר | ‏≥9 משימות חדשות + relay/ticketing | **גבוה**: השומר חסר-בית (§5), מדידה נבנית מחדש (§4), פרוטוקול preview-ברובו, סשן ≤15 דק' | ‏1.1–1.7s לאודיו, ‏VAD/barge-in/רציפות, בריחה מתקרת ה-100/יום, ‏$12 מול $20 ל-1M | ‏Task 1 ורוב תכנון v281; **ואת v278** — או את יתרון ה-latency (§5.2) |
| **D · Hybrid (v281 now + Live-input arc later)** | ‏v281 נשלמת; אח"כ קשת "שיחה חופשית": ‏Live ב-TEXT-out לקלט רציף, הפלט נשאר בצינור המשומר | ‏v281 + קשת עתידית מוגדרת | בינוני, ומדורג | הכל מ-B עכשיו; ‏hands-free אמיתי אחר-כך בלי לגעת בבטיחות | כלום — ‏Task 1, השומר וה-Worker משמשים בשני השלבים |

**על מוטיבציית המכסה:** תקרת ה-100/יום היא תקרת **preview-model** על ה-TTS — לא תקרת חשבון. ‏v281 אגנוסטית-מודל (הרגיסטרי `GEM_MODELS`): אם 3.1-TTS נחנק לפני GA, המוצא הזול הוא החלפת מודל-TTS (ו-2.5-preview-tts כ-stopgap מדוד), לא החלפת ארכיטקטורה. ‏Live כן בורח מהתקרה — אבל במחיר §5.

## 7 · Ranked recommendation

1. **Option D, שמתחילה ב-B: להמשיך את v281 כמתוכנן, עכשיו.** שום דבר לא נזרק, השומר והמדידה שלמים, וה-latency המדוד של Live ‏(1.1–1.7s) אינו רחוק מספיק מה-2.3s הצפוי כדי להצדיק ויתור על v278. **ולרשום (H8) קשת "Live-input hybrid"** — האזנה רציפה + VAD + barge-in ב-`responseModalities:['TEXT']`, ‏ephemeral tokens מה-Worker (המתכון המאומת ב-§2.2), הפלט בצינור המשומר — trigger: סגירת v281 + החלטת בעלים שה-hands-free שווה קשת.
2. **Option C (החלפה מלאה) — נדחית כל עוד אינווריאנט v278 עומד.** אם אי-פעם תישקל מחדש, תנאי-הסף הם: פתרון בטיחות שהבעלים אישר במפורש (חציצה-מלאה + re-synth, או ויתור מוצהר), ‏WS relay ממודד שנמדד, ומודל native-audio יציב-GA.
3. **Option A — נדחית;** תקרת ה-100/יום מטופלת ברמת המודל, לא בהקפאת הקשת.

## 8 · What I could not verify

- **המספרים הרשמיים של מכסות Live לפרויקט הזה** (סשנים-במקביל, TPM, קיום/אי-קיום תקרה יומית כלשהי): הטבלאות הוסרו מהתיעוד; ‏50-concurrent/1M-TPM הם secondary. ‏**Action לבעלים (דקה אחת):** ‏`aistudio.google.com/rate-limit` → לצלם את שורות `native-audio` / Live.
- **אי-קיום תקרת סשנים יומית** — נצפו רק 5 סשנים; העדר-429 אינו הוכחה.
- **איכות ASR עברית של קלט-אודיו** — ה-probe שלח טקסט; קלט מיקרופון עברי אמיתי (ורעש-רקע של מעשנה) לא נבדק. זהו ה-gate האמפירי של קשת ה-hybrid העתידית.
- **‏VAD בסביבה רועשת** — לא נבדק.
- **‏`liveConnectConstraints` בפועל** (נעילת מודל/קונפיג על הטוקן) — הטוקן נוצר עם `uses:1` בלבד; ההתנהגות הנועלת reported מהתיעוד, לא הופעלה.
- **‏WS relay דרך Cloudflare Worker** — היתכנות reported (CF תומך WS); ‏latency ועלות לא נמדדו.
- **האם תקרת ה-100/יום תוסר ב-GA של ה-TTS** — הנחה סבירה, לא התחייבות של גוגל.
- **התנהגות סשן ארוך** (‏goAway, ‏session resumption כל ~10 דק' תחת ephemeral) — לא נבדקה.

## Sources

1. https://ai.google.dev/gemini-api/docs/live — accessed 2026-07-31 (WSS stateful, ‏PCM 16k in / 24k out, ‏barge-in, 70 שפות)
2. https://ai.google.dev/gemini-api/docs/live-api/capabilities — accessed 2026-07-31 (VAD, ‏interrupted, תמלול, ‏15 דק' אודיו, ‏128k context, ‏usageMetadata)
3. https://ai.google.dev/gemini-api/docs/ephemeral-tokens — accessed 2026-07-31 (‏Live-only, ‏auth_tokens, ‏expireTime/newSessionExpireTime/uses/liveConnectConstraints, ‏access_token)
4. https://ai.google.dev/gemini-api/docs/rate-limits — accessed 2026-07-31 (הטבלאות הוסרו; ‏AI Studio סמכותי)
5. https://ai.google.dev/gemini-api/docs/pricing — accessed 2026-07-31 (‏$12/1M audio-out native-audio מול $20/$10 ל-TTS)
6. https://discuss.ai.google.dev/t/gemini-live-api-tier-2-project-still-limited-to-50-concurrent-connections-and-billed-as-tier-1/94634 · https://discuss.ai.google.dev/t/official-concurrent-session-rps-limits-for-gemini-live-api-where-are-they-documented/174664 — surfaced via search 2026-07-31 (secondary; ‏50 concurrent Tier 1)
7. Empirical probe, 2026-07-31, מכונת הפיתוח — §2 (‏`live-probe.mjs` ב-scratchpad; המפתח מ-env, לא הודפס; ‏5 סשנים, 3 מוצלחים)
8. ‏`docs/superpowers/specs/2026-07-31-metered-streaming-design.md` — מפרט v281 (המדידות 1,101ms/1.24s, ‏§6 אינווריאנט השומר) · ‏`docs/research/2026-07-31-interactions-api-assessment.md` — ה-429 התאום ואינוונטר ה-call-sites
