// scripts/hooks/rules/derived-artifact-source.mjs — L16: "a summary written from recollection is
// not the source." The documented failure: a CLAUDE.md was shipped that omitted §3 and §4 —
// the discipline's own self-described core — because it was written from memory of the source
// instead of from the source. The gate L16 itself states: "when writing anything that REPRESENTS
// a source document, open the source and work section by section through it."
//
// PAYLOAD POSITION (Phase-1 correction — where the construct actually lives): the TARGET PATH.
// This rule fires only when tool_input.file_path's basename is CLAUDE.md — the one derived
// artifact whose source mapping is unambiguous (docs/process/development-discipline.md, which
// CLAUDE.md's own header names as authoritative). Content is irrelevant: ANY edit to the
// derived artifact without the source open is the failure shape.
//
// SEVERITY: BLOCK. The harm is to substance — a wrong CLAUDE.md misleads every subagent in every
// future session (subagents inherit CLAUDE.md, not conversation memory). The alternative is
// reachable and costs ONE tool call: Read docs/process/development-discipline.md, then edit.
// No bypass exists — only that less-efficient-by-one-call path.
//
// CHANNEL-LIVENESS PROBE (controller's finding on Task 1's review, answered here — this is the
// ONLY place upstream of a block that can catch it, since Task 1 deliberately left `recentEvents()`
// returning `[]` identically for "channel unwired" and "nothing read"): the signal used is "does
// THIS session have ANY file_read row, for ANY actor, for ANY file". If the observer is
// unregistered, the Read matcher regressed, or the state file cannot be opened on a fresh clone,
// a session that has plainly been running Reads will still show zero file_read rows overall — not
// just zero rows for the discipline doc. That is why the probe is unfiltered-by-path: a targeted
// "is docs/process/development-discipline.md among the rows" query cannot distinguish "the actor
// never opened it" from "no Read has ever been recorded, because nothing records them" — both
// produce the same empty result. The unfiltered count is a DIFFERENT question with a DIFFERENT
// answer: "has this session's file_read channel produced ANY row at all". A yes proves the
// plumbing carries traffic (however that traffic got there); a no means the plumbing itself is
// the unproven part, and the rule must not treat unproven plumbing as proof of an unread document.
// THE L57 TRAP, APPLIED TO OURSELVES: an absence and a failure must never share an exit path.
// Channel silent -> allow, and the reason NAMES the channel, not the author (per the controller's
// required test: the message must read as a non-verdict about the plumbing, not a pass on the
// document). Channel live and the source absent from THIS actor's own reads -> that is a real,
// positively-evidenced absence -> block.
export const RULE_IDS = ['L16'];

import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openState, recentEvents, normalizeActorId } from '../lib/enforcement-state.mjs';
import { normPath, toolFilePath } from '../lib/target-path.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
// Same env seam fix-cycle-limit.mjs and gate-lessons.mjs already use for the same document.
function disciplineDocPath() {
  return process.env.DISCIPLINE || join(ROOT, 'docs', 'process', 'development-discipline.md');
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  if (!fp || basename(normPath(fp)) !== 'claude.md') {
    return { decision: 'allow', reason: 'not a derived artifact this rule maps to a source' };
  }
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return { decision: 'allow', reason: 'L16 degraded: no session_id on this call — allowing' };
  }

  const db = openState();
  if (!db) {
    return {
      decision: 'allow',
      reason: 'L16 degraded: enforcement state unreadable — a blocking rule that cannot read '
        + 'its own evidence must never block.',
    };
  }
  let all;
  try {
    all = recentEvents(db, sessionId, 'file_read', 0); // unfiltered: the channel-liveness probe
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (all.length === 0) {
    return {
      decision: 'allow',
      reason: 'L16 degraded: the evidence channel could not be established — this session shows '
        + 'no file_read row at all (any actor, any file), so "nothing was read" and "the Read '
        + 'observer is not wired" are indistinguishable here (an absence and a failure must never '
        + 'share an exit path, L57). Allowing; this is a non-verdict about the channel, not a pass '
        + 'on the document.',
    };
  }

  const actor = normalizeActorId(input.agent_id);
  const source = normPath(disciplineDocPath());
  const readIt = all.some((e) => {
    if (e.actorId !== actor) return false;
    try {
      const d = JSON.parse(e.detail);
      return normPath(d && d.filePath) === source;
    } catch { return false; }
  });
  if (readIt) {
    return { decision: 'allow', reason: 'L16: the source document was Read by this actor this session' };
  }
  return {
    decision: 'block',
    reason: 'L16 (a summary written from recollection is not the source — the shipped CLAUDE.md '
      + 'that omitted §3 and §4, the discipline\'s own core): you are editing CLAUDE.md, a DERIVED '
      + 'artifact, and this session shows no Read of its source, '
      + 'docs/process/development-discipline.md, by this actor. Blocked. The way through costs one '
      + 'tool call: Read the discipline document first, then make this edit working section by '
      + 'section from it — derived artifacts defer to their source, never to memory of it.',
  };
}
