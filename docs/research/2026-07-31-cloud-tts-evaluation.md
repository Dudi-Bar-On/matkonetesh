# Google Cloud Text-to-Speech — הערכה מול חסם ה-100/יום של Gemini-TTS (2026-07-31)

**Status:** Research + empirical probe. אין קוד מוצר במסמך הזה.
**Question:** האם Cloud Text-to-Speech (‏`texttospeech.googleapis.com` — מוצר GA נפרד מ-Gemini API TTS) עוקף את תקרת ה-**100 בקשות/יום** של `gemini-3.1-flash-tts-preview` (‏`GenerateRequestsPerDayPerProjectPerModel`, ‏quotaValue 100, אומת מ-envelope חי של 429) — ובאיזה מחיר ארכיטקטוני.
**Method:** תיעוד רשמי (URL + תאריך גישה, כולם 2026-07-31) + בדיקה אמפירית חיה מול ה-API עם המפתח הקיים (מ-env; לא הודפס, לא נשמר). הפרדה מפורשת בין verified ל-reported.

---

## 0 · Executive answer

1. **עברית קיימת — כולל במשפחת הפרימיום.** ‏he-IL נתמכת ב-**38 קולות**: ‏`he-IL-Standard-A..D`, ‏`he-IL-Wavenet-A..D`, ו-**30 קולות `he-IL-Chirp3-HD-*`** (המשפחה הנוירונית העדכנית). ‏אין Neural2/Studio בעברית — אבל Chirp 3 HD חדשה וטובה מהן.
2. **החסם שלנו לא קיים שם.** ‏Cloud TTS נמדד ב-**בקשות/דקה** (‏Chirp 3: ‏200 RPM לפרויקט; משפחות אחרות 1,000 RPM) — **אין תקרת יום מתועדת**, המגבלות ניתנות להגדלה מהקונסולה, והמוצר GA (לא preview).
3. **ה-probe נכשל בדיוק במקום המלמד:** המפתח הקיים (Gemini/AI Studio) נדחה ב-**401**: ‏`"API keys are not supported by this API. Expected OAuth2 access token"` ‏(reason: ‏`CREDENTIALS_MISSING`) — גם ב-header ‏`X-Goog-Api-Key` וגם כ-`?key=`. ‏Cloud TTS דורש **service account** (OAuth2 principal). לכן **לא הופק קובץ אודיו להשוואה** — זה הממצא, לא מחדל.
4. **המדידה (metering) קלה יותר מאשר היום:** החיוב הוא **לפי תווי קלט** — ה-Worker יודע את המחיר **לפני** הקריאה (`text.length`), דטרמיניסטית, בלי לפרסר usage envelope מהתשובה.
5. **שומר הבטיחות הדבור נשאר כמו שהוא:** ‏Cloud TTS הוא text→audio טהור; ‏`vcGuardSpoken` רץ על הטקסט **לפני** הסינתזה בדיוק כמו היום. אין את בעיית ה-Live API.
6. **עלות:** בשימוש שלנו (~150 תווים/תשובה) — ‏Chirp 3 HD ‏**$4.50/1000 תשובות** (ו-**חינם עד ~6,600 תשובות/חודש** ב-free tier של 1M תווים); ‏WaveNet ‏$0.60/1000. להשוואה: ‏Gemini 2.5 Flash TTS ‏≈$1.19/1000, ‏3.1 ‏≈$2.36/1000. הכל זניח; המחיר אינו השיקול.

---

## 1 · Hebrew support (verified)

מקור: ‏[docs.cloud.google.com/text-to-speech/docs/list-voices-and-types](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types) — ה-HTML המלא הורד ונסרק ל-`he-IL-*` (accessed 2026-07-31). ‏[Chirp 3: HD voices](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd) מאשר עברית ברשימת 48 השפות.

| Family | Hebrew voices | Notes |
|---|---|---|
| **Chirp 3: HD** ($30/1M) | ‏30 קולות: ‏`he-IL-Chirp3-HD-{Achernar, Achird, Algenib, Algieba, Alnilam, Aoede, Autonoe, Callirrhoe, Charon, Despina, Enceladus, Erinome, Fenrir, Gacrux, Iapetus, Kore, Laomedeia, Leda, Orus, Puck, Pulcherrima, Rasalgethi, Sadachbia, Sadaltager, Schedar, Sulafat, Umbriel, Vindemiatrix, Zephyr, Zubenelgenubi}` | אותם שמות קולות כמו Gemini-TTS (Kore, Puck…) — אותה משפחת מודלים מאחור |
| **WaveNet** ($4/1M) | ‏`he-IL-Wavenet-A/B/C/D` | דור קודם, זול פי 7.5 |
| **Standard** ($4/1M) | ‏`he-IL-Standard-A/B/C/D` | הישן ביותר |
| Neural2 / Studio / Polyglot / Instant custom | **אין עברית** | זו לא בעיה — Chirp 3 HD עדכנית מכולן |

**איכות בפועל לא נשמעה** (ה-probe נחסם באימות — §4). שמות הקולות הזהים ל-Gemini-TTS מרמזים על איכות דומה לזו שאנחנו כבר מכירים, אבל זו השערה עד listen-test.

## 2 · Quota model (verified)

מקור: ‏[docs.cloud.google.com/text-to-speech/quotas](https://docs.cloud.google.com/text-to-speech/quotas) (accessed 2026-07-31).

- ‏**Chirp 3: ‏200 requests/minute** לפרויקט; ‏Neural2/Polyglot/כללי: ‏1,000 RPM; ‏Studio: ‏500 RPM; ‏100 סשני streaming במקביל.
- ‏**5,000 bytes** מקסימום לבקשה (התשובות שלנו ~150 תווים ≈ ~280 bytes ב-UTF-8 — רחוק מהתקרה).
- **אין תקרת יום בתיעוד.** ‏"You can request an increase to the requests limit from the Google Cloud console" — מכסות GA רגילות, לא מכסת preview קשיחה.
- ‏Free tier חודשי ([pricing], §5): ‏Chirp 3 HD ‏1M תווים, ‏WaveNet ‏1M, ‏Standard ‏4M — נערמים זה על זה.

**Verdict מול החסם:** תקרת ה-100/יום היא מטריקת `generate_requests_per_model_per_day` של מודל preview ב-Gemini API. ל-Cloud TTS אין מקבילה מתועדת; ‏200 RPM ≈ תקרה תיאורטית של ~288,000 בקשות/יום. **החסם נעקף.**

## 3 · Auth & architecture fit

### 3.1 מה ה-Worker צריך (נגזר מה-probe + [authentication docs](https://docs.cloud.google.com/text-to-speech/docs/authentication), accessed 2026-07-31)

- **API keys לא מתקבלים** (empirical, §4) — צריך **service account**: יצירה בקונסולת GCP, מפתח JSON נשמר **כ-Worker secret בלבד** (כמו ה-Gemini key היום; לעולם לא לדפדפן, לא לרפו).
- ה-Worker חותם **JWT (RS256)** עם המפתח — ‏WebCrypto של Cloudflare Workers תומך — ואז אחת מהשתיים: ‏(א) **self-signed JWT ישירות כ-Bearer** (‏Google תומך לרוב Cloud APIs — חוסך round-trip), או (ב) החלפה ב-access token מול `oauth2.googleapis.com/token` ו-cache ל-~50 דקות. תוספת מורכבות: ~50 שורות Worker, חד-פעמית.
- הקריאה עצמה: ‏`POST https://texttospeech.googleapis.com/v1/text:synthesize` עם ‏`{input:{text}, voice:{languageCode:'he-IL', name:'he-IL-Chirp3-HD-…'}, audioConfig:{audioEncoding:'MP3'|'OGG_OPUS'|'LINEAR16'}}`; התשובה JSON עם ‏`audioContent` ב-base64 — ה-Worker מפענח ומזרים לדפדפן.

### 3.2 Metering — קל יותר מהיום

היום אנחנו קוראים token usage מ-envelope של תשובת Gemini. ‏Cloud TTS מחויב **לפי תווי קלט** ([pricing docs](https://cloud.google.com/text-to-speech/pricing)) — ה-Worker מודד `text.length` **לפני** הקריאה: דטרמיניסטי, ידוע מראש, שורת קוד אחת. **כן — קל יותר.**

### 3.3 Safety guard — נשאר בדיוק כמו היום

‏Cloud TTS הוא שירות text→audio טהור: הטקסט המלא קיים אצלנו **לפני** בקשת הסינתזה, ולכן `vcGuardSpoken` (v278) רץ עליו באותה נקודה בדיוק כמו במסלול הנוכחי. אין את כשל ה-Live API (אודיו שמגיע לפני שהשומר יכול לרוץ). **מתקיים.**

## 4 · The empirical probe (2026-07-31, מכונת הפיתוח)

- ‏`GET /v1/voices?languageCode=he-IL` עם המפתח הקיים ב-`X-Goog-Api-Key` → **HTTP 401**.
- ‏`POST /v1/text:synthesize?key=…` (‏he-IL-Wavenet-A, ‏"בדיקה") → **HTTP 401**, אותו envelope בדיוק:

```json
{ "error": { "code": 401,
  "message": "API keys are not supported by this API. Expected OAuth2 access token or other authentication credentials that assert a principal. See https://cloud.google.com/docs/authentication",
  "status": "UNAUTHENTICATED",
  "details": [{ "reason": "CREDENTIALS_MISSING",
    "metadata": { "method": "google.cloud.texttospeech.v1.TextToSpeech.SynthesizeSpeech",
                  "service": "texttospeech.googleapis.com" } }] } }
```

- הדחייה אינה "API לא מופעל בפרויקט" ואינה "מפתח מוגבל" — היא **קטגורית**: השירות אינו מקבל API keys בכלל. תואם את דף ה-authentication שמונה רק ADC/OAuth/service accounts.
- ‏gcloud לא מותקן במכונה → לא ניתן להנפיק access token מקומית. **לכן לא הופק קובץ האודיו ההשוואתי.** משפט הבדיקה המיועד (לריצה הראשונה אחרי חיבור service account): ‏"עשן את הבריסקט 8-10 שעות ב-110°C, עטוף בנייר קצבים כשהקראסט מתייצב (כ-70°C פנימי)."

## 5 · Cost per answer — בשימוש שלנו (~150 תווים/תשובה)

מקורות: ‏[cloud.google.com/text-to-speech/pricing](https://cloud.google.com/text-to-speech/pricing) (העמוד נטען דינמית; מספרים אומתו מול [texttolab.com/blog/google-cloud-tts-pricing](https://texttolab.com/blog/google-cloud-tts-pricing), accessed 2026-07-31, התואם את המחירון שהבעלים הדביק) + ‏[ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing). מדידת Gemini: תשובה ~10s = ‏117 טוקני אודיו (מה-probe של live-api-assessment).

| Option | Per answer | **Per 1,000 answers** | Free tier coverage |
|---|---|---|---|
| Cloud TTS · WaveNet | $0.00060 | **$0.60** | ‏1M תווים/חודש ≈ 6,600 תשובות חינם |
| Cloud TTS · **Chirp 3 HD** | $0.0045 | **$4.50** | ‏1M תווים/חודש ≈ 6,600 תשובות חינם |
| Gemini 2.5 Flash TTS (current) | ≈$0.00119 | **≈$1.19** | אין |
| Gemini 3.1 Flash TTS (preview, capped) | ≈$0.00238 | **≈$2.36** | אין |
| Live API native audio (ruled out) | ≈$0.00160 | **≈$1.60** | אין |

בקנה המידה שלנו כל האופציות עולות סנטים; ‏free tier של Chirp 3 HD כנראה מכסה את השימוש כולו בפועל. **המחיר אינו קריטריון הכרעה.**

## 6 · Streaming & latency

- ‏**Streaming synthesis קיים** ב-Chirp 3 HD (‏`StreamingSynthesize`, פורמטים ‏ALAW/MULAW/OGG_OPUS/PCM; ‏SSML לא נתמך בסטרימינג) — [chirp3-hd docs](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd), accessed 2026-07-31. זהו bidi-streaming (gRPC) — פחות נוח לפרוקסי ב-Worker מאשר HTTP.
- בפועל ל-150 תווים סביר ש-**synthesize רגיל (non-streaming) מספיק** לשער ה-≤3s: קריאת HTTPS אחת שמחזירה את כל האודיו. ‏**Latency לא נמדד** (החסימה ב-§4) — זו המדידה הראשונה שחובה לבצע אחרי חיבור service account, לפני כל החלטת אימוץ.

## 7 · Options table

| Criterion | **Gemini TTS (current, v281 path)** | **Cloud TTS · Chirp 3 HD** | **Live API** (assessed, [2026-07-31-live-api-assessment.md](2026-07-31-live-api-assessment.md)) |
|---|---|---|---|
| Quota | ‏3.1-preview: ‏**100/יום קשיח** (החסם); ‏2.5: פנוי אך איטי/לא יציב | ‏**200 RPM, אין תקרת יום**, GA, ניתן להגדלה | סשנים-במקביל + TPM; אין 100/יום |
| Cost /1000 answers | ‏≈$1.19 (2.5) · ≈$2.36 (3.1) | ‏$4.50 (חינם עד ~6,600/חודש) | ≈$1.60 |
| Latency | ‏streaming: פריים ראשון ‏1,101 ms (מדוד) | **לא נמדד**; קריאה אחת ל-150 תווים, streaming קיים | ‏1,097–1,708 ms לאודיו ראשון (מדוד) |
| Hebrew quality | מוכרת (בשימוש היום) | ‏30 קולות Chirp3-HD, אותם שמות קולות — **לא נשמע בפועל** | נשמעה תקינה ב-probe |
| Architecture fit | קיים; metering מ-usage envelope | ‏Worker + **service account** (JWT ~50 שורות); metering לפי תווים — **פשוט יותר** | שובר את ה-metering (socket ישיר) |
| Safety guard (`vcGuardSpoken`) | ‏רץ לפני סינתזה ✔ | ‏**רץ לפני סינתזה ✔ — זהה להיום** | ‏✘ אודיו לפני שהשומר רץ — נפסל |

## 8 · Ranked recommendation

1. **מסלול מועדף — Cloud TTS עם `he-IL-Chirp3-HD-*` דרך service account ב-Worker.** זה המסלול היחיד שמסיר את חסם ה-100/יום לחלוטין (GA, ‏200 RPM), משמר את שומר הבטיחות אחד-לאחד, ומפשט את המדידה. **מותנה בשני אימותים שלא יכולתי לבצע:** ‏(א) הבעלים יוצר service account ומפעיל את ה-API בפרויקט; ‏(ב) ‏listen-test עברית + מדידת latency מול שער ה-≤3s — הריצה הראשונה מסנתזת את משפט הבריסקט מ-§4.
2. **בינתיים — להישאר על Gemini 2.5 Flash TTS** (הפנוי) כ-fallback עובד; ‏v281 (metered streaming) ממשיכה כמתוכנן עד שהאימותים של (1) עוברים.
3. **Live API נשאר פסול לפלט דבור** (השומר לא יכול לרוץ לפני שהמשתמש שומע) — ללא שינוי מההערכה הקודמת; רלוונטי רק כקשת-קלט עתידית.

## 9 · What I could not verify

- **איכות קול עברית בפועל** — לא הופק אודיו (auth). שמות הקולות הזהים ל-Gemini-TTS הם רמז, לא ראיה.
- **Latency אמפירי** של `text:synthesize` — לא נמדד; "מהיר ל-150 תווים" הוא ציפייה, לא מדידה.
- **דף המחירים הרשמי** נטען דינמית ולא נקרא ישירות; המספרים אומתו ממקור משני התואם את מה שהבעלים הדביק. לפני commit תקציבי — מבט אחד בקונסולה.
- **האם API key שנוצר בקונסולת GCP (לא AI Studio) היה מתקבל** — ה-401 אומר קטגורית שלא, אבל לא נוסה עם מפתח כזה כי אין גישה לקונסולה מכאן.
- **מכסות בפועל של הפרויקט שלנו** — טבלת ה-quotas היא ברירת מחדל תיעודית; המספרים החיים נראים רק בקונסולת GCP של הבעלים.
