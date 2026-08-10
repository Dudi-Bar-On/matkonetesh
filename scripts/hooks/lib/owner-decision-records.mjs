// scripts/hooks/lib/owner-decision-records.mjs — the one parser for the discipline doc's
// `**Owner architecture decision (DATE):** <target> — <decision>` records. Extracted from
// fix-cycle-limit.mjs (Arc 2 Phase 2, Task 6) the moment it grew a second consumer
// (worker-ceiling-lock.mjs): two copies of a record grammar are two grammars that will
// eventually disagree, and the record is an ESCAPE HATCH — a divergence here is a block that
// tells the owner their own record "doesn't count." All semantics (UTC parsing, end-of-day
// cutoff for date-only records, unparseable records clear nothing) are unchanged and documented
// at length in fix-cycle-limit.mjs's own header, which remains the narrative home.
//
// /g HAZARD (found during this extraction, not present as a live bug in the single-consumer
// original): OWNER_DECISION_RE carries `lastIndex` across calls when used with RegExp.prototype
// .exec and the `g` flag — harmless inside one module with one call site, but the moment a SECOND
// rule (worker-ceiling-lock.mjs) imports and calls ownerDecisionRecords() independently, two
// consecutive calls sharing the SAME regex object could silently return different results
// depending on call order — a real, order-dependent bug. Fixed here by using `matchAll`, which
// takes its own internal copy of the regex per call and never touches shared state (`test_owner_
// decision_records_is_idempotent_across_two_calls` in tests/test_arc2_phase2_rules.py pins this:
// two back-to-back calls on the same doc must return identical results).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

// Same env-var convention scripts/gate-lessons.mjs already uses for the same document (DISCIPLINE)
// — reused deliberately rather than inventing a second name for the same override, so a test (or a
// future caller) that already knows one knows both.
const DEFAULT_DISCIPLINE_DOC = join(ROOT, 'docs', 'process', 'development-discipline.md');
export function disciplineDocPath() {
  return process.env.DISCIPLINE || DEFAULT_DISCIPLINE_DOC;
}

// Matches both the mirrored date-only form and the finer date-time form, capturing the raw
// parenthesized text (validated/parsed separately by parseCutoffMs) and the target text up to the
// em-dash.
const OWNER_DECISION_RE = /\*\*Owner architecture decision \(([^)]+)\):\*\*\s*(.+?)\s*—/g;

// Parses a record's parenthesized date/date-time into a cutoff instant (ms since epoch), or null if
// unparseable (an unparseable record clears nothing — never a way to bypass by writing garbage).
// Both forms are read as UTC — the finer form's clock reading is NOT local time (see
// fix-cycle-limit.mjs's header comment, fix round 2).
//   - "YYYY-MM-DD"            -> end of that UTC day (start of the NEXT day), the permissive
//                                whole-day reading documented in the header comment above.
//   - "YYYY-MM-DD HH:MM[:SS]" or "YYYY-MM-DDTHH:MM[:SS]" -> that exact UTC instant, hard cutoff.
export function parseCutoffMs(raw) {
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const startOfDay = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(startOfDay)) return null;
    return startOfDay + 24 * 60 * 60 * 1000;
  }
  const fineMatch = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
  if (fineMatch) {
    const iso = `${fineMatch[1]}T${fineMatch[2]}${fineMatch[2].length === 5 ? ':00' : ''}Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

// Every Owner architecture decision record in the live discipline doc, parsed into
// {target, cutoffMs, raw}. Records with an unparseable date are silently dropped (never thrown,
// never treated as clearing anything). Any read failure degrades to an empty list.
export function ownerDecisionRecords() {
  const out = [];
  try {
    const text = readFileSync(disciplineDocPath(), 'utf8');
    for (const m of text.matchAll(OWNER_DECISION_RE)) {
      const cutoffMs = parseCutoffMs(m[1]);
      if (cutoffMs === null) continue;
      out.push({ target: m[2].trim(), cutoffMs, raw: m[1].trim() });
    }
  } catch {
    // intentionally swallowed — see header comment.
  }
  return out;
}
