# חקירת שכבת הקול (Voice/TTS) — ‏R-27 · 2026-07-31

**Scope:** חקירה בלבד — אפס שינויי קוד. שלוש תלונות הבעלים מבדיקה חיה של v278 (ROADMAP §Phase 12, הערת R-27),
ובנוסף הארכיאולוגיה: עבודת TTS קודמת שלא נחתה במסמך הפערים.
**Method:** serena על ‎app.js (משפחת ‎vc*‎, ‏gemSpeak/gemFetch, רגיסטרי המודלים) + graphify על גרף המסמכים + קריאת המקורות שהגרף הצביע עליהם.
**Measurement caveat:** מדידה חיה של רצף שאלה→שמע דורשת מפתח AI / קוד managed פעיל וקול אמיתי בדפדפן — לא בוצעה.
המספרים למטה הם timeouts וספי-פלטפורמה מהקוד עצמו; המלצת אינסטרומנטציה בסוף.

---

## 1 · Reproduction table

| # | תלונה | Reproduced? | Root cause (file:line) | Measured / threshold | סימפטום למשתמש |
|---|---|---|---|---|---|
| 1 | ההשמעה איטית מאוד | **כן — מבנית, מהקוד** | שרשרת של עד **3 קריאות רשת סדרתיות** ללא שום חפיפה או סטרימינג: (א) ה-ack המדובר "רגע, בודק" הוא בעצמו round-trip מלא ל-Gemini TTS — ‏`vcAskFlow` ‏app.js:6900 → ‏`vcSpeak` 6463 → ‏`gemSpeak` 6432; (ב) קריאת הטקסט ‏`vcAskAI` app.js:6885 — ‏timeout 30s, ‏thinkingLevel 'low' ‏(AI_THINK.vcAsk, 5372), ולעיתים ‏google_search מצורף (6883) שמוסיף שניות; (ג) הקראת התשובה — **בקשת generateContent חוסמת אחת** לכל האודיו (6438, timeout 20s), פענוח base64→PCM מלא (6449-6454) לפני שמתחיל צליל. בתשובה-באנגלית מתווסף לג רביעי: ‏`vcTranslateToEn` 6591-6607 (timeout 30s). אין pre-synthesis, אין cache חם ל-ack בפתיחת הפאנל (‏gemCache 6414 מתמלא רק בשימוש, ומתרוקן כולו מעל 40 ערכים — 6444). **בונוס — race:** שני ‎gemSpeak במקביל (ack + תשובה) קוראים כל אחד ‏`gemStop()` אחרי ה-await ‏(6448) — ack איטי יכול להרוג את השמעת התשובה שכבר התחילה | לא נמדד חי. אריתמטיקת הקוד: ‏ack-TTS ‎~1-2s (ראשון) + טקסט ‎~3-8s (low thinking ± search) + TTS מלא ‎~2-6s ⇒ ‎**~6-15s** משאלה לצליל; ‏retries ברירת-מחדל 1 ב-`gemFetch` (5462) יכולים להכפיל לג | שקט ארוך אחרי כל שאלה/"הקרא"; לפעמים התשובה נקטעת ע"י "רגע, בודק" מאוחר |
| 2 | טקסטים מעט ארוכים לא מוקראים | **כן — שלושה מנגנונים, אף cap מפורש** | **אין שום מגבלת-אורך בקוד** — הכשל הוא זמן/פלטפורמה: (א) ‏timeout **20,000ms** על בקשת ה-TTS (app.js:6438) — סינתזה של טקסט ארוך חורגת → ‏`Error('timeout')` → נפילה **שקטה** ל-`sysSpeak` (מיפוי ההודעות 6469-6473 מכסה רק ‎api-*‎, לא timeout — אין toast); (ב) ‏`gemTtsGen` (5410) **לא קובע maxOutputTokens** — טקסט ארוך יכול להיחתך בצד המודל / לחזור בלי ‏inlineData → ‏`gemReadAudio` זורק ‏'no-audio' (5425) → שוב נפילה שקטה; (ג) ה-fallback ‏`sysSpeak` (6457) בונה ‏**SpeechSynthesisUtterance יחיד בלי chunking** — באג Chrome הידוע: utterance ארוך (‏~15s+, ובאנדרואיד עם קולות-רשת אף קצר מזה) נעצר/לא מתחיל בשקט. שלושת הנתיבים לא-מפוצלים (unchunked) ונכשלים בדממה | **אין סף תווים קבוע בקוד.** הסף האפקטיבי: טקסט שהאודיו שלו ‎>~15-20s — הערכה ‎**~250-350 תווי עברית** (תלוי קול/קצב; לא נמדד). שני המספרים הקשיחים: ‏timeout=20000 (6438) והיעדר ‏maxOutputTokens ‏(5410) | "הקרא עם פרטים" / תשובות AI ארוכות — שקט מוחלט, בלי הודעת שגיאה |
| 3 | כפתורי עברית/אנגלית לא עקביים | **כן — צימוד-מצב נסתר** | יש **שני זוגות** כפתורים (app.js:6522-6529): 🎙️ שפת-דיבור ‏(`mk-vclang`) ו-🔊 שפת-תשובה ‏(`mk-vcanslang`). ‏`vcAnsLang()` (6394) נופל ל-`vcLang()` כשאין ערך שמור ⇒ **עד הלחיצה הראשונה על כפתור-תשובה, כפתורי הדיבור משנים גם את שפת התשובה; אחריה — מנותקים לצמיתות** (הערך נשמר ב-store לעד, אין reset). בנוסף: ‏`vcLang()` (6393) ברירת-מחדל לפי שפת ה-UI אבל ערך שמור שורד החלפת שפת-UI ⇒ אי-התאמה; תשובה-EN על תוכן עברי דורשת תרגום AI — בלי מפתח מוקרא **עברית** למרות שנבחר English (‏`vcSpeakContent` 6612-6615, רק toast); תופעות-לוואי אסימטריות — כפתורי-דיבור מאתחלים את המיקרופון (6580-6581), כפתורי-תשובה מדברים אישור (6582-6583); ‏qtemp/qwhen בונים תשובה ישירות בשפת-התשובה בעוד "הקרא" עובר מסלול תרגום — קולות/התנהגות שונים לאותה בחירה | — | אותה לחיצה עושה דברים שונים בזמנים שונים; "English" שלפעמים עדיין מדבר עברית |

---

## 2 · Archaeology — מה נבדק בעבר ולא נחת

הבעלים צודק: העבודה קיימת, מפורטת, ומדויקת להפליא לתלונות של היום — ורובה **לא נחתה** לא במסמך הפערים ולא ב-ROADMAP.

### 2.1 · `docs/research/03-tts.md` — מחקר Wave 4, נושא 3 (2026-07-15, ‏18 שאילתות רשת)
המסמך שהבעלים זוכר. מכיל **בדיוק** את שני הדברים שציין:
- **איכות הגיית עברית** — §"Why Hebrew TTS is hard": בעיית הניקוד (המנוע חייב להסיק תנועות+הטעמה), דירוג מלא: ‏ElevenLabs v3 הכי טבעי (Tier S), ‏Gemini TTS "good" (Tier A, preview), קולות מערכת בינוניים (‏Carmit הכי חלש), ‏OpenAI TTS "practically unusable" לעברית, ‏Polly בלי עברית בכלל.
- **מנוע מקומי חליפי** — §"Offline / on-device": ‏**Phonikud + Israwave/Piper (VITS-ONNX) דרך sherpa-onnx WASM** — עברית ניורלית אופליין ריאלית לראשונה ב-2026, real-time על CPU; עשרות MB ⇒ הוצע כ-**Phase-2 opt-in download**. זה "השימוש החליפי במנוע מקומי" שהבעלים זוכר.
- **וגם — טקטיקות latency** (§"Customization design") שפותרות ישירות את תלונה 1: לדבר מיידית ב-Web Speech בזמן שאודיו-ענן נטען ברקע, ‏pre-synthesis של הצעד הבא, ‏cache ביטויים חוזרים ב-IndexedDB, ‏TTSProvider abstraction עם adapter פר-ספק.

**Landing status:** רק ההחלטה העליונה ("להישאר Google, ‏ElevenLabs פרימיום") נרשמה בלדג'ר ‏STATUS-BOARD ‏(שורת 15.7.26). ‏**אף אחד** מהבאים לא הופיע במסמך 141/156 הפערים או ב-ROADMAP: טקטיקות ה-latency, ‏chunking/pre-synthesis, ‏TTSProvider abstraction, פרוטוטיפ ה-Piper האופליין, ופער איכות ההגייה עצמו. ⇒ ‏**Orphans — בדיוק מחלקת הכשל H8** (ידע ללא נחיתה: לא Phase, לא deferral מעוגן-טריגר, לא משימת brainstorm).

### 2.2 · `docs/research/README.md` — "Bucket A — Buildable Now"
שורות 24-25 רושמות במפורש כ"ניתן לבנייה עכשיו": ‏provider+voice picker, ‏next-step pre-synthesis, ‏phrase caching ב-IndexedDB, טיפול iOS user-gesture; ו-(Phase-2) קול עברי ניורלי אופליין. **גם זה orphan** — אף פריט לא נרשם.

### 2.3 · מה כן נחת (להשוואה)
- ‏`analysis/program/tts-3.1-migration-research.md` — הגירת ‏TTS→gemini-3.1-flash-tts-preview (v261, לדג'ר 24.7.26) ✅; כולל הערה ש-2.5-preview-tts החזיר 400 על קלט קצר.
- מסמך הפערים ULTIMATE: ‏E8 (TTS חייב את הבעלים בשקט — תוקן v262-263 ✅), ‏E13 (שגיאות TTS עברית-בלבד — Phase 12), ‏A12 (גארדים חזותיים לא מגיעים ל-TTS), ‏A15 (חוק %/pH בדיבור), ‏C10, ‏R-23 — כולם רוכבים על חילוץ Voice Module ב-Phase 12.
- ‏W1-F/VERIFY: ‏vcAskAI ‏Tier-D ללא גארד — נסגר (‏vcGuardSpoken, ‏P0 v262-263, ‏R-2/R-3 v278) ✅.
- ‏W4-B pricing: ‏TTS = ‏16% מעלות פרסונה C (החיפוש 77% — ההקשר הכלכלי לכל שינוי).

**שורה תחתונה ארכיאולוגית:** שלוש התלונות של R-27 היו צפויות וכתובות מראש ב-03-tts.md (איטיות → §Latency tactics; הגייה → §Why Hebrew is hard; מנוע מקומי → §Offline). הכשל אינו כשל ידע — כשל נחיתה (H8).

---

## 3 · Verdict per defect — תיקון ממוקד או ריפקטור?

| # | Verdict | נימוק | אומדן ממוקד (השבוע) | אומדן דרך Phase 12 |
|---|---|---|---|---|
| 1 איטיות | **תיקון ממוקד — לא דורש חילוץ מודול** | כל התורמים חיים בתוך ‎4 פונקציות (‏vcAskFlow/vcSpeak/gemSpeak/vcSpeakContent). ‏Sentence-chunking (לסנתז משפט ראשון ולהשמיע בזמן שהשאר מסונתז), ‏ack מקומי/מוקדם-cache, ביטול ה-race ע"י token של "הדובר הנוכחי" | ‎**3-4 משימות** (chunk-pipeline ‏+ ack ‏+ race-token ‏+ מדידה/בדיקות) | +‎~6 משימות חילוץ לפני שנוגעים |
| 2 טקסטים ארוכים | **תיקון ממוקד — אותו מנגנון chunking** | הפיצול למשפטים פותר בבת-אחת את ה-timeout (כל chunk קצר), את חיתוך-המודל, ואת באג ה-utterance הארוך ב-sysSpeak; להוסיף toast על timeout/no-audio (היום נופל בשקט) | ‎**2 משימות** (chunk גם ב-sysSpeak; שגיאות גלויות) — רוכב על 1 | כנ"ל |
| 3 כפתורי HE/EN | **תיקון ממוקד + החלטת UX קטנה של הבעלים** | הסרת ה-fallback הנסתר של ‏vcAnsLang→vcLang (לקבע ערך מפורש ברינדור, או פקד אחד "שפת קול" עם advanced split); יישור התנהגות keyless-EN (לסרב/להבהיר במקום להקריא עברית) | ‎**1-2 משימות** | כנ"ל |
| — ריפקטור עומק | **עדיין מוצדק — אבל לא כתנאי** | חילוץ Voice Module נשאר הבית של A12/E13/A15/C10/R-23 ושל ‏TTSProvider abstraction + מנוע מקומי (Piper) מ-03-tts.md | — | ‎~10-14 משימות (חילוץ+abstraction+riders) |

**תשובה לשאלת הבעלים:** שלוש התלונות ניתנות לתיקון **השבוע** (‏~6-8 משימות סה"כ, כולל בדיקות ו-DoD) בלי לחכות ל-Phase 12. הריפקטור אינו תנאי-קדם לאף אחת מהן; הוא תנאי-קדם ל-TTSProvider abstraction ולמנוע המקומי.

---

## 4 · Recommendation — sequencing ("Voice Wave 0")

**Voice Wave 0 (להקדים — זול, עצמאי):**
1. ‏Sentence-chunked TTS pipeline בתוך ‏gemSpeak/sysSpeak (סוגר #1+#2 יחד) + speaker-token נגד ה-race.
2. ‏Ack מיידי: קול מערכת / cache חם בפתיחת הפאנל — אפס רשת לפני "רגע, בודק".
3. שגיאות TTS גלויות (timeout/no-audio → toast) — מקדים חלקית את E13.
4. איחוד פקדי השפה (אחרי החלטת-UX קצרה של הבעלים).
5. אינסטרומנטציה: הרחבת ‏GEM_USAGE ‏(app.js:5436) ב-latency פר-קריאה + תזמון TTS — כדי שהתלונה הבאה תהיה מספר, לא תחושה.

**נשאר תלוי-Phase 12 (חילוץ Voice Module):** ‏TTSProvider abstraction ‏(03-tts.md §Customization), מנוע מקומי ‏Phonikud/Piper (opt-in download), ‏A12/A15/C10/R-23, ‏E13 המלא, בחירת ספק פרימיום (ElevenLabs).

**חובת H8:** לרשום את יתומי 03-tts.md/README (latency tactics · TTSProvider · offline Piper · פער איכות הגייה) כשורות לדג'ר עם בית — Wave 0 או Phase 12 — כדי שהכשל לא יחזור.

---

## 5 · Open questions for the owner

1. **הקדמה:** מאשר "Voice Wave 0" עכשיו (לפני המשך התוכנית), או ממתין ל-Phase 12?
2. **UX השפה:** פקד אחד "שפת קול" (דיבור+תשובה יחד) עם split מתקדם, או שני זוגות כמו היום אבל מנותקים במפורש?
3. **Keyless + English:** בלי מפתח AI ותוכן עברי — להקריא עברית עם אזהרה (היום), או להשבית את כפתור EN?
4. **מנוע מקומי:** האם פרוטוטיפ ‏Phonikud+Piper (עשרות MB, opt-in) שווה שורת brainstorm ב-Phase 12, או ‏ElevenLabs-פרימיום מספיק לאיכות ההגייה?
5. **מדידה:** לאשר הפעלת אינסטרומנטציית-latency (סעיף 4.5) כך שה-DoD של Wave 0 יהיה מספר נמדד (יעד מוצע: ‎<2s לצליל ראשון)?

---
*Investigation only — no product code or tests touched. Sources: app.js (serena), docs graph (graphify), 03-tts.md, research/README.md, ULTIMATE gaps, ROADMAP-2026-07-30, STATUS-BOARD, W4-B, VERIFY-W1-F, tts-3.1-migration-research.*
