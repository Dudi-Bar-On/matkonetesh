# Arc-close checklist (Phase 0 · METHODOLOGY §4; enforced at every arc/Phase close)

קשת אינה סגורה עד שכל השורות ירוקות, עם ראיות:

- [ ] **לקחים → §11** (discipline): כל כשל = L-entry; הצלחות = "adopted wins"; אם באמת אין —
      שורת `**No-lesson declaration (YYYY-MM-DD):**` מפורשת. אימות: `node scripts/gate-lessons.mjs` ירוק.
- [ ] **הפקדות לגניזה** (§10.11/§10.16): שער-התועלת הופעל על כל מקור חיצוני שהקשת מצאה;
      המקורות נקלטו (`python scripts/ingest.py --scope` מודבק) או "אין מועמדים" נאמר במפורש.
- [ ] **רענון הגניזה** (§10.12): `python scripts/ingest.py --scope`; אימות:
      `node scripts/check-geniza-fresh.mjs` ירוק.
- [ ] **מרשם + לוח:** שורת ה-Phase ב-`docs/ROADMAP-2026-07-30.md` §5 נכונה; `docs/STATUS-BOARD.md`
      עודכן עם "vNNN · תאריך+שעה" (H10c); `docs/CAPABILITIES.md` קיבל את פיצ'רי הקשת (H11).
- [ ] **no-unlanded-items (H8) ירוק:** `node scripts/check-meta.mjs` — כל הסעיפים OK.
- [ ] **סיכום §10.6 + טבלת H9** נמסרו לבעלים (זו אבן-דרך — H10a מציג).
- [ ] חובות השימור של Dec-A3 (docs/process/single-file-preservation.md) — נבדקו אם הקשת נגעה ב-build/אריזה.
