#!/usr/bin/env node
// check-no-docker — Docker-exit Task 9. Distinguishes an INVOCATION (code that would actually shell
// out to `docker`) from a MENTION (prose/comment/message explaining the exit, quoting an old command,
// or telling a human what to type by hand). Only an invocation fails the gate.
//
// WHY THE DISTINCTION IS THE WHOLE JOB. A survey of this repo found 34 lines containing the word
// `docker`, and only a handful are real call sites — the rest are comments and explanations, many of
// which exist specifically to document *why* Docker was removed (R-108, L67, infra/compose.yaml's own
// header warning against re-adding Postgres to it). A gate that greps the raw string would light up on
// its own documentation, turn into noise within a day, and get bypassed — and the natural "fix" people
// reach for is to stop writing the explanations, which makes the codebase dumber to satisfy a checker.
// So: never grep the word `docker` alone. Every check below asks "would this line execute a docker
// command if this file ran", not "does this line contain the word docker".
//
// THE RULE (in three parts, applied in order):
//
// 1. SCOPE — only files that actually execute: extensions .mjs/.js/.py/.ps1/.sh. Markdown, YAML and
//    JSON are never scanned, on principle: a .md file is prose a human reads, a .yaml file is config a
//    compose engine or CI runner interprets, neither one is code Node/Python/PowerShell/bash executes
//    on its own. This is also the explicit, deliberate treatment of `infra/compose.yaml` today: it is
//    a YAML file, so it is out of scope regardless of content, even though by definition its whole
//    purpose is a Docker Compose invocation surface. It is deleted in Task 12, not by this gate; until
//    then this exception is real and is written down here so it cannot go unnoticed. `infra/README.md`
//    is the same story for the operator-facing "how to bring the stack up by hand" instructions.
//
// 2. SHAPE — a live invocation needs lowercase `docker` immediately followed by whitespace and a real
//    subcommand (compose|exec|ps|inspect|build|run|start|stop|kill|rm|pull|push|tag|images|logs|
//    restart|network|volume|login|version|info|attach|cp|top|create|rmi|save|load), or the standalone
//    `docker-compose`. Lowercase-only is deliberate: every real invocation in this codebase calls the
//    literal binary name, which is always lowercase; "Docker Compose" (capital D, product-name prose)
//    or "Docker daemon"/"Docker-shaped"/"docker: 28.1.1" (noun use, no adjacent subcommand) never match
//    this shape and never need a comment/sink exception to stay green — checked against the actual 34
//    lines this repo had at write time, only 4 lines outside the sink/comment cases below even reach
//    this filter.
//
// 3. CONTEXT — a line that matches #2 is still a MENTION, not an invocation, if either is true:
//      a. It is inside a comment: the trimmed line starts with `#` or `//`, the match falls after a
//         `#`/`//` earlier on the same line, or the line sits inside a block comment (`<# ... #>` in
//         PowerShell, `/* ... */` in JS, a triple-quoted `"""`/`'''` Python docstring — tracked across
//         lines, not just same-line).
//      b. It is the argument to a known MESSAGE SINK on the same line — a function whose job is to
//         print text for a human, not execute anything: Write-Host, Write-Warning, Write-Refuse,
//         Write-Step, Write-Refused, console.log, console.error, console.warn, pytest.skip, .skip(.
//         install-neo4j-native.ps1:125 is exactly this shape: `Write-Refuse "... 'docker stop
//         mk-neo4j' ..."` names a command for a human to type; it never runs it.
//    Anything left after both exclusions is a genuine invocation: this codebase's real ones today are
//    the four `wsl("docker ...", ...)` calls in tests/test_acceptance_infra.py (_require_docker,
//    _compose_container_names, A6, A7) — passed to `wsl()`, which actually shells the string out.
//
// WHAT THIS GATE CANNOT DETECT:
//   - A docker invocation built by string concatenation/interpolation split across multiple lines in a
//     way that never puts `docker <subcommand>` together on one physical line (e.g. `cmd = "doc" +
//     "ker exec ..."`, or the subcommand computed from a variable). This gate is a per-line text scan,
//     not a parser or an interpreter — it cannot evaluate what a program would construct at runtime.
//   - A comment-stripping heuristic that does not know about strings: a `#` or `//` that appears inside
//     a string literal (not starting an actual comment) would incorrectly truncate the scanned line and
//     could hide a real invocation after it. Not observed in this repo today, but it is a real gap in
//     the method, not just a corner case that happens to be empty right now.
//   - A message sink not on the curated list in 3b (e.g. a future `log.warn(...)` helper, or a raw
//     `throw new Error("... docker compose up -d ...")`) will be misclassified as an invocation — a
//     false RED, not a false GREEN. That is the deliberately safer failure direction: this gate would
//     rather nag about a message string than stay quiet about a real call, and the fix (add the sink
//     name to the list, or rewrite the message) is always a one-line, cheap, immediate edit at the
//     commit that trips it.
//   - A brand-new way of invoking docker that isn't `docker <subcommand>` text at all (e.g. a Windows
//     shortcut/scheduled task pointing straight at dockerd.exe, or a compose call issued from inside a
//     .yaml/.md file some future tool actually executes) — outside this gate's declared scope (#1) and
//     shape (#2) by design, not by oversight; broadening either would start re-flagging the prose this
//     gate exists to leave alone.
//   - The deprecated standalone `docker-compose` v1 binary's own subcommands (`docker-compose up`,
//     `docker-compose down`) are NOT in SUBCOMMANDS (only `compose` is, for the modern `docker compose`
//     plugin form) — `docker-compose up -d` would not match. VERIFIED absent from this repo today
//     (grepped for the literal string `docker-compose` across every scanned extension plus .md/.yaml:
//     zero real invocations, only this gate's own header and one unrelated vitest vendor doc). Not
//     widened to `up`/`down` because those are common English words that would raise the false-RED
//     rate against prose (`docker up and running`, `back down`) for a form the repo does not use.
//   - A split-argument call such as `spawnSync('docker', ['ps'])` or `subprocess.run(['docker', 'ps'])`
//     — the subcommand is a separate array element, not adjacent text, so `docker\s+ps` never matches
//     on that line. VERIFIED as a real miss (temporary test file, since deleted): the gate stayed GREEN
//     on `spawnSync('docker', ['ps']);` in the same run where it correctly caught a string-form
//     `"docker compose up -d"` on the next line. Every real invocation in this codebase today (the four
//     `wsl("docker ...")` calls, since migrated away in tests/test_acceptance_infra.py) uses the string
//     form, so this gap is currently theoretical, not live — but it is real, and the honest fix if it
//     ever matters is widening SHAPE (#2) to also match a bare `'docker'`/`"docker"` first argument to a
//     known exec sink, not pretending the current regex already covers it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
// A --root seam, added 2026-08-10 so this gate can be tested against a disposable tree. It had
// none, and therefore no tests at all — which is how it reached a false RED unnoticed.
const _argv = process.argv.slice(2);
const _ri = _argv.indexOf('--root');
const ROOT = _ri === -1 ? REPO : _argv[_ri + 1];

const EXEC_EXTS = new Set(['.mjs', '.js', '.py', '.ps1', '.sh']);
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.wrangler', '.playwright-mcp', '.superpowers',
  'scratch', 'test-results', 'playwright-report',
]);

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const abs = join(dir, name);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) walk(abs, out);
    else if (EXEC_EXTS.has(extname(name))) out.push(abs);
  }
}

const files = [];
walk(ROOT, files);

// Real docker subcommands — a fixed, named list, not a wildcard. `docker-compose` (the old standalone
// binary name) is matched separately since it has no space before its own "subcommand".
const SUBCOMMANDS = [
  'compose', 'exec', 'ps', 'inspect', 'build', 'run', 'start', 'stop', 'kill', 'rm', 'pull', 'push',
  'tag', 'images', 'logs', 'restart', 'network', 'volume', 'login', 'version', 'info', 'attach', 'cp',
  'top', 'create', 'rmi', 'save', 'load',
];
const SHAPE_RE = new RegExp(String.raw`\bdocker(?:-compose)?\s+(?:${SUBCOMMANDS.join('|')})\b`);

const MESSAGE_SINKS = [
  'Write-Host', 'Write-Warning', 'Write-Refuse', 'Write-Refused', 'Write-Step',
  'console.log', 'console.error', 'console.warn', 'pytest.skip', '.skip(',
];

function sinkPrecedesMatch(line, matchIndex) {
  const before = line.slice(0, matchIndex);
  return MESSAGE_SINKS.some((sink) => before.includes(sink));
}

// --- test-fixture exclusion (added 2026-08-10) -------------------------------------------------
//
// A rule's test feeds it command STRINGS. `L51a`'s fixtures necessarily contain
// `wsl -e bash -lc 'service docker start'`, because that is the shape the rule exists to catch —
// and this gate read them as live docker calls and blocked the commit. The implementer used the
// documented META_SKIP_GATE escape rather than edit an unrelated gate, which was right; this is the
// repair behind it.
//
// It is the fourth time in one day a gate here fired on text that DESCRIBES a pattern instead of
// code that RUNS it (L57's prose, main-only's heredoc, L32's blind spot, now this). The gate's own
// header already admitted the blindness in the other direction — "a comment marker hidden inside a
// string literal" — without drawing the symmetric conclusion.
//
// NARROW, and the narrowing is stated in the header's does-NOT-detect list: a test file, AND the
// match sitting inside a quoted string. A test that genuinely SHELLED OUT to docker would now pass
// unseen — acceptable only because Docker is retired repo-wide (R-88) and a new live call would
// have to be written inside a quoted string in a test file to escape.
// Forward slashes only, and that is correct rather than lucky: `rel` is normalised with
// `.replace(/\\/g, '/')` before it reaches here, so a Windows separator never arrives.
const TEST_PATH_RE = /(^|\/)(tests?)\//;

function insideStringLiteral(line, matchIndex) {
  let single = 0;
  let dbl = 0;
  for (let i = 0; i < matchIndex; i += 1) {
    const c = line[i];
    if (c === String.fromCharCode(92)) { i += 1; continue; }   // backslash escape; written this
    // way rather than as a literal because writing a backslash through a shell heredoc is L68, and
    // it ate this exact character on the first attempt at this very line.
    if (c === "'") single += 1;
    else if (c === '"') dbl += 1;
  }
  return single % 2 === 1 || dbl % 2 === 1;
}

function commentPrefixIndex(line, ext) {
  if (ext === '.mjs' || ext === '.js') {
    const i = line.indexOf('//');
    return i;
  }
  // .py, .ps1, .sh all use # for a line comment (naive: does not know about strings — see header §3a/limitations).
  const i = line.indexOf('#');
  return i;
}

let filesScanned = 0;
const invocations = [];

for (const abs of files) {
  filesScanned++;
  const ext = extname(abs);
  const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/);

  // Block-comment state, tracked across lines.
  let inPsBlockComment = false;   // PowerShell <# ... #>
  let inJsBlockComment = false;   // JS/mjs /* ... */
  let pyTripleQuote = null;       // '"""' or "'''" currently open, or null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let line = raw;

    // --- update / apply block-comment state for this line, per language ---
    if (ext === '.ps1') {
      if (inPsBlockComment) {
        const endIdx = line.indexOf('#>');
        if (endIdx === -1) continue; // whole line is inside the block comment
        inPsBlockComment = false;
        line = line.slice(endIdx + 2);
      }
      const startIdx = line.indexOf('<#');
      if (startIdx !== -1) {
        const endIdx = line.indexOf('#>', startIdx + 2);
        if (endIdx === -1) {
          line = line.slice(0, startIdx); // rest of this line + following lines are comment
          inPsBlockComment = true;
        } else {
          line = line.slice(0, startIdx) + line.slice(endIdx + 2);
        }
      }
    } else if (ext === '.mjs' || ext === '.js') {
      if (inJsBlockComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx === -1) continue;
        inJsBlockComment = false;
        line = line.slice(endIdx + 2);
      }
      const startIdx = line.indexOf('/*');
      if (startIdx !== -1) {
        const endIdx = line.indexOf('*/', startIdx + 2);
        if (endIdx === -1) {
          line = line.slice(0, startIdx);
          inJsBlockComment = true;
        } else {
          line = line.slice(0, startIdx) + line.slice(endIdx + 2);
        }
      }
    } else if (ext === '.py') {
      // Docstring tracking: naive toggle on a bare triple-quote marker. Does not distinguish a
      // docstring from a real triple-quoted string value — documented limitation (header §limitations
      // covers the sibling case; this is the same shape of naivety, kept for the same reason: it is
      // conservative in the safe direction, since a false "in docstring" skip only risks a missed
      // MENTION becoming invisible, never a real invocation being hidden, because no real invocation
      // in this codebase is ever authored inside a triple-quoted string).
      if (pyTripleQuote) {
        const endIdx = line.indexOf(pyTripleQuote);
        if (endIdx === -1) continue;
        line = line.slice(endIdx + 3);
        pyTripleQuote = null;
      }
      for (const marker of ['"""', "'''"]) {
        let searchFrom = 0;
        while (true) {
          const idx = line.indexOf(marker, searchFrom);
          if (idx === -1) break;
          const closeIdx = line.indexOf(marker, idx + 3);
          if (closeIdx === -1) {
            line = line.slice(0, idx);
            pyTripleQuote = marker;
            break;
          }
          line = line.slice(0, idx) + line.slice(closeIdx + 3);
          searchFrom = idx;
        }
      }
    }

    // --- single-line comment stripping ---
    const trimmed = line.trimStart();
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    const commentIdx = commentPrefixIndex(line, ext);
    if (commentIdx !== -1) line = line.slice(0, commentIdx);

    // --- shape check ---
    const m = SHAPE_RE.exec(line);
    if (!m) continue;

    // --- message-sink exclusion ---
    if (sinkPrecedesMatch(line, m.index)) continue;

    // --- test-fixture exclusion ---
    if (TEST_PATH_RE.test(rel) && insideStringLiteral(line, m.index)) continue;

    invocations.push({ file: rel, line: i + 1, text: raw.trim() });
  }
}

console.log(`files scanned: ${filesScanned} (**/*.{mjs,js,py,ps1,sh}, excluding ${[...EXCLUDE_DIRS].join(', ')})`);
console.log('  detects: a live (non-comment, non-message-sink) `docker <subcommand>` call in executable code');
console.log('  does NOT detect: .md/.yaml/.json content (out of scope by design — infra/compose.yaml is');
console.log('  a deliberate exception until Task 12 deletes it); a docker command assembled across');
console.log('  multiple lines/string concatenation; a comment marker hidden inside a string literal; a')
console.log('  docker call written INSIDE a quoted string in a tests/ file (treated as a rule fixture); a');
console.log('  message sink not on the curated list (fails safe — that is a false RED, never a false GREEN)');

if (invocations.length) {
  console.log(`\nFAIL: ${invocations.length} live docker invocation(s):`);
  for (const v of invocations) {
    console.log(`  x ${v.file}:${v.line}`);
    console.log(`      ${v.text}`);
  }
  console.log('\n  PostgreSQL and Neo4j are native Windows services now; Docker is retired. If this is a');
  console.log('  genuine new call, replace it with the native equivalent (Start-Service / a direct');
  console.log('  connect through src.knowledge.config, matching the pattern already used elsewhere in this');
  console.log('  repo). If it documents or explains the exit rather than executing anything, it is a');
  console.log('  MENTION and belongs in a comment, not live code — see this gate’s own header for the rule.');
  process.exit(1);
}
console.log('OK - no live docker invocations found.');
