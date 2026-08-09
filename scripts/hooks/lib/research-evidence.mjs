// scripts/hooks/lib/research-evidence.mjs — §10.14's evidence source: "did documented research
// happen in THIS actor's transcript since instant T". Cloned in structure from skill-invoked.mjs
// (same tail read, same fail-to-determined:false contract, same sidechain resolution for
// dispatched subagents) — differs only in WHAT counts as evidence:
//   - a Bash tool_use whose command matches geniza-consult.mjs's own RETRIEVAL_PATTERN
//     (imported, never re-implemented — one classifier, one place), or
//   - a WebSearch / WebFetch tool_use (the §10.11 order: geniza first, then the web — either is
//     research; ranking their order is the geniza-fallback rule's job, not this one's).
// FAIL DIRECTION: any inability to read/parse resolves to determined:false; the caller must not
// warn on that. Only a positively-read transcript with no research inside the window resolves to
// determined:true, researched:false.
//
// BRIEF VERIFICATION (task-3, per the owner's standing instruction to check every helper's real
// signature before calling it, after two earlier tasks in this same phase found a wrong-signature
// brief): both helpers this file imports were read from their own source before this file was
// written. `resolveActorTranscriptPath(transcriptPath, agentId)` in skill-invoked.mjs matches the
// brief's call shape exactly — a pure path computation, no I/O, returning transcriptPath unchanged
// when agentId is absent/empty. `RETRIEVAL_PATTERN` in geniza-consult.mjs was a module-local const
// before this task (not yet exported) — the export-only change this task makes to it is the one
// the brief itself calls for in its Step 3, not a brief error. No mismatch found; the brief's
// pseudocode for this file is used verbatim below.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { RETRIEVAL_PATTERN } from './geniza-consult.mjs';
import { resolveActorTranscriptPath } from './skill-invoked.mjs';

const MAX_TAIL_BYTES = 512 * 1024;

function readTail(path, maxBytes) {
  const size = statSync(path).size;
  if (size <= maxBytes) return readFileSync(path, 'utf8');
  const full = readFileSync(path, 'utf8');
  return full.length > maxBytes ? full.slice(full.length - maxBytes) : full;
}

export function researchEvidenceSince(transcriptPath, agentId, sinceTs, nowMs = Date.now()) {
  const effectivePath = resolveActorTranscriptPath(transcriptPath, agentId);
  if (typeof effectivePath !== 'string' || effectivePath === '' || !existsSync(effectivePath)) {
    return { determined: false, researched: false };
  }
  let text;
  try {
    text = readTail(effectivePath, MAX_TAIL_BYTES);
  } catch {
    return { determined: false, researched: false };
  }
  const since = Number.isFinite(sinceTs) ? sinceTs : 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let entry;
    try { entry = JSON.parse(trimmed); } catch { continue; }
    const ts = Date.parse(entry && entry.timestamp);
    if (!Number.isFinite(ts) || ts < since || ts > nowMs) continue;
    const content = entry && entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue;
      if (block.name === 'WebSearch' || block.name === 'WebFetch') {
        return { determined: true, researched: true };
      }
      if (block.name === 'Bash') {
        const command = block.input && block.input.command;
        if (typeof command === 'string' && RETRIEVAL_PATTERN.test(command)) {
          return { determined: true, researched: true };
        }
      }
    }
  }
  return { determined: true, researched: false };
}
