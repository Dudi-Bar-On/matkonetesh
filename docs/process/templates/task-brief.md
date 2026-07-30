# Task-brief template (METHODOLOGY §2.2 · H9) — brief חסר-שדה = brief פסול

## Brief: <Phase X · Task N — name>

**(א) Spec lines (DoD-1):** <ציטוט מדויק של שורות המפרט שהמשימה מספקת>
**(ב) Exact code from the plan:** <הקוד המדויק מהתוכנית — לא "ראה תוכנית">
**(ג) DoD checklist:** <שורות ה-DoD הרלוונטיות מ-discipline §3, מועתקות>
**(ד) Report contract:** report file `.superpowers/sdd/<arc>-task-<N>-report.md`; must paste: RED output,
GREEN output + exit code, screenshot paths (UI); **ends with the H9 5-row table** (מה היה · מה נעשה+ראיות
[vNNN · date+time] · מה נשאר · איפה אנחנו [from docs/STATUS-BOARD.md] · הבא בתור).
**Verification guidance:** exit codes נלכדים ישירות (`cmd; ec=$?`) — **לעולם לא דרך pipe**
(`cmd | tail; $?` מודד את tail, לא את cmd).
**(ה) Primary tool:** <serena | graphify | אחר> ; grep = fallback מוצהר בלבד.
**(ו) Test-authoring contract (חובה בכל משימה שנוגעת בבדיקות):** הסוכן קורא את
`tests/TEST-AUTHORING-CONTRACT.md` **לפני** שהוא כותב או משנה בדיקה. תמצית מחייבת: ‏`test`/`seedApp`
מ-`./_fixtures` בלבד (הדף החם) · ‏`addInitScript` אסור בדף החם · ‏`isolatedPage` לשעון/SW/`test.use` ·
כל `route` בבדיקה עם `unroute` ב-`try/finally` · המתנה על תנאי בלבד (‏`waitForResponse` אינו הוכחה
שהמצב הוחל) · ‏`npx playwright test` נקי, בלי `--retries`/`--workers`, פורט 8123 פנוי, exit ישיר.
בדיקה שנכתבה מחוץ לחוזה — **נכתבת מחדש**, גם אם היא ירוקה.
**Concurrency ceiling (§10.5a, quoted):** סדרתי כברירת מחדל; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/build/GPU;
על 529 — אחד-אחד עם probe קטן תחילה.
**Kill-on-replace (subagent hygiene):** לפני החלפה/נטישה של subagent — ‏`TaskStop` ל-id הישן **תחילה**;
אם כבר מת — רושמים את ה-id כ-REPLACED, וכל notification מאוחר ממנו מטופל כרעש.
**Constraints:** <Global Constraints של התוכנית + גבולות המשימה>
