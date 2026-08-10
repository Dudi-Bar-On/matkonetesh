// scripts/hooks/rules/version-pin-floating.mjs — L52: "'always take the newest' is a version
// policy, not a tagging policy — and the newest changes contracts." A floating `latest` pin let
// a future pull swap the database engine under a running system with nothing in any diff; the
// same day, PostgreSQL 18 moved the data mount path and Neo4j moved to CalVer — both "newest",
// both contract changes that had to be READ, not assumed.
//
// PAYLOAD POSITION: content ADDED (new_string/content) to a pin-carrying config file — .yml/.yaml,
// Dockerfile*, package.json — matching a floating pin shape: `image: <name>:latest`,
// `FROM <name>:latest`, or a package.json dependency valued "latest". Measured against the real
// tree before writing this: ZERO tracked occurrences, so the false-alarm replay of every tracked
// config passes by construction today and guards the future.
//
// SEVERITY: BLOCK, argued: harm to substance — an engine swap that no diff will ever show is the
// worst kind of change (invisible locally, fatal later), and the alternative costs one lookup and
// is named in the message: pin the newest version NUMBER, and when the number crosses a major,
// read that component's own release notes before debugging anything.
export const RULE_IDS = ['L52'];

import { basename } from 'node:path';
import { normPath, toolFilePath, newContent } from '../lib/target-path.mjs';

const FLOATING = [
  /\bimage\s*:\s*["']?[\w./-]+:latest\b/,   // compose/k8s image pin
  /\bFROM\s+[\w./-]+:latest\b/i,            // Dockerfile
];
const PKG_LATEST = /"[^"\n]+"\s*:\s*"latest"/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  if (!np) return { decision: 'allow', reason: 'L52 degraded: no file_path — allowing' };
  const base = basename(np);
  const isPinFile = np.endsWith('.yml') || np.endsWith('.yaml')
    || base.startsWith('dockerfile') || base === 'package.json';
  if (!isPinFile) return { decision: 'allow', reason: 'not a pin-carrying config file' };

  const added = newContent(input);
  if (typeof added !== 'string') {
    return { decision: 'allow', reason: 'L52 degraded: no added content — allowing' };
  }
  const hit = FLOATING.some((re) => re.test(added))
    || (base === 'package.json' && PKG_LATEST.test(added));
  if (!hit) return { decision: 'allow', reason: 'no floating pin in the added content' };
  return {
    decision: 'block',
    reason: 'L52 ("always take the newest" is a version policy, not a tagging policy): `latest` '
      + 'is a FLOATING pointer — a future pull swaps the component under a running system with '
      + 'nothing in any diff to show it. Blocked. Pin the newest version NUMBER instead (same '
      + 'software today, and a change that has to be written down to happen) — and when that '
      + 'number moves a whole major, read the component\'s own release notes for changed mount '
      + 'paths / env names / entrypoints BEFORE debugging (Postgres 18 moved the data mount; '
      + 'Neo4j went CalVer — both were documented upstream and cost a diagnostic cycle each).',
  };
}
