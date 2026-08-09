// scripts/hooks/lib/geniza-consult.mjs — §10.13's "was the geniza asked first" signal.
//
// THE ONLY EVIDENCE A PreToolUse HOOK ACTUALLY HAS (measured, not assumed): the hook's own stdin
// carries `transcript_path` (see pipeline.mjs's documented contract) — the CURRENT session's own
// JSONL transcript, written by Claude Code itself. A real transcript file was read directly
// (~/.claude/projects/<project>/<session>.jsonl) to confirm the shape this module depends on:
// each line is one JSON object; an assistant turn looks like
//   { type: 'assistant', timestamp: '<ISO8601>', message: { content: [ ... ] } }
// and a tool call appears inside that content array as
//   { type: 'tool_use', name: 'Bash', input: { command: '...' } }
// There is no separate index anywhere of "was retrieval.* called", and no timestamp field on the
// PreToolUse input itself — Date.now() at hook-run-time plus each transcript entry's OWN
// timestamp is the only honest clock available to answer "recently".
//
// THE WINDOW, AND WHY: 20 minutes (PRETOOLUSE_GENIZA_WINDOW_MS overrides it). Stated reason: this
// is meant to catch "the geniza was consulted for THIS piece of research a few tool calls ago",
// not "was ever consulted this session" (too permissive — would silently excuse an unrelated
// search an hour later) and not "the immediately preceding tool call" (too narrow — a real
// research burst reads the geniza's answer, thinks, then runs two or three greps/web-searches to
// follow what it found). 20 minutes is not measured against real session telemetry — no better
// anchor exists in this repo (no "topic changed" signal at all) — so this is a stated,
// deliberately generous default, not a precise one.
//
// FAIL DIRECTION (matches every other rule in this pipeline): any inability to read or parse the
// transcript — missing path, missing file, unreadable, no parseable lines in the window — resolves
// to "cannot determine", and the calling rule treats that as "do not warn". An infrastructure gap
// (no transcript_path supplied, e.g. by a non-Claude-Code caller in a test) must never look like
// grounds for accusing someone of skipping the geniza; only a positively-read transcript showing
// no consult is grounds for the warning.
import { readFileSync, statSync, existsSync } from 'node:fs';

const DEFAULT_WINDOW_MS = 20 * 60 * 1000;
// Bounds the read cost of a file that can otherwise grow to many MB over a long session — this
// rule runs before every matching Grep/WebSearch call, so its own cost must stay small. A tail
// read only ever loses the ability to see FURTHER BACK than the window cares about anyway.
const MAX_TAIL_BYTES = 512 * 1024;

// Exported (Task 3, §10.14) so research-evidence.mjs classifies a Bash command as a geniza
// retrieval call using this SAME regex — one classifier, one place, never a second copy that
// could drift out of agreement with this one.
export const RETRIEVAL_PATTERN = /from\s+src\.knowledge\s+import\s+retrieval|retrieval\.(search_current_docs|semantic_search|get_source_excerpt|get_revision_history|find_impact|find_dependency_path|get_entity_provenance)\s*\(/;

function windowMs() {
  const raw = Number(process.env.PRETOOLUSE_GENIZA_WINDOW_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WINDOW_MS;
}

// A byte-accurate tail is unnecessary here: we only need SOME recent, mostly-intact lines, and a
// partially-cut first line (dropped by JSON.parse failing on it, harmlessly) costs nothing.
function readTail(path, maxBytes) {
  const size = statSync(path).size;
  if (size <= maxBytes) return readFileSync(path, 'utf8');
  const full = readFileSync(path, 'utf8');
  return full.length > maxBytes ? full.slice(full.length - maxBytes) : full;
}

// Returns { determined, consulted }.
//   determined=false -> no usable evidence either way (see FAIL DIRECTION above); caller must
//                        NOT warn.
//   determined=true, consulted=true  -> a geniza retrieval call was found inside the window.
//   determined=true, consulted=false -> the transcript WAS readable and no such call was found
//                        inside the window — the only case that should ever warn.
export function genizaConsultedRecently(transcriptPath, nowMs = Date.now()) {
  if (typeof transcriptPath !== 'string' || transcriptPath === '' || !existsSync(transcriptPath)) {
    return { determined: false, consulted: false };
  }
  let text;
  try {
    text = readTail(transcriptPath, MAX_TAIL_BYTES);
  } catch {
    return { determined: false, consulted: false };
  }

  const win = windowMs();
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
    if (!Number.isFinite(ts) || (nowMs - ts) > win || ts > nowMs) continue;
    const content = entry && entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use' || block.name !== 'Bash') continue;
      const command = block.input && block.input.command;
      if (typeof command === 'string' && RETRIEVAL_PATTERN.test(command)) {
        return { determined: true, consulted: true };
      }
    }
  }
  return { determined: true, consulted: false };
}
