# Session-start checklist (Phase 0 · METHODOLOGY §3.3)

חמשת הצעדים, בסדר, בכל פתיחת session:

1. קרא `docs/process/development-discipline.md` — §10 ואז §3 (הכלל הקיים, נשאר ראשון).
2. קרא את ה-Phase הפעיל ב-`docs/ROADMAP-2026-07-30.md` + מצב הלדג'ר (§5) + `docs/STATUS-BOARD.md`.
3. הרץ `node scripts/check-meta.mjs` — טפל בכל אדום לפני עבודה.
4. עבודה סימבולית → serena; שאלות מסמכים/יחסים → graphify; grep = fallback מוצהר.
5. תקרת מקבילות (§10.5a): סדרתי כברירת מחדל; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/build/GPU.
6. Kill-on-replace: לפני החלפה/נטישה של subagent — ‏`TaskStop` ל-id הישן תחילה; אם כבר מת —
   רושמים אותו כ-REPLACED, וכל notification מאוחר ממנו מטופל כרעש.
