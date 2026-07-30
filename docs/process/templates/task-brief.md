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
**Concurrency ceiling (§10.5a, quoted):** סדרתי כברירת מחדל; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/build/GPU;
על 529 — אחד-אחד עם probe קטן תחילה.
**Constraints:** <Global Constraints של התוכנית + גבולות המשימה>
