#!/usr/bin/env node
// scripts/build-audit.mjs — a derived, never-hand-edited audit trail of this working arc.
//
// WHY THIS EXISTS. The owner asked for one audit file, at a name and location they know, holding
// the full history of the current arc — everything written to the screen, by them or by the
// assistant, so the whole session can be reconstructed backwards. The obvious implementation
// ("the assistant appends to a file after every message") was rejected on sight: it depends on
// someone remembering to do it, which is the exact failure class this arc exists to remove (see
// CLAUDE.md's own account of `check-workflows`/`check-commands-exist` — both born from a rule that
// stayed correct while the thing enforcing it silently stopped). The conversation is ALREADY
// recorded, completely and automatically, by the CLI itself, in its own JSONL transcript. So this
// file does not maintain state; it PROJECTS a transcript that already exists into something a human
// can read top to bottom. Nobody has to remember to run it — it is wired into `check-meta.mjs`
// (session start, every commit, every CI run), so it self-refreshes on the cadence the project
// already enforces everything else on.
//
// WHERE THE SOURCE LIVES. The Claude Code CLI writes one `<sessionId>.jsonl` file per session under
// `~/.claude/projects/<slugified-cwd>/`, appended to live for as long as that session runs. Several
// sessions' files sit side by side in that directory (past sessions, sessions for other work) —
// a filename alone does not tell you which one is the LIVE thread for the current arc, and picking
// the wrong one silently reconstructs the wrong session. This script resolves that the same way a
// human would: read every `.jsonl` file's LAST entry with a timestamp, and take the file whose last
// entry is most recent. A stale file (a session that ended) loses to whichever one is still growing.
//
// captures: every real user-typed message and every assistant TEXT block, in chronological order,
//   local time (GMT+3), grouped under day headings. A slash-command invocation (`/enforce`) is
//   recorded as the command line, not its full expanded prompt body. An async subagent's completion
//   notification is recorded as one reduced line (agent name + status + its own summary paragraph,
//   which the agent already wrote FOR a human to read) — not the raw `<task-notification>` envelope.
// does NOT capture: raw tool_use inputs or tool_result outputs verbatim — those would be megabytes
//   of diffs, file contents, and command stdout, and would bury the very record this file exists to
//   preserve. Each tool call is reduced to ONE line: the tool name plus whatever short descriptor its
//   own input actually carries (a file path, a command, an agent description, a query — never the
//   full input object). Extended-thinking blocks, skill-body injections, and CLI control-plane
//   entries (`mode`, `permission-mode`, `bridge-session`, `attachment`, `file-history-*`, `ai-title`,
//   `queue-operation`, `system` hook/turn-duration bookkeeping, `<local-command-*>` MCP-reconnect
//   noise) are all omitted — none of those were "written to the screen" as arc history, and the
//   totals below say exactly how many of each were skipped so this is a stated reduction, not a
//   silent one.
//
// IDEMPOTENT. Every run rebuilds the output file from scratch from the transcript; it is a
// projection, never a log appended to by hand. The file's own header repeats this so a future reader
// does not hand-edit it and lose the edit on the next run.
//
// FAILS LOUDLY, NEVER PARTIALLY. If the transcript directory or the live file cannot be found or
// read, this prints a clear FAIL block naming the exact path it looked for and writes NOTHING —
// no half-built file that could be mistaken for a complete one. It still exits 0 (see the header
// comment in check-meta.mjs's wiring below): this is a recorder, not a gate, and a recorder that can
// block a commit gets removed within a day.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'docs', 'audit', '2026-08-06-enforcement-arc-audit.md');

// The CLI slugifies the working directory into the projects-folder name by turning every `:` and
// `\` into `-` (verified against the live folder for this repo: "C:\Users\...\matconetesh" becomes
// "C--Users-...-matconetesh" — the double dash is `:` and the first `\` both landing on the same
// spot). AUDIT_PROJECTS_DIR overrides this entirely, for tests and for the degrade-honestly proof.
const PROJECTS_DIR =
  process.env.AUDIT_PROJECTS_DIR || join(homedir(), '.claude', 'projects', ROOT.replace(/[\\:]/g, '-'));

const OWNER_TZ_OFFSET_MIN = 3 * 60; // GMT+3, fixed (not DST-aware; matches the owner's own convention)

function fail(msg) {
  console.log('='.repeat(70));
  console.log('FAIL — build-audit could not produce an audit file');
  console.log('='.repeat(70));
  console.log(msg);
  console.log('\nNo file was written (a partial file that looks complete would be worse than none).');
  console.log('This still exits 0 — build-audit is a recorder, wired into check-meta, and a recorder');
  console.log('that can block a commit would be removed within a day. See this script\'s own header.');
}

function localStamp(isoTs) {
  const d = new Date(new Date(isoTs).getTime() + OWNER_TZ_OFFSET_MIN * 60 * 1000);
  const p2 = (n) => String(n).padStart(2, '0');
  return {
    day: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
    time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`,
  };
}

// ---- 1. locate the live transcript: newest LAST timestamp among this project's .jsonl files ----
if (!existsSync(PROJECTS_DIR)) {
  fail(`Transcript directory does not exist: ${PROJECTS_DIR}`);
  process.exit(0);
}
const candidates = readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.jsonl'));
if (!candidates.length) {
  fail(`Transcript directory exists but has no .jsonl files: ${PROJECTS_DIR}`);
  process.exit(0);
}

let chosen = null; // { file, lastTs, firstTs, lineCount }
for (const f of candidates) {
  const abs = join(PROJECTS_DIR, f);
  let lines;
  try {
    lines = readFileSync(abs, 'utf8').split('\n').filter(Boolean);
  } catch {
    continue;
  }
  let firstTs = null;
  let lastTs = null;
  for (const l of lines) {
    let o;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    if (o.timestamp) {
      if (!firstTs) firstTs = o.timestamp;
      lastTs = o.timestamp;
    }
  }
  if (!lastTs) continue;
  if (!chosen || lastTs > chosen.lastTs) {
    chosen = { file: f, abs, lastTs, firstTs, lineCount: lines.length };
  }
}

if (!chosen) {
  fail(`Found ${candidates.length} .jsonl file(s) in ${PROJECTS_DIR}, but none had a readable, timestamped entry.`);
  process.exit(0);
}

console.log(`transcript directory: ${PROJECTS_DIR}`);
console.log(`chosen file: ${chosen.file}  (newest last-entry timestamp among ${candidates.length} candidate file(s))`);
console.log(`  entries: ${chosen.lineCount}  ·  span: ${chosen.firstTs} .. ${chosen.lastTs}`);

// ---- 2. parse every entry ----
const raw = readFileSync(chosen.abs, 'utf8').split('\n').filter(Boolean);
let parseErrors = 0;
const objs = [];
for (const l of raw) {
  try {
    objs.push(JSON.parse(l));
  } catch {
    parseErrors++;
  }
}

// ---- 3. reduce every tool_use block to one short descriptor line ----
function toolDescriptor(name, input) {
  input = input || {};
  const pick = (...keys) => keys.map((k) => input[k]).find((v) => typeof v === 'string' && v.length);
  let d;
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      d = input.file_path;
      break;
    case 'Bash':
    case 'PowerShell':
      d = input.description ? `${input.description} — ${input.command}` : input.command;
      break;
    case 'Agent':
      d = `${input.description || '(no description)'} [${input.subagent_type || '?'}${input.model ? '/' + input.model : ''}]`;
      break;
    case 'Skill':
      d = input.args ? `${input.skill} — ${input.args}` : input.skill;
      break;
    case 'ToolSearch':
      d = input.query;
      break;
    case 'WebSearch':
      d = input.query;
      break;
    case 'WebFetch':
      d = input.url;
      break;
    case 'SendMessage':
      d = `to ${input.to || '?'}${input.summary ? ' — ' + input.summary : ''}`;
      break;
    case 'TaskStop':
      d = `task_id ${input.task_id || '?'}`;
      break;
    case 'AskUserQuestion': {
      const qs = Array.isArray(input.questions) ? input.questions : [];
      d = qs.length ? `${qs.length} question(s), first: ${qs[0].question}` : '(no questions)';
      break;
    }
    case 'Glob':
      d = `${input.pattern || '?'}${input.path ? ' in ' + input.path : ''}`;
      break;
    case 'Grep':
      d = `${input.pattern || '?'}${input.path ? ' in ' + input.path : ''}`;
      break;
    case 'Artifact':
      d = input.file_path || input.url || input.action;
      break;
    default:
      d = pick('file_path', 'relative_path', 'url', 'command', 'query', 'name_path', 'name_path_pattern', 'target', 'substring_pattern', 'pattern');
      if (!d) {
        const s = JSON.stringify(input);
        d = s.length > 140 ? s.slice(0, 140) + '…' : s;
      }
  }
  if (typeof d === 'string' && d.length > 220) d = d.slice(0, 220) + '…';
  return d;
}

// ---- 4. reduce an async task-notification (a subagent's tool result, delivered later) to one line ----
function taskNotificationLine(text) {
  const status = /<status>([^<]*)<\/status>/.exec(text)?.[1] || '?';
  const summary = /<summary>([^<]*)<\/summary>/.exec(text)?.[1] || '(no summary)';
  return `[background agent notification] ${summary} — status: ${status}`;
}

// ---- 5. walk the transcript in file order (already chronological — append-only log) ----
const entries = []; // { day, time, speaker, kind, text }
let skipCounts = {
  otherTypes: 0,
  isMeta: 0,
  toolResults: 0,
  thinkingBlocks: 0,
  localCommandNoise: 0,
  parseErrors,
};
let userTextCount = 0;
let assistantTextCount = 0;
let toolLineCount = 0;
let taskNotificationCount = 0;
let slashCommandCount = 0;

for (const o of objs) {
  if (!o.timestamp) {
    if (o.type !== 'user' && o.type !== 'assistant') skipCounts.otherTypes++;
    continue;
  }
  const { day, time } = localStamp(o.timestamp);

  if (o.type === 'user') {
    if (o.isMeta) {
      skipCounts.isMeta++;
      continue;
    }
    const content = o.message?.content;
    if (typeof content === 'string') {
      if (content.startsWith('<local-command')) {
        skipCounts.localCommandNoise++;
      } else if (content.startsWith('<command-name>') || /<command-name>/.test(content)) {
        const cmd = /<command-name>([^<]*)<\/command-name>/.exec(content)?.[1] || '(unknown)';
        const args = /<command-args>([^<]*)<\/command-args>/.exec(content)?.[1] || '';
        entries.push({ day, time, speaker: 'Owner', kind: 'command', text: `ran slash command: ${cmd}${args ? ' ' + args : ''}` });
        slashCommandCount++;
      } else if (content.startsWith('<task-notification>')) {
        entries.push({ day, time, speaker: 'System', kind: 'notification', text: taskNotificationLine(content) });
        taskNotificationCount++;
      } else {
        entries.push({ day, time, speaker: 'Owner', kind: 'text', text: content });
        userTextCount++;
      }
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result') {
          skipCounts.toolResults++;
        } else if (block.type === 'text') {
          entries.push({ day, time, speaker: 'Owner', kind: 'text', text: block.text });
          userTextCount++;
        }
      }
    }
  } else if (o.type === 'assistant') {
    const content = o.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'text' && block.text && block.text.trim()) {
        entries.push({ day, time, speaker: 'Assistant', kind: 'text', text: block.text });
        assistantTextCount++;
      } else if (block.type === 'tool_use') {
        const desc = toolDescriptor(block.name, block.input);
        entries.push({ day, time, speaker: 'Assistant', kind: 'tool', text: `[tool: ${block.name}] ${desc ?? ''}` });
        toolLineCount++;
      } else if (block.type === 'thinking') {
        skipCounts.thinkingBlocks++;
      }
    }
  } else {
    skipCounts.otherTypes++;
  }
}

if (!entries.length) {
  fail(`Parsed ${objs.length} entries from ${chosen.file} but found zero renderable user/assistant entries.`);
  process.exit(0);
}

// ---- 6. render, grouped by local day ----
const lines = [];
lines.push('# Enforcement arc — session audit');
lines.push('');
lines.push('> **This file is GENERATED, never hand-edited.** It is a projection of the live Claude Code');
lines.push('> session transcript, rebuilt from scratch every time `scripts/build-audit.mjs` runs (wired');
lines.push('> into `scripts/check-meta.mjs`, last in the chain, non-blocking). Editing this file by hand');
lines.push('> loses the edit on the next run — change the transcript (impossible) or the script instead.');
lines.push('>');
lines.push(`> Source transcript: \`${chosen.abs}\``);
lines.push(`> chosen because its last entry (${chosen.lastTs}) is the newest among ${candidates.length} candidate file(s) in`);
lines.push(`> \`${PROJECTS_DIR}\`.`);
lines.push(`> Transcript span: ${chosen.firstTs} .. ${chosen.lastTs} · ${chosen.lineCount} raw JSONL entries.`);
lines.push('>');
lines.push('> **Captures:** every real user-typed message and every assistant TEXT block, chronological,');
lines.push('> local time (GMT+3). A slash command is recorded as the command line. An async subagent');
lines.push('> completion is recorded as one reduced line (its own summary + status), not the raw envelope.');
lines.push('>');
lines.push('> **Does NOT capture:** raw tool_use inputs or tool_result outputs verbatim — each tool call');
lines.push('> is reduced to one line (tool name + a short descriptor from its own input). Extended-thinking');
lines.push('> blocks, skill-body injections, and CLI control-plane bookkeeping are omitted entirely. This');
lines.push('> is a stated reduction, not a complete byte-level log — see counts below.');
lines.push('');
lines.push('## Counts');
lines.push('');
lines.push(`- user messages rendered: ${userTextCount}`);
lines.push(`- slash commands rendered: ${slashCommandCount}`);
lines.push(`- background-agent notifications rendered: ${taskNotificationCount}`);
lines.push(`- assistant text blocks rendered: ${assistantTextCount}`);
lines.push(`- tool-call lines rendered: ${toolLineCount}`);
lines.push(`- total rendered entries: ${entries.length}`);
lines.push(`- skipped — isMeta (skill-body injections, control caveats): ${skipCounts.isMeta}`);
lines.push(`- skipped — tool_result blocks (the reduction this file states): ${skipCounts.toolResults}`);
lines.push(`- skipped — extended-thinking blocks: ${skipCounts.thinkingBlocks}`);
lines.push(`- skipped — local-command-stdout/caveat noise: ${skipCounts.localCommandNoise}`);
lines.push(`- skipped — other non-message JSONL record types (mode/attachment/system/…): ${skipCounts.otherTypes}`);
lines.push(`- unparseable JSONL lines: ${skipCounts.parseErrors}`);
lines.push('');

let curDay = null;
for (const e of entries) {
  if (e.day !== curDay) {
    curDay = e.day;
    lines.push(`## ${curDay}`);
    lines.push('');
  }
  if (e.kind === 'tool') {
    lines.push(`*${e.time} · ${e.speaker} — ${e.text}*`);
  } else if (e.kind === 'command') {
    lines.push(`**${e.time} · ${e.speaker}** ${e.text}`);
  } else if (e.kind === 'notification') {
    lines.push(`**${e.time} · ${e.speaker}:** ${e.text}`);
  } else {
    lines.push(`**${e.time} · ${e.speaker}:**`);
    lines.push('');
    lines.push(e.text);
  }
  lines.push('');
}

writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
const bytes = statSync(OUT_FILE).size;
console.log(`\nwrote ${OUT_FILE}`);
console.log(`  ${entries.length} rendered entries (${userTextCount} user, ${slashCommandCount} commands, ${taskNotificationCount} notifications, ${assistantTextCount} assistant text, ${toolLineCount} tool lines) · ${bytes} bytes`);
process.exit(0);
