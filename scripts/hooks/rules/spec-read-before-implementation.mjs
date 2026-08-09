// scripts/hooks/rules/spec-read-before-implementation.mjs — L56: "I built a phase from my summary
// of the spec instead of from the spec." Phase 3 of the knowledge stack shipped missing eight
// written-down requirements — none disputed, none hard — because the summary was in front of the
// implementer and the spec was not. L56's own check: "before implementing from any spec, open the
// spec. Not the plan, not the summary."
//
// PAYLOAD POSITION: an Edit/Write whose target is an IMPLEMENTATION file — basename app.js, or a
// path under tests/ — while an arc is ACTIVE (session-state.mjs's activeArc(), the same single
// definition brainstorm-before-creative.mjs already imports) with a governing spec on disk
// (governingSpecFile(), ditto). "Active" is `arc.ledger` truthy, not `arc` truthy —
// activeArc() ALWAYS returns an object (even "no arc found" is a populated `{line, ledger: null,
// ...}` object, by design: session-state.mjs's own header treats a quiet undetermined answer as
// worse than a loud one) — brainstorm-before-creative.mjs's own Branch B makes the same
// `!arc.ledger` check for the same reason; a bare `!arc` here would never be true and the "no
// active arc" fail-open path would be dead code.
//
// SPEC PATH: governingSpecFile() returns `{file, mtimeMs}` where `file` is a BASENAME (see its
// own header: exported "so a caller that needs the bare filename... reuses this one scan" —
// brainstorm-before-creative.mjs's only consumer to date needs exactly the basename, for a
// register lookup). This rule needs the FULL path instead, to compare against file_read rows
// (which record the exact string the Read tool call used). session-state.mjs does not export its
// SPECS_DIR, so this rule reconstructs the same computation from the same env seam
// (`process.env.SPECS_DIR`, defaulted the same way) rather than inventing a second directory.
//
// SEVERITY: WARN, and the argument is precision, not harm. The harm L56 names is to substance
// (narrowing-by-forgetting), but the DETECTOR here is heuristic twice over: governingSpecFile()
// is "the newest spec file" (session-state.mjs's own stated approximation), and not every
// app.js/tests edit is spec-governed work (a hotfix, a flake investigation). A block on a
// heuristic match would manufacture false stops — the L70 failure mode, and the one outcome
// (§6 of the phase spec) that turns the whole pipeline into something people route around. The
// warn is also THROTTLED to once per actor per session per spec (a 'spec_read_nudge' event this
// rule writes for itself): the second and later edits pass silently, because a nudge repeated on
// every edit is noise, and noise trains people to stop reading reasons.
//
// CHANNEL-LIVENESS PROBE — identical shape and identical reasoning to derived-artifact-source.mjs
// (read that file's header for the full argument): an UNFILTERED `recentEvents(...,'file_read',0)`
// with zero rows for the whole session means the channel itself is unproven, not that the spec was
// unread — and unproven plumbing must never manufacture a nudge, let alone a future block. Channel
// silent -> allow, reason names the channel.
//
// FAIL-OPEN: no active arc / no spec file / unreadable state / silent file_read channel all
// resolve to allow.
export const RULE_IDS = ['L56'];

import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openState, recentEvents, recordEvent, normalizeActorId,
} from '../lib/enforcement-state.mjs';
import { normPath, toolFilePath } from '../lib/target-path.mjs';
import { activeArc, governingSpecFile } from '../../session-state.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
// Same env seam session-state.mjs's own SPECS_DIR reads at module load — reconstructed here
// because that constant is not exported (see header).
function specsDir() {
  return process.env.SPECS_DIR || join(ROOT, 'docs', 'superpowers', 'specs');
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  const isImplementation = np && (basename(np) === 'app.js' || np.includes('/tests/'));
  if (!isImplementation) {
    return { decision: 'allow', reason: 'not an implementation file (app.js or tests/**)' };
  }
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return { decision: 'allow', reason: 'L56 degraded: no session_id — allowing' };
  }

  let arc = null;
  let spec = null;
  try {
    arc = activeArc();
    spec = governingSpecFile();
  } catch {
    return { decision: 'allow', reason: 'L56 degraded: could not determine the active arc — allowing' };
  }
  if (!arc || !arc.ledger || !spec) {
    return { decision: 'allow', reason: 'L56: no active arc / no governing spec on disk — not spec-governed work' };
  }
  const specPath = join(specsDir(), spec.file);

  const db = openState();
  if (!db) {
    return { decision: 'allow', reason: 'L56 degraded: enforcement state unreadable — allowing' };
  }
  try {
    const all = recentEvents(db, sessionId, 'file_read', 0); // unfiltered: channel-liveness probe
    if (all.length === 0) {
      return {
        decision: 'allow',
        reason: 'L56 degraded: the evidence channel could not be established — this session '
          + 'shows no file_read row at all (any actor, any file), so "unread" and "unwired" are '
          + 'indistinguishable here (L57). Allowing; this is a non-verdict about the channel, not '
          + 'a pass on the spec.',
      };
    }
    const actor = normalizeActorId(input.agent_id);
    const specNorm = normPath(specPath);
    const readIt = all.some((e) => {
      if (e.actorId !== actor) return false;
      try {
        const d = JSON.parse(e.detail);
        return normPath(d && d.filePath) === specNorm;
      } catch { return false; }
    });
    if (readIt) {
      return { decision: 'allow', reason: 'L56: the governing spec was Read by this actor this session' };
    }
    // Throttle: one nudge per actor per session per spec — subsequent edits pass silently.
    const nudges = recentEvents(db, sessionId, 'spec_read_nudge', 0, actor);
    const alreadyNudged = nudges.some((e) => {
      try { return normPath(JSON.parse(e.detail)?.filePath) === specNorm; } catch { return false; }
    });
    if (alreadyNudged) {
      return { decision: 'allow', reason: 'L56: nudge already issued this session for this spec' };
    }
    recordEvent(db, { sessionId, kind: 'spec_read_nudge', detail: { filePath: specPath }, actorId: actor });
    return {
      decision: 'warn',
      reason: 'L56 (narrowing by FORGETTING is still narrowing — §4): an arc is active and its '
        + `governing spec, ${spec.file}, has not been Read by this actor this session. Before `
        + 'implementing from any spec, open the spec — not the plan, not the summary, not the '
        + 'commit message that mentioned it. (This nudge fires once per session.)',
    };
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
