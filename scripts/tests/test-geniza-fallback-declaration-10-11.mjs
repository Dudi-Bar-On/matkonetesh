// scripts/tests/test-geniza-fallback-declaration-10-11.mjs
import { evaluate } from '../hooks/rules/geniza-fallback-declaration.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// CATCH: a WebSearch with no geniza consultation anywhere in the transcript must warn, citing 10.11.
const dir = mkdtempSync(join(tmpdir(), '10-11-catch-'));
const transcriptPath = join(dir, 'transcript.jsonl');
writeFileSync(transcriptPath, JSON.stringify({
  type: 'assistant', timestamp: new Date().toISOString(),
  message: { content: [{ type: 'text', text: 'let me search the web' }] },
}) + '\n', 'utf8');

const result = evaluate({
  tool_name: 'WebSearch',
  tool_input: { query: 'gemini 3.6 flash pricing' },
  transcript_path: transcriptPath,
});
if (result.decision !== 'warn' || !/10\.11|10\.13/.test(result.reason)) {
  console.error(`FAIL  expected warn citing the geniza-first rule, got: ${JSON.stringify(result)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  WebSearch with no prior geniza consult -> warn');
}

// FALSE-ALARM: a WebSearch immediately after a real search_current_docs call in the same
// transcript must NOT warn — this is legitimate geniza-first behavior, not a bypass.
const dir2 = mkdtempSync(join(tmpdir(), '10-11-false-alarm-'));
const transcriptPath2 = join(dir2, 'transcript.jsonl');
writeFileSync(transcriptPath2, [
  JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), message: { content: [
    { type: 'tool_use', name: 'Bash', input: { command: 'python -c "from src.knowledge import retrieval; retrieval.search_current_docs(\'gemini pricing\')"' } },
  ] } }),
  JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), message: { content: [{ type: 'text', text: 'geniza had nothing, now the web' }] } }),
].join('\n') + '\n', 'utf8');

const result2 = evaluate({
  tool_name: 'WebSearch',
  tool_input: { query: 'gemini 3.6 flash pricing' },
  transcript_path: transcriptPath2,
});
if (result2.decision !== 'allow') {
  console.error(`FAIL  expected allow after a real geniza consult, got: ${JSON.stringify(result2)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  WebSearch after a real geniza consult -> allow (no false alarm)');
}
