#!/usr/bin/env node
// scripts/tests/seed-state.mjs — test utility (Arc 2 Phase 2). Seeds a DISPOSABLE
// enforcement-state store (ENFORCEMENT_STATE_PATH must point at a tmp file — this script
// refuses to run without it, so it can never touch the live store by accident) through the
// store's OWN write path, never raw SQL — a seeded row must be a row the real observers could
// have written, or the test proves nothing about production behaviour.
//
//   node scripts/tests/seed-state.mjs attempts <sessionId> <actorId> <target> <n>
//       -> leaves fix_targets.attempts === n for (session, actor, target), via the real
//          failure->edit->failure cycle semantics (§6.1).
//   node scripts/tests/seed-state.mjs event <sessionId> <actorId> <kind> <filePath>
//       -> records one event of `kind` with detail {filePath}.
import {
  openState, noteVerificationFailure, noteEdit, recordEvent,
} from '../hooks/lib/enforcement-state.mjs';

if (!process.env.ENFORCEMENT_STATE_PATH) {
  console.error('seed-state: refusing to run without ENFORCEMENT_STATE_PATH (would touch the live store)');
  process.exit(2);
}
const [, , cmd, sessionId, actorId, ...rest] = process.argv;
const db = openState();
if (!db) { console.error('seed-state: openState() returned null'); process.exit(2); }

if (cmd === 'attempts') {
  const [target, nRaw] = rest;
  const n = Number(nRaw);
  // attempts increments only on a failure that FOLLOWS an edit (§6.1) — so: first failure
  // opens the row at attempts=0, then each (edit, failure) pair closes one cycle.
  noteVerificationFailure(db, sessionId, [target], actorId);
  for (let i = 0; i < n; i++) {
    noteEdit(db, sessionId, target, actorId);
    noteVerificationFailure(db, sessionId, [target], actorId);
  }
} else if (cmd === 'event') {
  const [kind, filePath] = rest;
  recordEvent(db, { sessionId, kind, detail: { filePath }, actorId });
} else {
  console.error(`seed-state: unknown command "${cmd}"`);
  process.exit(2);
}
db.close();
console.log('seeded');
