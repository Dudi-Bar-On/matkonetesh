# Runtime Hebrew Diacritization — מחקר: ניקוד בזמן-ריצה לטקסט לא-ידוע-מראש, בחינם או כמעט-חינם

**Task.** הנחיית הבעלים: *"אני צריך פתרון לטקסט דינמי, לא בהכרח ידוע מראש… ולא עלויות פרמיום — חינם או
מאוד זול."* כלומר: ניקוד תשובות שה-AI מחולל (טקסט שלא קיים בזמן build) רגע לפני שהן מוקראות ב-TTS.
ניקוד build-time של מחרוזות קבועות אינו התשובה כאן — הוא מכסה רק טקסט סטטי.

**Gate.** אימוץ בפועל של *כל* אפשרות במסמך הזה מותנה בפסק-הדין של הבעלים ב-A/B העיוור שנמסר לו —
האם ניקוד בכלל משפר את ההגייה של Gemini/Google TTS. המסמך עונה רק על "איך מספקים ניקוד בזמן-ריצה
אם התשובה חיובית". שום דבר כאן אינו התחייבות.

**Baseline (established, not re-derived).** `docs/analysis/2026-07-31-phonikud-local-trial.md`:
Phonikud רץ מקומית ב-~26ms/משפט על CPU, ~400MB RAM, מודל int8 של ~294MB (509MB עם החבילות).
האינווריאנט הבטיחותי החזיק — ספרות ויחידות לא שונו — בכפוף להסרת תו ה-`|` (PREFIX_CHAR).
הארכיטקטורה: PWA בקובץ יחיד (~1.99MB תקציב bundle) + Worker אחד של Cloudflare (~10MB) שמחזיק את
המפתח. לא הדפדפן ולא ה-Worker יכולים לארח מודל של 300MB — ומכאן המחקר הזה.

**Latency budget.** נתיב הקול נכתב מחדש לסינתזה משפט-אחר-משפט; קריאת TTS ענן למשפט היא ממילא בסדר
גודל של 1–3 שניות. תקרה מוצהרת: **צעד ניקוד סדרתי לכל משפט חייב להוסיף ≤ ~500ms**, או להיות מוסתר
לחלוטין (מנוקד מראש ברמת התשובה, או בחפיפה מלאה לצינור). אפשרות שמוסיפה >1s סדרתי למשפט — נפסלת.

---

## 1 · Options table

| # | Option | How it works | Cost at our volume | Latency (measured/estimated) | Limits / ToS | Privacy | Fail-open |
|---|---|---|---|---|---|---|---|
| A1 | **Gemini מנקד את התשובה בעצמו, באותה קריאה** | מוסיפים להנחיית המערכת של תשובות-הקול דרישה להחזיר גם עותק מנוקד (או לנקד את הטקסט המיועד ל-TTS בלבד), אחרי ה-safety guard | ~0$ — טוקנים בודדים נוספים על קריאה שכבר משולמת | **0ms נוסף** (אין hop) | מגבלות ה-API הקיימות בלבד | אין צד חדש — הטקסט כבר אצל Google | טריוויאלי: אם העותק המנוקד חסר/פסול — מדברים את הרגיל |
| A2 | **קריאת Flash שנייה לניקוד בלבד** (נבדק אמפירית §2) | קריאה ל-`gemini-3.6-flash` עם `thinkingLevel:"minimal"`, prompt "נקד בלבד", טמפ' 0 | אגורות לחודש: נמדדו 42–155 output tokens למשפט; גם באלפי תשובות/חודש — הרבה מתחת ל-1M tokens במחירי Flash | **1.2–1.6s למשפט** (נמדד); קריאה אחת לכל התשובה — בחפיפה לסינתזת המשפט הראשון או לפניה | מגבלות ה-API הקיימות; מדיניות הבעלים maxTokens 8192 | כנ"ל — אין צד חדש | timeout קצר → מדברים את הרגיל |
| B | **Dicta Nakdan public API** (נבדק חי §3) | POST JSON ל-`nakdan-u1-0.loadbalancer.dicta.org.il/api`, ‏`task:"nakdan", genre:"modern"`; מרכיבים מחדש מהאופציה הראשונה לכל מילה ומסירים `\|` | 0$ — ללא auth, ללא מפתח | **1.1–1.5s לקריאה** (נמדד מכאן, כולל TLS handshake; שרת בענן AWS) | **אין ToS/rate-limit מפורסמים** — לא אומת לשימוש production; נדרשת פנייה לדיקטה | **שולח את טקסט התשובה לצד שלישי שהבעלים לא אישר** | timeout → מדברים את הרגיל |
| C | **Nakdimon ONNX בדפדפן** — מודל של **20.3MB**, MIT | ‏onnxruntime-web + הורדה עצלה חד-פעמית של המודל ל-Cache Storage (לא ב-bundle; רק למשתמשי קול) | 0$ (סטטי, אפשר להגיש מ-Pages) | צפוי עשרות-מאות ms/משפט ב-WASM — **לא נמדד** | MIT; דיוק נמוך מדיקטה (מודל "ללא מילון") — לא נמדד על טקסט האפליקציה | **מושלם — הטקסט לא עוזב את המכשיר** | המודל לא נטען/איטי → מדברים את הרגיל |
| D1 | **phonikud int8 על Cloud Run free tier** | קונטיינר עם המודל אפוי ב-image; scale-to-zero | 0$ בפועל: ‏180K vCPU-s + 360K GiB-s + 2M בקשות חינם/חודש; ב-26ms/משפט זה מיליוני משפטים; דורש כרטיס אשראי וחשבון GCP | ‏26ms חם + **cold start של שניות-עשרות שניות** (טעינת מודל 294MB = ~1.3s אחרי עליית הקונטיינר) | free tier מתאפס חודשי; מעבר לו — חיוב אמיתי | הטקסט נשלח לשרת *שלנו* על GCP — צד ענן חדש אך בשליטתנו | timeout → מדברים את הרגיל |
| D2 | **phonikud על HF Spaces free (CPU basic)** | Space עם FastAPI + המודל | 0$ | חם: עשרות ms; **נרדם אחרי 48h חוסר-פעילות; יקיצה = דקות** (בניית קונטיינר) | free tier ללא SLA; 2 vCPU | כנ"ל — שרת שלנו על HF | timeout → רגיל; אבל יקיצה של דקות = כמעט-תמיד-רגיל אצל משתמש מזדמן |
| D3 | **phonikud על Oracle always-free ARM** | VM תמידית, ללא cold start | 0$ — אבל: הקצאה **קוצצה ביוני 2026 ל-2 OCPU/12GB**; reclaim של VM "רדומה" (<10% CPU/רשת לאורך 7 ימים); בעיות "Out of Capacity" ידועות | עשרות ms + רשת; אין cold start | תפעול VM מלא עלינו (עדכונים, TLS, אבטחה) | כנ"ל | השרת שלנו נופל → מדברים את הרגיל |
| — | Fly.io / Render / Railway free | — | **נפסלו**: Fly ביטל את חינם לחשבונות חדשים; Render free = 512MB RAM (המודל צריך ~400MB רק ל-inference — לא נכנס) + שינה אחרי 15 דק'; Railway = ‏$5 trial חד-פעמי | — | — | — | — |
| — | Cloudflare Workers AI / Containers | — | **אין מודל ניקוד/עברית בקטלוג** (אומת ישירות מול רשימת המודלים); ה-LLMs הכלליים שם לא נבדקו לניקוד ואין סיבה להעדיפם על Gemini שכבר משולם; Containers דורשים תוכנית בתשלום | — | — | — | — |

---

## 2 · Evidence — ניסוי אמפירי: Gemini מנקד בעצמו (Option A)

**Setup.** ‏6 מתוך 12 משפטי הניסוי של Phonikud (s03, s04, s06, s08, s10, s12 — מהמסמך
`docs/analysis/2026-07-31-phonikud-local-trial.md` §2; קובץ ה-bench המקורי בסקראצ'פאד כבר לא קיים,
המשפטים שוחזרו מהמסמך המחויב). מודל: `gemini-3.6-flash` (המודל שהאפליקציה כבר משתמשת בו), REST
‏`generateContent`, טמפרטורה 0, ‏maxOutputTokens 8192 (מדיניות הבעלים), prompt: "נקד… אל תשנה אף תו
שאינו ניקוד… החזר אך ורק את הטקסט המנוקד". שתי ריצות: ברירת-מחדל (thinking מלא) ו-`thinkingLevel:"minimal"`.
בדיקות מכניות: (1) strip של U+0591–U+05C7 והשוואה תו-תו למקור; (2) השוואת רשימות הטוקנים
`ספרות / °C / °F / FDA / Cure` בין קלט לפלט.

**Results (run of 2026-07-31):**

| Run | Niqqud produced | Digits/units identical | Strip-exact | Latency |
|---|---|---|---|---|
| ‏thinking מלא (ברירת מחדל) | 6/6 | **6/6** | 4/6 | ‏3.8–18.5s ‏(599–3,635 thought tokens) — **פסול לצינור** |
| ‏`thinkingLevel:"minimal"` | 6/6 | **6/6** | 3/6 | **1.2–1.6s למשפט** |

**מהות אי-ההתאמות (strip-exact):**
- נרמול כתיב חסר — `קישוט→קִשּׁוּט`, `בידוד→בִּדּוּד` ("קשוט", "בדוד" אחרי strip). להגייה — זהה; לא מזיק ל-TTS.
- **ממצא קריטי אחד** בריצת minimal: ‏s04 — Gemini שינה **מילה**: `הגשה נא` (נא = raw) → `הגשה נָאָה`
  (נאה = יפה). שינוי משמעות של ממש במשפט בטיחות-הקפאה. בריצת ה-thinking המלא אותו משפט יצא נקי.
  **מסקנה: ניקוד-LLM חייב שומר מכני, לא אמון.**

**דוגמת פלט (s03, minimal):**
‏פִּסְטוּר אֵינָהּ רַק טֶמְפְּ' אֶלָּא זְמַן כָּפוּל טֶמְפְּ' בִּמְרְכַּז הַנֵּתַח. עוֹף בְּ-60°C לְמֶשֶׁךְ כְּ-35 דַּקּוֹת בָּטוּחַ כְּמוֹ 74°C לְרֶגַע — לְפִי טַבְלָאוֹת בּוֹלְדְּוִוין.

**The mandatory guard (both A1 and A2), client-side, ~10 lines:** מסירים ניקוד מהפלט ומשווים למקור;
מתירים אך ורק מחיקות של י/ו (נרמול כתיב חסר); משווים רשימת ספרות/יחידות טוקן-לטוקן; כל חריגה אחרת →
זורקים את הניקוד ומדברים את הטקסט הרגיל. זה בדיוק המקבילה של בדיקת ה-`|` שנדרשה ל-Phonikud —
ורץ **אחרי** ה-safety guard המדובר, על הטקסט המיועד ל-TTS בלבד (INV-P נשמר; הניקוד לעולם לא נוגע
בערכי `safe`/`temp`/משכי בישול — הוא שכבת תצוגה קולית בלבד).

**Cost.** ‏A1: טוקנים ספורים נוספים לקריאה קיימת ≈ 0$. ‏A2: נמדדו 42–155 output tokens למשפט
(‏~84–155 למשפטים "אמיתיים"); תשובה שלמה בקריאה אחת — מאות טוקנים; גם באלפי תשובות בחודש התוספת
נשארת הרבה מתחת למיליון טוקנים בחודש במחירי Flash — זניח, על מפתח שכבר משולם. אין צד-ג' חדש.

Scripts + raw JSON: ‏`gemini_niqqud_test.py`, ‏`gemini_niqqud_results*.json` בסקראצ'פאד של הסשן
(לא בקוד המוצר; המפתח נקרא מהסביבה בלבד ולא הודפס).

## 3 · Evidence — Dicta Nakdan API (Option B), נבדק חי

- ‏Endpoint (מתועד בקהילה, לא רשמית): `POST https://nakdan-u1-0.loadbalancer.dicta.org.il/api`,
  ‏body: ‏`{"task":"nakdan","data":"<text>","genre":"modern"}`.
- **עובד היום (2026-07-31): HTTP 200, ללא auth.** ארבע קריאות: 1.10s, 1.14s, 1.45s, 1.52s (משפט קצר
  ומשפט ארוך דומים — הזמן נשלט ע"י round-trip + handshake, לא ע"י אורך הטקסט).
- מבנה תשובה: מערך לכל מילה עם `options` (הראשונה = הבחירה של דיקטה) + דגלי `fconfident`; אופציות
  מכילות `|` כמפריד מורפמות — בדיוק כמו phonikud, ונדרשת אותה הסרה. הספרות חוזרות כ-token נפרד ללא
  שינוי (`"word":"60","sep":true`).
- הערת סביבה: מהמכונה הזו נדרש עקיפת TLS-inspection של Norton (אותה תקלה מהניסוי המקומי) — בעיה
  מקומית, לא של השירות.
- **מה לא אומת:** אין מסמך ToS/rate-limits/רישיון פומבי ל-API (עמודי dicta.org.il הם SPA שלא חושף
  טקסט; החיפושים העלו רק שימושי קהילה — פורום אוצריא, ימות המשיח). מאמר ה-ACL של Nakdan מכריז
  "freely accessible for all use" על *הכלי*, לא על ה-API בנפח תוכנתי. שימוש production מחייב פנייה
  לדיקטה לאישור בכתב — וגם אז נשארת בעיית הפרטיות: טקסט תשובות המשתמש יישלח לצד שלישי שהבעלים
  טרם אישר.

## 4 · Smaller models (Option C and friends)

- **Nakdimon** ‏(Gershuni & Pinter, "Restoring Hebrew Diacritics Without a Dictionary") — ‏
  `Nakdimon.onnx` = ‏**21,312,852 bytes ≈ 20.3MB**, רישיון MIT, ‏inference ב-onnxruntime בלבד.
  קטן פי ~14 מ-phonikud-int8; גדול מדי ל-bundle ול-Worker script (מגבלת ~10MB), אבל בר-הורדה-עצלה
  לדפדפן עם קאשינג — ‏0$, פרטיות מושלמת, offline. החסרונות: דיוק נמוך מדיקטה (זה כל הרעיון של המאמר
  — לוותר על המילון תמורת גודל), התנהגותו על טקסט בישול מודרני עם ספרות/יחידות **לא נבדקה**, ונדרש
  לבדוק את מהירות ה-WASM בפועל בדפדפן. מועמד יחיד רציני ל"מודל בדפדפן".
- ‏phonikud-onnx: הווריאנט הקטן ביותר שפורסם הוא ה-int8 (~294MB) — אין גרסת single-digit-MB.
- המודל שמאחורי הנקדן המודרני של דיקטה — `dicta-il/dictabert-large-char-menaked` ‏(CC-BY 4.0,
  ‏BERT-large) — גם המקוונטז שלו ~300MB; לא פותר את בעיית הגודל.
- ‏D_Nikud / MenakBert — מבוססי BERT בסדרי גודל דומים; אין יתרון גודל.
- ניקוד חוקי/סטטיסטי "קל" ללא מודל — לא נמצא פרויקט חי באיכות שמישה; הבעיה דורשת הקשר מורפולוגי.

## 5 · Hosting a ~300MB model for free (Option D) — the honest numbers

| Platform | Free allowance (verified 2026-07-31) | Fit |
|---|---|---|
| Google Cloud Run | ‏180,000 vCPU-s + 360,000 GiB-s + 2M requests/חודש חינם, scale-to-zero | **כן** — בנפח שלנו זה 0$ בפועל; המחיר האמיתי הוא cold start (שניות עד עשרות שניות עם image של ~700MB) ו-onboarding של GCP + כרטיס אשראי |
| HF Spaces (cpu-basic) | חינם, 2 vCPU; **שינה אחרי 48h חוסר פעילות**, יקיצה איטית | גבולי — לאפליקציה עם שימוש מזדמן המשתמש הראשון כמעט תמיד יפגוש שירות רדום |
| Oracle always-free ARM | **קוצץ ב-15.6.2026 ל-2 OCPU/12GB** (ללא הודעה); reclaim על idle של 7 ימים; "Out of Capacity" תדיר | אפשרי אך שביר; עלות תפעול-אנוש הכי גבוהה |
| Fly.io / Render / Railway | ‏Fly: אין חינם לחדשים; Render free: 512MB RAM (לא מכיל ~400MB inference) + שינה 15 דק'; Railway: ‏$5 חד-פעמי | **לא** |
| Cloudflare Workers AI / Containers | אין מודל עברית/ניקוד בקטלוג; Containers = תוכנית בתשלום | **לא** רלוונטי כמארח למודל הזה |

## 6 · What could NOT be verified

1. תנאי שימוש/מגבלות קצב רשמיים של Dicta Nakdan API — לא קיימים בפומבי; נדרשת פנייה ישירה.
2. נכונות פונולוגית של ניקוד Gemini באוזן אנושית — הבדיקה כאן מכנית (ספרות/יחידות/זהות טקסט); איכות
   הניקוד עצמו נותרה לאוזן הבעלים, בדיוק כמו ב-A/B של Phonikud.
3. דיוק Nakdimon על טקסט האפליקציה ומהירות WASM בדפדפן — דורש ניסוי נפרד אם הכיוון ייבחר.
4. ‏cold start מדויק של Cloud Run עם image של ~700MB — הטווח "שניות–עשרות שניות" הוא הערכה מהתיעוד
   והקהילה, לא מדידה שלנו.
5. האם A1 (ניקוד בתוך אותה קריאת-תשובה) פוגע באיכות התשובה עצמה — לא נבדק; זו בדיוק מטרת הניסוי המוצע ב-§8.

## 7 · Ranked recommendation

**First choice — Option A (Gemini self-diacritization), בצורת A1 ואם לא — A2:**
זה הפתרון היחיד שעומד בו-זמנית בכל ארבעת הקווים האדומים: 0$ אמיתי (אין תשתית חדשה, אין צד-ג' חדש),
בתוך תקציב ההשהיה (A1 = ‏0ms; ‏A2 = ‏1.2–1.6s בקריאה אחת לתשובה, בחפיפה), פרטיות ללא שינוי (הטקסט
כבר עובר דרך Gemini), ו-fail-open טריוויאלי. הראיות: ‏6/6 ניקוד, ‏6/6 שימור ספרות ויחידות, במחיר
שומר-מכני קצר שהוא ממילא חובה מוסרית אחרי ממצא ה-`נא→נאה`. **הסיכון הגדול ביותר: דריפט מילים של
LLM** — מנוהל ע"י השומר (fail-open לטקסט רגיל), לא ע"י אמון.

**Fallback — Option D1 (phonikud int8 על Cloud Run free tier):**
אם ה-A/B יראה שדווקא הניקוד המורפולוגי המדויק של phonikud/דיקטה משפר את ה-TTS ושל Gemini לא —
המודל שכבר אומת מקומית עולה לענן ב-0$ בפועל, ‏26ms/משפט חם, עם cold start כחסרון המרכזי ופנייה
לשרת-שלנו (לא צד-ג') כפרופיל הפרטיות. ‏Option B (דיקטה) נדחה מ-fallback ראשי בגלל שילוב של היעדר
ToS + שליחת טקסט משתמשים לצד שלישי לא-מאושר — הוא הופך רלוונטי רק אם דיקטה תאשר בכתב והבעלים
יאשר את הפרטיות. ‏Option C (Nakdimon בדפדפן) הוא הכיוון האסטרטגי היפה ביותר (0$, offline, פרטי)
אבל דורש ניסוי דיוק+מהירות משלו לפני שידורג מעל.

## 8 · Exact next step (a small trial, not a commitment)

עדיין gated על פסק ה-A/B. אם הבעלים פוסק שניקוד משפר:

1. ‏12 משפטי הניסוי → ‏Gemini ‏A2 ‏(`thinkingLevel:"minimal"`) → השומר המכני → ‏Gemini-TTS, לצד
   גרסאות Phonikud מה-A/B הקיים — האזנה עיוורת שלישית: ‏Gemini-niqqud מול Phonikud-niqqud מול רגיל.
2. במקביל, בדיקת A1 זולה: פרומפט-תשובה אחד שמבקש עותק מנוקד של הטקסט-לדיבור, על 5 שאלות אמיתיות
   מהאפליקציה — לוודא שאיכות התשובה לא נפגעת ושכללי השומר עוברים.
3. החלטת ship רק אחרי ששני אלה ירוקים; ‏INV-P נשאר: ניקוד רק אחרי ה-safety guard, רק על טקסט TTS.

## 9 · Sources (accessed 2026-07-31)

- ניסוי מקומי קודם: `docs/analysis/2026-07-31-phonikud-local-trial.md`; ‏spec: ‏`docs/superpowers/specs/2026-07-31-voice-wave0-design.md` §6.1; ‏`docs/research/03-tts.md`.
- מדידות חיות של היום: ‏Dicta API ‏(4 קריאות curl), ‏Gemini ‏(12 קריאות, שתי תצורות) — סקריפטים ופלט גולמי בסקראצ'פאד.
- Dicta Nakdan: https://nakdan.dicta.org.il/ · https://nakdan.dicta.org.il/api ‏(SPA, ללא טקסט תיעוד) · Shmidman et al., "Nakdan: Professional Hebrew Diacritizer", ACL 2020 — https://aclanthology.org/2020.acl-demos.23/ · שימושי קהילה ב-API: https://otzaria.org/forum/topic/1514/ · https://f2.freeivr.co.il/topic/18461/
- Nakdimon: https://github.com/elazarg/nakdimon ‏(MIT; ‏Nakdimon.onnx = ‏21,312,852B נמדד דרך GitHub raw HEAD)
- DictaBERT-menaked: https://huggingface.co/dicta-il/dictabert-large-char-menaked ‏(CC-BY 4.0) · דיון ONNX/quantized ~300MB: https://huggingface.co/dicta-il/dictabert-large-char-menaked/discussions/2
- Cloud Run pricing/free tier: https://cloud.google.com/run/pricing
- HF Spaces sleep/free: https://huggingface.co/docs/hub/en/spaces-overview · https://discuss.huggingface.co/t/cannot-change-the-sleep-time-for-cpu-basic-spaces/136205
- Oracle free-tier cut (June 2026): https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/ · https://terminalbytes.com/oracle-cloud-free-tier-changes-2026/
- Fly/Render/Railway free-tier status: https://www.saaspricepulse.com/tools/flyio · https://render.discourse.group/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303 · https://www.saaspricepulse.com/tools/railway
- Cloudflare Workers AI catalog (אין מודל עברית/ניקוד): https://developers.cloudflare.com/workers-ai/models/

---

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr
