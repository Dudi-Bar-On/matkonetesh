// scripts/hooks/observers/edit-tracker.mjs — Phase 4, Group B, Task 3. The other half of §6.1's
// closed cycle ("אימות נכשל → עריכה → אימות שוב"): verification-outcomes.mjs marks a target
// FAILED, this observer marks it EDITED — Task 2's noteEdit() already does the actual bookkeeping
// (it flips `edited_since_failure` on every currently-open target for the session and records its
// own 'edit' event; this file does not duplicate that event).
//
// Only counts a REAL edit: gated on `_outcome.ok === true` (posttooluse.mjs's normalized outcome).
// An Edit/Write call that itself failed (e.g. Edit's old_string not found) changed nothing, so it
// must not arm the next verification failure as "attempt closed" — that would let a no-op edit
// manufacture a fix cycle out of nothing, the exact false-positive shape §6.1 exists to prevent.
//
// UI_BASENAMES / 'ui_edit' feeds Task 10 (not built yet) — recorded here per the brief's explicit
// instruction so that task does not need to re-derive "was this a UI file" from scratch.
import { basename } from 'node:path';
import { openState, noteEdit, recordEvent, normalizeActorId } from '../lib/enforcement-state.mjs';

// Task 14 / R-117: noteEdit() now arms edited_since_failure only on THIS actor's own open targets
// (input.agent_id, normalized) — an edit by one actor must never arm a DIFFERENT actor's own
// fix_targets rows for their next failure. 'ui_edit' stays session-wide by design (see
// enforcement-state.mjs's module header) — the actorId is still attached to the event for audit,
// but no reader filters on it.

const UI_BASENAMES = new Set(['app.js', 'app.css', 'index.html']);

export function observe(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) return;
  if (!input._outcome || input._outcome.ok !== true) return; // a failed edit changed nothing

  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return;

  const filePath = input.tool_input && input.tool_input.file_path;
  const filePathStr = typeof filePath === 'string' ? filePath : null;

  const actorId = normalizeActorId(input.agent_id);
  const db = openState();
  if (!db) return; // fail-open — no state store available, nothing recorded
  try {
    noteEdit(db, sessionId, filePathStr, actorId);
    if (filePathStr && UI_BASENAMES.has(basename(filePathStr))) {
      recordEvent(db, { sessionId, kind: 'ui_edit', detail: { filePath: filePathStr }, actorId });
    }
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
