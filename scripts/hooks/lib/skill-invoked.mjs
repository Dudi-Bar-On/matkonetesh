// scripts/hooks/lib/skill-invoked.mjs — §6.4 trigger 1's evidence source: "was a given skill
// invoked recently in THIS session's transcript". Cloned in structure from geniza-consult.mjs
// (same file read strategy, same fail-to-determined:false contract) — see that file's header for
// the full rationale on WHY a tail read, WHY a window, and WHY every failure resolves to
// determined:false rather than an accusation. This module differs only in WHAT it looks for.
//
// STEP 0 MEASUREMENT (this task's own requirement): a real transcript
// (~/.claude/projects/<proj>/<session>.jsonl) was read directly to confirm the shape a Skill
// invocation actually takes on disk, before writing the matcher below. Four real entries, same
// session, same shape every time:
//   { type: 'assistant', timestamp: '<ISO8601>',
//     message: { content: [ { type: 'tool_use', name: 'Skill',
//                              input: { skill: 'superpowers:brainstorming' }, ... } ] } }
// i.e. IDENTICAL in structure to the Bash tool_use shape geniza-consult.mjs already depends on —
// only `name` ('Skill' instead of 'Bash') and where the payload lives (`input.skill`, a plain
// string, instead of `input.command`) differ. `input.skill` carries the FULL namespaced id
// (`superpowers:brainstorming`, `superpowers:writing-plans`) exactly as passed to the Skill tool —
// so the caller's regex must match against that namespaced string, not a bare skill name.
//
// The SAME scan also checked for skills surfacing as `<command-name>` text blocks (the brief's
// alternative-shape hypothesis). That shape exists in this project's real transcripts, but ONLY for
// slash commands typed directly by a human at the prompt (e.g. `<command-name>/clear</command-name>`
// for the built-in `/clear`) — never for a Skill-tool invocation, and never seen carrying a
// `superpowers:*` skill id in any transcript inspected. Because a user COULD in principle type a
// skill's slash form directly (`/brainstorming`) rather than have the model invoke the Skill tool,
// this module also matches `<command-name>` text against the same regex as a second, independent
// path — cheap (same content array, same loop) and it can only ever ADD a true positive, never
// remove one, since a hit here still requires the SAME regex to match.
//
// FAIL DIRECTION (identical contract to geniza-consult.mjs): any inability to read/parse the
// transcript — missing path, missing file, unreadable, no parseable lines in the window — resolves
// to determined:false. Only a positively-read transcript with no matching invocation inside the
// window resolves to determined:true, invoked:false. A caller must never block on determined:false.
//
// SUBAGENT FIX ROUND (2026-08-08, coordinator ruling on Task 8 review, section 10.24: a block
// whose escape cannot be reached is not enforcement, it is stopping work): a DISPATCHED SUBAGENT
// own turns, including its own Skill tool_use calls, are written by Claude Code to a SEPARATE
// sidechain transcript file, never merged into the top-level session own transcript_path. This
// was found live: a dispatched subagent invoked superpowers:systematic-debugging to clear
// debugging-before-fix-edit.mjs own block on itself, and the block did not clear, because
// skillInvokedSince() was reading the WRONG file, since the invocation was real and present on
// disk, just not in the file this function was told to look at.
//
// MEASURED, NOT INFERRED (this task own instrumented capture of a real PreToolUse payload, fired
// from inside a real dispatched subagent): the hook payload carries agent_id (and agent_type) as
// top-level fields alongside transcript_path, for example:
//   transcript_path: .../projects/PROJ/SESSIONID.jsonl        (the TOP-LEVEL session file)
//   agent_id:        a2bf7adaa2ed4c7a1
// and the subagent own turns were confirmed, by direct file inspection, to live at
//   .../projects/PROJ/SESSIONID/subagents/agent-AGENTID.jsonl
// that is a SIBLING directory named after the session id, containing one file per dispatched
// agent, its filename fully determined by transcript_path plus agent_id alone. Both fields the
// payload already hands every rule. This is case 2 of the ruling (if discoverable, read the
// actor own transcript), not case 3 (undetectable escape) - the path is 100 percent predictable
// from data the hook already provides, no guessing, no scan of a directory of candidates.
//
// resolveActorTranscriptPath() below is a PURE path computation, no I/O: it returns the sidechain
// path when agentId is a non-empty string, and returns transcriptPath unchanged otherwise (no
// agentId at all - the ordinary top-level-session case, where transcript_path already IS the
// actor own transcript, per the original module header above). Whether that computed path
// actually exists on disk is left ENTIRELY to skillInvokedSince own pre-existing existsSync()
// check below - deliberately: if the predicted sidechain file happens not to exist (a race at
// the very first tool call, a future Claude Code layout change), that already resolves to
// determined:false exactly like any other missing transcript, and every caller of this module
// already treats determined:false as cannot prove either way, degrade to allow, name the
// degradation - which is precisely the fail-open behaviour the ruling case 3 asks for, achieved
// here for free by NOT special-casing it, rather than by adding a second failure path that could
// drift out of sync with the first. There is deliberately no fallback from the sidechain path
// back to the top-level transcript on a miss: a fallback would silently read a DIFFERENT actor
// (the orchestrator, or an unrelated subagent) skill invocations as if they were this actor own,
// exactly the wrong-evidence failure mode the ruling phrase the actor OWN transcript exists to
// rule out, worse than simply degrading to allow.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';

// Computes the transcript path a skill-invocation check should actually read for THIS actor. See
// header comment above for the measured basis. agentId absent/null/undefined/empty-string means
// transcriptPath returned unchanged (the top-level-session case - no redirect needed, nothing to
// compute). A non-string/empty transcriptPath is returned as-is too; the caller own existsSync()
// guard is what turns that into determined:false, not this function.
export function resolveActorTranscriptPath(transcriptPath, agentId) {
  if (typeof transcriptPath !== 'string' || transcriptPath === '') return transcriptPath;
  if (typeof agentId !== 'string' || agentId === '') return transcriptPath;
  const dir = dirname(transcriptPath);
  const base = basename(transcriptPath).replace(/\.jsonl$/i, '');
  return join(dir, base, 'subagents', `agent-${agentId}.jsonl`);
}

// Same generous default as geniza-consult.mjs and the same reasoning: a brainstorming/writing-plans
// invocation that happened a few tool calls ago (not just the immediately preceding call) should
// still count as "before this creative write", but an invocation from an hour ago on an unrelated
// thread should not silently excuse an unrelated write. Callers pass their own `sinceMs`; this
// constant is exported only as the shared default a caller may choose to pass.
export const DEFAULT_SKILL_WINDOW_MS = 20 * 60 * 1000;
const MAX_TAIL_BYTES = 512 * 1024;

// A byte-accurate tail is unnecessary here for the same reason geniza-consult.mjs gives: we only
// need SOME recent, mostly-intact lines, and a partially-cut first line (dropped harmlessly by
// JSON.parse failing on it) costs nothing.
function readTail(path, maxBytes) {
  const size = statSync(path).size;
  if (size <= maxBytes) return readFileSync(path, 'utf8');
  const full = readFileSync(path, 'utf8');
  return full.length > maxBytes ? full.slice(full.length - maxBytes) : full;
}

// Returns { determined, invoked }.
//   determined=false -> no usable evidence either way; caller must NOT block on this alone.
//   determined=true, invoked=true  -> a Skill tool_use (or `<command-name>` text) matching
//                        `skillNameRe` was found inside the [nowMs - sinceMs, nowMs] window.
//   determined=true, invoked=false -> the transcript WAS readable and no such invocation was found
//                        inside the window.
export function skillInvokedSince(transcriptPath, skillNameRe, sinceMs, nowMs = Date.now(), agentId = null) {
  const effectivePath = resolveActorTranscriptPath(transcriptPath, agentId);
  if (typeof effectivePath !== 'string' || effectivePath === '' || !existsSync(effectivePath)) {
    return { determined: false, invoked: false };
  }
  if (!(skillNameRe instanceof RegExp)) {
    return { determined: false, invoked: false };
  }
  let text;
  try {
    text = readTail(effectivePath, MAX_TAIL_BYTES);
  } catch {
    return { determined: false, invoked: false };
  }

  const effectiveWindow = Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : DEFAULT_SKILL_WINDOW_MS;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue; // e.g. the tail slice cut a line in half — not evidence of anything.
    }
    const ts = Date.parse(entry && entry.timestamp);
    if (!Number.isFinite(ts) || (nowMs - ts) > effectiveWindow || ts > nowMs) continue;
    const content = entry && entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block) continue;
      if (block.type === 'tool_use' && block.name === 'Skill') {
        const skillId = block.input && block.input.skill;
        if (typeof skillId === 'string' && skillNameRe.test(skillId)) {
          return { determined: true, invoked: true };
        }
      }
      // Secondary path (see header): a directly-typed slash form, should one ever carry a skill id.
      if (block.type === 'text' && typeof block.text === 'string') {
        const m = block.text.match(/<command-name>([^<]*)<\/command-name>/);
        if (m && skillNameRe.test(m[1])) {
          return { determined: true, invoked: true };
        }
      }
    }
  }
  return { determined: true, invoked: false };
}
