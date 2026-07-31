# Interactions API — הערכת מצב והחלטה (2026-07-31)

**Status:** Research + decision document. אין קוד מוצר במסמך הזה.
**Question:** האם לעבור מ-`generateContent`/`streamGenerateContent` ל-**Interactions API**, ומתי — לפני או אחרי v281 (metered streaming)?
**Method:** תיעוד רשמי (מצוטט, עם URL + תאריך גישה) + **בדיקה אמפירית חיה** מול שני המשטחים + אינוונטר קוד מלא (app.js, worker/index.js, תוכנית v281). הפרדה מפורשת בין מה שאומת לבין מה שהוסק.

---

## 1 · Findings — ההמלצה הרשמית של גוגל

### 1.1 What is verified (quoted)

מתוך מדריך המיגרציה הרשמי ([ai.google.dev/gemini-api/docs/migrate-to-interactions](https://ai.google.dev/gemini-api/docs/migrate-to-interactions), accessed 2026-07-31):

> "The Interactions API is now generally available. We recommend using this API for all the latest features and models."

> "While `generateContent` remains fully supported, we recommend the Interactions API for all new development."

מתוך ה-overview ([ai.google.dev/gemini-api/docs/interactions-overview](https://ai.google.dev/gemini-api/docs/interactions-overview), accessed 2026-07-31):

> "…the best way to build with Gemini models and agents… generally available and recommended for all new projects."

**Strength of the recommendation — "recommended for new development", לא deprecation:**

- ה-API הוכרז GA (יוני 2026, לפי הבלוג הרשמי — ראו 1.2).
- **אין הודעת deprecation על `generateContent`, אין תאריך כיבוי.** הניסוח המפורש: "remains fully supported".
- כלומר: ההמלצה של הבעלים מדויקת ברוחה — גוגל אכן מכוונת את כל הפיתוח החדש ל-Interactions — אבל **אין שעון עצר**. אין סיכון תפעולי מיידי בהישארות על המשטח הנוכחי.

### 1.2 What is reported but not independently verified (inferred / secondary)

- מסיכום תוצאות החיפוש של מדריך המיגרציה ושל הבלוג הרשמי ([blog.google — Interactions API general availability](https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/), surfaced via search 2026-07-31, לא נקרא ישירות): "All new agent features will ship exclusively through Interactions" ו-"new features won't come to generateContent". ניסוח זה הופיע בתקציר החיפוש; לא איתרתי אותו מילה-במילה בעמוד שנקרא ישירות. **מסווג: reported, לא verified.**
- שם: מומלץ להישאר על `generateContent` אם צריך פיצ'ר שעדיין חסר ב-Interactions, ובתקציר הוזכרו **Batch API ו-explicit caching** כחסרים. גם זה מסיכום חיפוש — reported.

---

## 2 · Findings — מה ה-Interactions API מציע (ורלוונטיות לעוזר-בישול)

מקורות: [interactions-overview](https://ai.google.dev/gemini-api/docs/interactions-overview) · [API reference](https://ai.google.dev/api/interactions-api) · [streaming](https://ai.google.dev/gemini-api/docs/interactions/streaming), accessed 2026-07-31. סעיפים שסומנו ✔ אומתו גם אמפירית (סעיף 4).

| Capability | Detail | רלוונטיות אלינו |
|---|---|---|
| **Server-side state** | `previous_interaction_id` + `store` (ברירת מחדל true; retention: 55 יום בתשלום, יום אחד בחינם) — אין צורך לשלוח את כל ההיסטוריה בכל תור | גבוהה ל-Voice Cook רב-תורי; חוסך tokens של היסטוריה. שימו לב: `store:true` כברירת מחדל = שמירת שיחות אצל גוגל — החלטת פרטיות שצריך לקבל במודע (`store:false` עובד ✔) |
| **Unified endpoint** | endpoint אחד לטקסט, סטרימינג, כלים, תמונות, אודיו, agents | מפשט את השכבה, לא פותח יכולת חדשה עבורנו |
| **Streaming (SSE, typed events)** ✔ | `stream:true` בגוף; אירועים: `interaction.created`, `interaction.status_update`, `step.start/delta/stop`, `interaction.completed`, `error`, `[DONE]` | שקול ל-`streamGenerateContent` — מסגור שונה, לא יכולת חדשה |
| **Tools / function calling** | נתמך, עם steps נצפים | עתידי (copilot) |
| **Background execution** | `background=true` למשימות ארוכות | לא נחוץ כעת |
| **Agents** | Deep Research / Antigravity דרך אותו endpoint | לא נחוץ כעת |
| **TTS** | `response_modalities:['audio']` + `generation_config.speech_config` | ראו 4.3 — קיים אך לא אומת בפועל |
| **Voice activity detection / live audio-in** | **לא מתועד ב-Interactions API.** שיחה קולית דו-כיוונית בזמן אמת היא עדיין ה-Live API הנפרד | ה-Interactions API הוא **לא** תחליף Live API — מי שמצפה ל-VAD לא ימצא אותו כאן |

**Rate limits / quota — ממצא מרכזי (verified):** לפי [docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) המכסות מוגדרות **per model per project**, לא per surface — והבדיקה האמפירית (4.3) הוכיחה זאת חד-משמעית: אותו bucket יומי בדיוק חסם את שני המשטחים עם אותו טיימר. **מעבר ל-Interactions לא פותר את מגבלת ה-RPM/RPD של ה-TTS.**

---

## 3 · Findings — הבדלי צורה (shape) מול המשטח הנוכחי

| Aspect | generateContent (נוכחי) | Interactions API | Verified? |
|---|---|---|---|
| Endpoint | `/v1beta/models/<model>:generateContent` (+`:streamGenerateContent?alt=sse`) | `POST /v1beta/interactions` — endpoint אחד, `stream:true` בגוף | ✔ probe. הערה: מדריך המיגרציה הציג `v1beta2` בדוגמה; בפועל `v1beta` עובד. `v1beta2` לא נבדק |
| Auth | `x-goog-api-key` | זהה | ✔ probe |
| Request | `contents[].parts[]`, `generationConfig` (camelCase), `responseModalities:['AUDIO']` | `model` + `input` (string/Content/Turns), `generation_config` (snake_case, כולל `thinking_level`), `response_modalities:['audio']`, `system_instruction`, `store` | ✔ probe |
| Response (text) | `candidates[0].content.parts[].text` | `steps[].content[].text` + `status:"completed"` | ✔ probe |
| **Usage accounting** | `usageMetadata.totalTokenCount` / `promptTokenCount` / `candidatesTokenCount` / `thoughtsTokenCount` | `usage.total_tokens` / `total_input_tokens` / `total_output_tokens` / `total_thought_tokens` / `total_tool_use_tokens` / `…by_modality` | ✔ probe. **ה-Worker ממדוד `usageMetadata.totalTokenCount` — חייב branch חדש** |
| Streaming frames | SSE `data:` עם אותו envelope של candidates בכל פריים; usageMetadata מצטבר, הפריים האחרון סמכותי | SSE typed events; טקסט אינקרמנטלי ב-`step.delta` → `delta.text`; **usage מגיע באירוע `interaction.completed`** | ✔ probe |
| **Error envelope** | JSON: `{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[…RetryInfo…]}}` | אירוע SSE גם על שגיאה מיידית: `event: error` + `{"error":{"message":…,"code":"quota_exceeded"},"event_type":"error"}` — קוד שגיאה כמחרוזת-URI, בלי `status`/`details` המובנים | ✔ probe (שני ה-429 נלכדו זה לצד זה). לוגיקת fallback של `gemFetch` (401/402/403→BYOK) ופרסור שגיאות ב-Worker ישתנו |
| Quota semantics | per-model-per-project | **זהה — אותו bucket** | ✔ probe (4.3) |

---

## 4 · Empirical probe (2026-07-31, מכונת הפיתוח, מפתח מ-env — לא הודפס ולא נשמר)

Script: scratchpad `probe-interactions.mjs` / `probe2.mjs` (Node 22 fetch, מדידת `performance.now()`).

### 4.1 Text, non-streaming — `POST /v1beta/interactions`, model `gemini-3.6-flash` ✔
- **HTTP 200**, total **2,036 ms**; פלט עברית תקין ("קר" ל"מה ההפך של חם"); `status:"completed"`.
- usage: `{total_tokens:196, total_input_tokens:18, total_output_tokens:1, total_thought_tokens:177}` — **ברירת המחדל שרפה 177 thought-tokens על תשובה של מילה אחת.**
- עם `generation_config.thinking_level:'minimal'`: **HTTP 200, 1,188 ms**, `total_thought_tokens:0`, `total_tokens:19`.
- Baseline באותה דקה על `generateContent`: HTTP 200, 1,779 ms (גם הוא חשב — 171 thought-tokens). **מסקנה: אותו backend, latency שקול; אין יתרון מהירות מובנה ל-Interactions.**

### 4.2 Text, streaming — `stream:true` ✔
- **HTTP 200**, headers ב-1,761 ms, first `step.delta` text ב-**1,765 ms**, total 1,877 ms.
- רצף האירועים שנצפה בפועל: `interaction.created → interaction.status_update → step.start → step.delta ×2 → step.stop → interaction.completed → [DONE]`; ה-usage הופיע ב-`interaction.completed` בלבד.

### 4.3 TTS streaming עברית — model `gemini-3.1-flash-tts-preview` — **נחסם ב-quota, וזה ממצא**
- Interactions: **HTTP 429** אחרי 308 ms, כאירוע `event: error` / `code:"quota_exceeded"`:
  `Quota exceeded for metric: generativelanguage.googleapis.com/generate_requests_per_model_per_day, limit: 100, model: gemini-3.1-flash-tts. Please retry in 8h26m6.7s`
- Baseline `streamGenerateContent` באותה שנייה: **HTTP 429 זהה**, אותו metric, אותו מודל, retry `8h26m6.6s` — **אותו bucket יומי בדיוק, הפרש 0.1 שניות בטיימר.**
- שלוש מסקנות: (א) **המכסה משותפת — מיגרציה לא עוקפת את מגבלת ה-TTS** (ה-429 שנתקלנו בו היום היה יומי, limit 100/day, לא רק per-minute); (ב) המודל `gemini-3.1-flash-tts-preview` **מזוהה ומנותב** על משטח Interactions (הגיע לבדיקת quota, לא "model not found") — עקבי עם רשימת המודלים הרשמית שמונה גם את `gemini-3.6-flash` וגם את `Gemini 3.1 Flash TTS Preview`; (ג) **לא ניתן היה למדוד first-audio-frame** מול ה-1,101 ms של המשטח הנוכחי — ראו 8.

---

## 5 · Call-site inventory (app.js · worker/index.js · v281 plan)

בוצע ע"י subagent קריאה-בלבד (Grep/Read; serena לא רץ — fallback מוצהר), אומת מול השורות.

### 5.1 app.js — **10 call sites ישירים, seam יחיד**
- **בונה URL/כותרות חי אחד: `gemTransport`** (‎~5501) — שני verbs, שני backends (managed/BYOK). ‏`GEM_URL` (‎5469) legacy ללא caller חי.
- **שני מבצעי fetch:** `gemFetch` (‎5515, כל ה-`generateContent`) ו-`gemSpeakSegStream` (‎6585, ה-caller היחיד של `streamGenerateContent`, עם fetch משלו).
- **10 call sites ישירים:** `askGemini`, `askValidateKey`, `aiJSON`, בדיקת central ב-`openKeyManager`, `gemSynthChunk` (TTS חוסם), `gemSpeakSegStream` (TTS זורם), `vcTranslateToEn`, `vcAskAI`, `mtTranslate`, `gemVision`; ועוד ~5 עוטפים עקיפים (`copilotAskNow`, `vcAskFlow`, `vcWarmAck`, `gemSpeak`, `askConnect`).
- **צמודי-envelope בצד לקוח:** בוני גוף `gemGen`/`gemTtsGen`, קוראי תשובה `gemReadText`/`gemReadAudio`, מטר-שימוש `gemNoteUsage` (קורא `usageMetadata`), ופרסר ה-SSE `gemPlayPcmStream` (‎6610 — סורק `candidates[0]…inlineData`).
- **Funnel verdict: אין bypasses** — כל URL נבנה ב-`gemTransport`. זה מה שהופך מיגרציה עתידית לזולה יחסית.

### 5.2 worker/index.js — route + metering שניהם צמודי-משטח
- Route (‎91–96): regex קשיח `^\/v1beta\/models\/[^/]+:generateContent$`; סטרימינג סגור במכוון (B19). Interactions (`/v1beta/interactions`) יקבל **404** מה-proxy היום — נדרש route חדש + פרסור `model` מגוף הבקשה (היום המודל בנתיב; ב-Interactions הוא בגוף).
- Metering (‎143–149): `JSON.parse(text).usageMetadata.totalTokenCount`, debit-first עם reserve 2000 ו-reconcile. ב-Interactions: non-stream → `usage.total_tokens` ברמת-שורש; stream → בתוך אירוע `interaction.completed`. **וגם envelope השגיאות שונה** (סעיף 3).

### 5.3 v281 metered-streaming — צימוד התוכנית
Task 1 (streaming TTS בצד לקוח) — **בוצע, ‎`31d3037`** על `streamGenerateContent`. צמודים עמוקות לצורת המשטח הנוכחי: **Task 2** (`gemSseParse`), **Task 6** (ה-Worker: `scanFrame` שמניח פריימים `\n\n`/`data:`, usageMetadata מצטבר שהפריים האחרון בו סמכותי, ו-`parts[].text` לאומדן fallback), **Task 9** (סקריפט מדידה שמפרסר אותו envelope). Tasks ‏3, 5, 7, 8 אגנוסטיים לצורה; Task 4 תלוי רק ב-callback של Task 2. **סה"כ סורק ה-SSE ממומש/מתוכנן בארבעה מקומות** — שינוי envelope = ארבעה תיקונים מסונכרנים.

---

## 6 · The three options

### Option A — Migrate now (לפני השלמת v281)
- **מה נזרק:** Task 1 שכבר shipped (‏`gemSpeakSegStream`+`gemPlayPcmStream`) נכתב מחדש; Tasks ‏2/6/9 מתוכננים מחדש מול envelope אחר.
- **מה נבנה על קרקע לא-מאומתת:** את סטרימינג ה-TTS על Interactions **לא הצלחנו לאמת היום** (quota), ותיעוד הסטרימינג הרשמי מכסה audio-*understanding* בלבד — אין דוגמה מתועדת לאיך audio-delta יוצא נראה. לבנות עליו את ליבת v281 לפני probe מוצלח = הימור.
- **מה זה קונה:** state צד-שרת, ותאימות לפיצ'רי agents עתידיים. **לא קונה:** quota (משותף — מוכח), latency (שקול — נמדד), מודלים (זהים).
- **עלות:** ‎~10 tasks + עיכוב v281 בשבוע לפחות. **Risk: גבוה.**

### Option B — Finish v281 on the current surface, migrate after ⭐
- אין לחץ זמן: אין deprecation, ‏`generateContent`‏ "fully supported".
- **מה נצטרך לעשות מחדש אחרי v281 (בהינתן ה-seam):** ‏`gemTransport` verb חדש + גוף חדש (‎1) · ‏`gemGen`/`gemTtsGen`/readers/`gemNoteUsage` (‎1) · שני פרסרי SSE בצד לקוח (`gemPlayPcmStream`, `gemSseParse`) לאירועי step (‎1–2) · Worker: route חדש, model-מהגוף, metering מ-`usage`, envelope שגיאות (‎2–3) · סקריפט מדידה + בדיקות + Hebrew/UI verification (‎2) · **gate פתיחה: probe מוצלח של TTS streaming על Interactions** כולל first-audio ≤ המדידה הנוכחית (‎1). **סה"כ ‎~8–10 tasks.**
- 10 ה-call sites **לא נוגעים בכלל** — הם מדברים עם `gemFetch`/`gemSpeak`, לא עם ה-wire. הרישום (`GEM_MODELS`) שורד כמו-שהוא (אותם שמות מודלים על שני המשטחים — verified לטקסט, near-verified ל-TTS).
- **חסרון יחיד:** ‎4 סורקי ה-SSE של v281 ייכתבו פעם נוספת. זה המחיר, והוא מוגבל ל-‎~3–4 מתוך ‎10 ה-tasks של המיגרציה — לא rewrite של המערכת.
- **Risk: נמוך.**

### Option C — Stay indefinitely
- לא מומלץ: המלצה רשמית קיימת ומפורשת ("all new development"), והטענה המדווחת שפיצ'רים חדשים יגיעו רק ל-Interactions הופכת הישארות ארוכת-טווח לחוב מצטבר. אבל אין דחיפות מבצעית — אין תאריך, אין deprecation.

## 7 · Ranked recommendation

1. **Option B — לסיים את v281 על המשטח הנוכחי ולתכנן מיגרציה כקשת נפרדת אחרי.** אין שעון deprecation; המיגרציה לא פותרת אף כאב נוכחי (quota משותף — מוכח; latency שקול — נמדד); ליבת v281 (TTS streaming) היא בדיוק החלק שעדיין **אי-אפשר לאמת** על Interactions; וה-seam הקיים (`gemTransport` יחיד, 0 bypasses, registry) הופך מיגרציה מאוחרת ל-‎~8–10 tasks ממוקדים בלי לגעת ב-10 ה-call sites.
2. **Option A** רק אם הבעלים מייחס ערך מיידי ל-state צד-שרת או רוצה ליישר קו עם agents בקרוב — ואז **חובה** probe TTS מוצלח לפני כתיבת שורת קוד.
3. **Option C** — נדחה כעמדה קבועה.

**Migration size (honest): ‎~8–10 tasks.**
**Single riskiest part:** ‏**metered streaming ב-Worker על מסגור האירועים החדש** — ה-usage מגיע רק ב-`interaction.completed`, אין ספירה מצטברת פריים-אחר-פריים כמו `usageMetadata`, אומדן ה-fallback per-frame של Task 6 לא ממופה 1:1, ו-envelope השגיאות שונה; משני צמוד: צורת audio-delta ב-TTS שטרם נצפתה בכלל.

## 8 · What I could not verify
- **First-audio-frame latency על Interactions** — חסום עד איפוס ה-quota היומי (‎~8.5 שעות ממועד הבדיקה). **Deferred, trigger-anchored:** להריץ `probe-interactions.mjs tts` אחרי האיפוס, לפני כל החלטת מיגרציה סופית. ההשוואה ל-1,101 ms נותרה פתוחה.
- **צורת ה-audio deltas בסטרימינג Interactions** (איזה event/שדה נושא PCM) — לא מתועד ולא נצפה.
- "New features won't come to generateContent" ורשימת החוסרים (Batch, explicit caching) — secondary/reported בלבד (‎1.2).
- `v1beta2` (הופיע במדריך המיגרציה) — לא נבדק; ‎`v1beta` עובד ומספיק.
- התנהגות `previous_interaction_id` בפועל, ו-retention — לא נבדקו אמפירית.

## Sources
1. https://ai.google.dev/gemini-api/docs/migrate-to-interactions — accessed 2026-07-31 (ציטוטי ההמלצה, מיפוי שדות, auth)
2. https://ai.google.dev/gemini-api/docs/interactions-overview — accessed 2026-07-31 (יכולות, רשימת מודלים כולל שני המודלים שלנו, retention)
3. https://ai.google.dev/api/interactions-api — accessed 2026-07-31 (סכמת בקשה/תשובה, שדות usage, אירועי SSE, שגיאות)
4. https://ai.google.dev/gemini-api/docs/interactions/streaming — accessed 2026-07-31 (אירועי סטרימינג, delta.text, usage ב-completed)
5. https://ai.google.dev/gemini-api/docs/rate-limits — accessed 2026-07-31 (מכסות per-model-per-project)
6. https://blog.google/innovation-and-ai/technology/developers-tools/interactions-api-general-availability/ — surfaced via search 2026-07-31, לא נקרא ישירות (GA announcement; secondary)
7. Empirical probe, 2026-07-31, מכונת הפיתוח — סעיף 4 (פלטים גולמיים נשמרו בפלט הסשן; המפתח לא הודפס).
