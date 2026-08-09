// scripts/hooks/lib/target-path.mjs — shared payload extraction for Edit|Write rules (Arc 2
// Phase 2). One place, because Phase 1's review found gates firing on a token ANYWHERE; the
// discipline here is that every rule asks (a) WHICH file (normPath) and (b) WHAT TEXT IS BEING
// ADDED (newContent — Write's full `content`, or Edit's `new_string`; never the old text, never
// the rest of the file unless a rule explicitly reads the disk and says why).
export function normPath(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/').toLowerCase() : '';
}

export function toolFilePath(input) {
  const p = input && input.tool_input && input.tool_input.file_path;
  return typeof p === 'string' && p ? p : null;
}

// The text this call ADDS: Write carries `content` (the whole new file), Edit carries
// `new_string` (only the replacement text). null when neither is a string — callers treat
// null as undecidable and fail open.
export function newContent(input) {
  const ti = input && input.tool_input;
  if (!ti) return null;
  if (typeof ti.content === 'string') return ti.content;
  if (typeof ti.new_string === 'string') return ti.new_string;
  return null;
}

export function oldContent(input) {
  const ti = input && input.tool_input;
  return ti && typeof ti.old_string === 'string' ? ti.old_string : null;
}
