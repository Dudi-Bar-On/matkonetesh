// A Playwright reporter that records every run into test-intel.db. Phase B.
//
// Attached in playwright.config.ts. It writes and never blocks: a reporter that can fail a suite
// is a reporter that will one day fail a suite for a reason having nothing to do with the code
// under test, and everyone will learn to distrust the result. Every write here is wrapped.
//
// WHAT IT RECORDS THAT THE TERMINAL DOES NOT:
//   * `retry` — a test that PASSED ON RETRY is a flake, and the summary line calls it a pass.
//     Without this column the flake rate cannot be computed at all.
//   * `layer` and `spec_filter` — so a 40-second smoke run is never mistaken for evidence about
//     the 1,186 tests it did not run. Silent truncation reading as coverage is the failure this
//     whole phase exists to end.
//   * `exit_code` — the verdict, not the impression.

import { open, DB_PATH } from './test-intel.mjs';
import { execFileSync } from 'node:child_process';

function commitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export default class TestIntelReporter {
  constructor(options = {}) {
    this.enabled = process.env.TEST_INTEL !== '0';
    this.layer = process.env.TEST_INTEL_LAYER || options.layer || 'full';
    this.specFilter = process.env.TEST_INTEL_FILTER || null;
    this.rows = [];
    this.started = Date.now();
    this.workers = null;
  }

  onBegin(config) {
    this.workers = config?.workers ?? null;
  }

  onTestEnd(test, result) {
    if (!this.enabled) return;
    // titlePath() is [project, file, ...describes, title]. The file is what `specs` keys on, and
    // the full title is what identifies a single test across runs.
    const file = (test.location?.file ?? '').replace(/\\/g, '/');
    const spec = file.includes('/tests/') ? `tests/${file.split('/tests/').pop()}` : file;
    this.rows.push({
      spec,
      test: test.titlePath().slice(2).join(' > ') || test.title,
      status: result.status,
      duration_ms: Math.round(result.duration ?? 0),
      retry: result.retry ?? 0,
      project: test.parent?.project?.()?.name ?? null,
    });
  }

  async onEnd(result) {
    if (!this.enabled) return;
    try {
      const db = open();
      const run = db.prepare(
        'INSERT INTO runs (ts, commit_sha, layer, duration_ms, workers, exit_code, spec_filter) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        new Date().toISOString(), commitSha(), this.layer,
        Date.now() - this.started, this.workers,
        result?.status === 'passed' ? 0 : 1, this.specFilter,
      );
      const runId = Number(run.lastInsertRowid);

      const insert = db.prepare(
        'INSERT INTO results (run_id, spec, test, status, duration_ms, retry, project) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      db.exec('BEGIN');
      for (const r of this.rows) {
        insert.run(runId, r.spec, r.test, r.status, r.duration_ms, r.retry, r.project);
      }
      db.exec('COMMIT');
      db.close();
      console.log(
        `\n[test-intel] run ${runId} recorded: layer=${this.layer} · ${this.rows.length} results · ` +
        `${((Date.now() - this.started) / 1000).toFixed(1)}s -> ${DB_PATH.split(/[\\/]/).pop()}`
      );
    } catch (err) {
      // Reported, never thrown. The suite's verdict is about the product, not about telemetry.
      console.log(`\n[test-intel] NOT RECORDED — ${err?.message ?? err}`);
    }
  }
}
