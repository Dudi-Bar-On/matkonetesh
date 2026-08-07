// scripts/lib/register-scan.mjs — shared "which register rows still await the owner" scan.
// Extracted verbatim from session-brief.mjs's decisionsAwaitingOwner() (2026-08-07) so
// session-state.mjs can use the exact same, already-hardened logic instead of a second
// hand-copied regex family that would drift the first time one side is fixed and the other isn't
// (the project's own R-105 finding, about exactly this failure shape in a different file).
import { readFileSync, existsSync } from 'node:fs';

// A ledger/decision-register row's own ID is its FIRST table cell (never scanned for an id
// anywhere else in the row's text — a description cell can legitimately reference OTHER ids,
// e.g. BR-2's text mentions "(R-6)" in passing; that must not be misread as R-6's own row).
const ROW_ID = /^\|\s*((?:R|BR)-\d+)\s*\|/;
const MARKERS = /(החלטת בעלים(?:\s+נדרשת)?|ממתין להכרעה)/;

// files: array of paths to scan (caller decides which — e.g. [ROADMAP] or [ROADMAP, BOARD]).
// Returns { line, ids } — `line` is a ready-to-print one-liner, `ids` the full open-id list.
export function scanDecisionsAwaitingOwner(files, label = 'DECISIONS AWAITING OWNER') {
  const present = files.filter(existsSync);
  if (!present.length) return { line: `${label}: not established — no register file found (checked: ${files.join(', ')}).`, ids: [] };

  const found = new Map(); // id -> snippet
  for (const f of present) {
    const text = readFileSync(f, 'utf8');
    for (const line of text.split('\n')) {
      const idm = line.match(ROW_ID);
      if (!idm) continue;
      if (!MARKERS.test(line)) continue; // no open-decision phrase anywhere on the row at all
      // Isolate the row's own status cell: split on '|', drop the empty leading/trailing cells a
      // '| ... |'-fenced row always produces, and take what remains rightmost — the table's last
      // real column is always the ruling/status column in this register's convention.
      const cells = line.split('|').map(s => s.trim()).filter((s, i, a) => !(s === '' && (i === 0 || i === a.length - 1)));
      const statusCell = cells[cells.length - 1] ?? '';
      if (/^✅/.test(statusCell.replace(/^[*`\s]+/, ''))) continue; // status cell itself says done — closed, not open
      if (!found.has(idm[1])) found.set(idm[1], line.replace(/[*`|]/g, '').trim().slice(0, 90));
    }
  }
  const ids = [...found.keys()];
  if (!ids.length) return { line: `${label}: 0 found (${present.length} file(s) scanned).`, ids };
  const preview = ids.slice(0, 4).map(id => `${id} (${found.get(id).slice(0, 50)}…)`).join(' · ');
  const more = ids.length > 4 ? ` · +${ids.length - 4} more` : '';
  return { line: `${label}: ${ids.length} — ${preview}${more}`, ids };
}
