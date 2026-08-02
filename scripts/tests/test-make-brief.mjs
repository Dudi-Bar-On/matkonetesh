// scripts/tests/test-make-brief.mjs — self-test for the brief generator.
//
// The debt this tool pays off: five briefs were sliced straight out of plan text and carried none of
// §13's six required fields, so check-brief went red and the escape hatch got used three times. The
// generator exists so a brief is template-shaped by construction.
//
// The load-bearing tests here are the REFUSAL ones. A generator that emitted "(א) TODO" would satisfy
// check-brief's marker scan while producing an empty brief — it would defeat the gate it was built to
// serve. So the two fields that require human judgement (spec lines, primary tool) must be supplied,
// and a placeholder must be rejected as firmly as an absence.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { assertExit, runNode, tempDir, writeFile, summary } from './test-helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GEN = join(HERE, '..', 'make-brief.mjs');
const CHECK = join(HERE, '..', 'check-brief.mjs');

const PLAN = `# Feature Plan

## Global Constraints

- Version floor: node 22
- Copy rule: Hebrew body, English labels

---

### Task 1: First thing

**Files:**
- Modify: \`app.js:100-120\`

- [ ] **Step 1: Write the failing test**

\`\`\`js
test('does the thing', async () => { expect(thing()).toBe(1); });
\`\`\`

### Task 2: Second thing

**Files:**
- Create: \`src/other.js\`
`;

const dir = tempDir('make-brief-');
const plan = writeFile(dir, 'plan.md', PLAN);
const ok = ['--plan', plan, '--task', '1', '--out', join(dir, 'arc-task-1-brief.md'),
            '--spec', 'המפרט §4.2: "כל נתח מציג את תחנותיו לפי סדר"', '--tool', 'serena'];

// ---- refusals: the generator must never be usable to manufacture a compliant-looking empty brief ----
assertExit('missing --spec -> refuse', runNode(GEN, ok.filter((a, i) => i < 6 || i > 7)), 1);
assertExit('missing --tool -> refuse', runNode(GEN, ok.slice(0, 8)), 1);
// `ok` is positional: [--plan, plan, --task, N, --out, out, --spec, SPEC(7), --tool, TOOL(9)].
// An earlier version of this test spliced at the wrong index and quietly asserted --tool twice while
// claiming to test --spec; both "passed" for the wrong reason. Replace by explicit index.
const withArg = (i, v) => ok.map((a, j) => (j === i ? v : a));
assertExit('placeholder --spec ("TODO") -> refuse', runNode(GEN, withArg(7, 'TODO')), 1);
assertExit('placeholder --spec ("<fill in>") -> refuse', runNode(GEN, withArg(7, '<fill in>')), 1);
assertExit('placeholder --tool ("TBD") -> refuse', runNode(GEN, withArg(9, 'TBD')), 1);
assertExit('--tool not one of the declared tools -> refuse', runNode(GEN, withArg(9, 'vibes')), 1);
assertExit('task number absent from the plan -> refuse',
  runNode(GEN, ok.map(a => (a === '1' ? '99' : a))), 1);

// ---- the good path ----
const out = join(dir, 'arc-task-1-brief.md');
if (assertExit('valid inputs -> writes a brief', runNode(GEN, ok), 0)) {
  const text = existsSync(out) ? readFileSync(out, 'utf8') : '';
  let bad = [];
  for (const marker of ['(א)', '(ב)', '(ג)', '(ד)', '(ה)', '(ו)']) if (!text.includes(marker)) bad.push(marker);
  // The point of field (ב) is the ACTUAL code, not a pointer to the plan - so prove the slice landed.
  if (!text.includes("test('does the thing'")) bad.push('plan code for Task 1');
  // ...and prove it stopped at the next task rather than swallowing the rest of the file.
  if (text.includes('Second thing')) bad.push('LEAKED Task 2 into Task 1 brief');
  if (!text.includes('node 22')) bad.push("plan's Global Constraints");
  console.log(bad.length ? `FAIL  generated brief is missing: ${bad.join(', ')}` : 'PASS  generated brief carries all six fields, the task slice, and the constraints');
  if (bad.length) process.exitCode = 1;

  // ---- the real proof: the gate this exists to satisfy must accept the generator's own output ----
  assertExit('check-brief accepts the generated brief',
    runNode(CHECK, [], { SDD_DIR: dir, GATE_BASELINES: join(dir, 'no-baseline.json') }), 0);
}

summary('make-brief');
