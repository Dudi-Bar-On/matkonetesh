#!/usr/bin/env node
// W0 measurement instrument — cold `page.goto` vs warm `page.reload()`, per
// docs/research/warm-page-architecture-research.md ("Measurement plan (W0 — decides everything)").
//
// Plain Playwright LIBRARY (not the test runner) — no config coupling, no dependency on
// playwright.config.ts. Uses the repo's already-installed @playwright/test Chromium
// (node_modules/@playwright/test -> playwright-core -> chromium-1228), so nothing extra to install.
//
// SELF-CONTAINED: spins its OWN tiny static server on port 8124 (default), never touching serve.js or
// racing the suite's 8123 (CLAUDE.md §11a). The server has a --mode 200|304 toggle:
//   200  = byte-for-byte what serve.js does TODAY: plain 200, no ETag, no Cache-Control, no conditional
//          request handling at all (serve.js:41-48, quoted in the research doc's "Repo facts").
//   304  = the D1 proposal: ETag (sha1 of each file, computed once at startup) + Cache-Control:no-cache,
//          honouring If-None-Match with an empty-body 304. This is the decisive lever for the V8 disk
//          code cache (a 200 "clears the code cache"; a 304 "keeps our code cache hot" — v8.dev, quoted
//          in the research doc's Q3b) and for transfer-size savings on a warm reload (Q3a).
//
// Three arms, matching the doc's numbered plan (§Measurement plan, items 1-3):
//   cold            — fresh ephemeral BrowserContext per iteration, one goto each (today's architecture).
//   warm-ephemeral  — ONE ephemeral context/page, goto once, then N x {seed-evaluate -> reload}  (Option A).
//   warm-persistent — same as warm-ephemeral but launchPersistentContext(scratch userDataDir) (Option B).
//
// Primary metric: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd — this is
// EXACTLY the condition tests/_fixtures.ts waits on (waitUntil:'domcontentloaded'), so it is the number
// the suite's wall-clock is actually gated by. transferSize is recorded alongside as the 200-vs-304
// transfer evidence (Q3a).
//
// Secondary, BEST-EFFORT diagnostic: on the cold arm's first --trace-samples iterations (default 3, per
// the doc: "a CDP trace window ... on 3 runs to split fetch / parse+compile / execute+render"), a raw
// Chrome DevTools Protocol `Tracing` capture (categories: devtools.timeline,v8,disabled-by-default-v8.compile,
// blink.user_timing) is bucketed by event name into {transfer, parseCompile, executeRender, other}. This
// bucketing is a HEURISTIC over Chrome's internal trace-event names, not a guaranteed-correct taxonomy —
// treat it as a diagnostic signal, cross-check with a chrome://tracing import if a split looks surprising.
// The top-20-by-duration raw event names are also recorded so a human can refine the bucketing later
// without re-capturing.
//
// Self-verification (CLAUDE.md L20 — "verify the measurement before trusting the measurement"): the
// script asserts, and refuses to report a clean result if false, that (a) the server actually served
// bytes and requests > 0, (b) every arm produced exactly the requested number of non-null navigation
// timing samples, (c) any arm run under --mode 304 actually observed at least one real 304 response (so
// "we tested 304 mode" cannot be a silent lie if the ETag/If-None-Match wiring is broken).
//
// Usage:
//   node scripts/w0-warm-page-measure.mjs --help
//   node scripts/w0-warm-page-measure.mjs                                   # full W0 plan, defaults
//   node scripts/w0-warm-page-measure.mjs --arms cold --count 3 --trace-samples 1   # fast smoke path
//   node scripts/w0-warm-page-measure.mjs --arms warm-ephemeral --mode 304 --warm-count 60
//
// Output: JSON to docs/research/measurements/w0-<UTC-timestamp>.json (override with --out / --out-dir)
// plus a human-readable summary table + GO/NO-GO verdict on stdout.

import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'docs', 'research', 'measurements');

// Matches playwright.config.ts's own launchOptions.args exactly (fonts.googleapis.com resolved to
// localhost so a slow/throttled external font request fails FAST instead of stalling navigation —
// see playwright.config.ts's comment). Kept identical so this instrument measures the same conditions
// the real suite runs under, not a rosier "no network noise" scenario.
const CHROME_ARGS = ['--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1'];

const TRACE_CATEGORIES = [
  'devtools.timeline', 'v8', 'disabled-by-default-v8.compile', 'blink.user_timing',
  'loading', 'disabled-by-default-devtools.timeline',
].join(',');

// Best-effort bucketing of raw CDP trace event names — see file header caveat.
const COMPILE_NAMES = new Set([
  'V8.CompileScript', 'v8.compile', 'V8.CompileCode', 'V8.CompileFullCode', 'V8.CompileIgnition',
  'V8.Parse', 'ParseHTML', 'Compile', 'V8.CompileLazy', 'V8.CompileEval',
  'v8.compile.serialize', 'v8.produceCache', 'v8.consumeCache', 'V8.ParseFunction', 'V8.ParseProgram',
]);
const EXECUTE_NAMES = new Set([
  'EvaluateScript', 'v8.evaluateModule', 'FunctionCall', 'V8.Execute', 'RunMicrotasks',
  'Layout', 'UpdateLayoutTree', 'Paint', 'RasterTask', 'CompositeLayers', 'v8.run', 'V8.GC', 'MinorGC', 'MajorGC',
]);
const TRANSFER_NAMES = new Set([
  'ResourceSendRequest', 'ResourceReceiveResponse', 'ResourceReceivedData', 'ResourceFinish', 'ParseAuthorStyleSheet',
]);

// ---------------------------------------------------------------------------------------------------
// CLI parsing (no dependency — matches this repo's other scripts/*.mjs style)
// ---------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {
    mode: 'both', arms: ['cold', 'warm-ephemeral', 'warm-persistent'],
    coldCount: 30, warmCount: 60, traceSamples: 3, heapEvery: 10,
    port: 8124, outDir: DEFAULT_OUT_DIR, out: null, headed: false, verbose: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    const next = () => { i++; if (i >= argv.length) throw new Error(`${tok} needs a value`); return argv[i]; };
    switch (tok) {
      case '--help': case '-h': a.help = true; break;
      case '--mode': a.mode = next(); break;
      case '--arms': a.arms = next().split(',').map(s => s.trim()).filter(Boolean); break;
      case '--count': { const n = parseInt(next(), 10); a.coldCount = n; a.warmCount = n; break; }
      case '--cold-count': a.coldCount = parseInt(next(), 10); break;
      case '--warm-count': a.warmCount = parseInt(next(), 10); break;
      case '--trace-samples': a.traceSamples = parseInt(next(), 10); break;
      case '--heap-every': a.heapEvery = parseInt(next(), 10); break;
      case '--port': a.port = parseInt(next(), 10); break;
      case '--out-dir': a.outDir = path.resolve(next()); break;
      case '--out': a.out = path.resolve(next()); break;
      case '--headed': a.headed = true; break;
      case '--verbose': a.verbose = true; break;
      default: throw new Error(`unknown flag: ${tok} (see --help)`);
    }
  }
  const validArms = new Set(['cold', 'warm-ephemeral', 'warm-persistent']);
  for (const arm of a.arms) if (!validArms.has(arm)) throw new Error(`unknown arm: ${arm} (valid: cold, warm-ephemeral, warm-persistent)`);
  if (!['200', '304', 'both'].includes(a.mode)) throw new Error(`--mode must be 200, 304, or both (got ${a.mode})`);
  return a;
}

function printHelp() {
  console.log(`
W0 warm-page measurement instrument (docs/research/warm-page-architecture-research.md)

Usage: node scripts/w0-warm-page-measure.mjs [options]

  --arms <list>          comma list of: cold,warm-ephemeral,warm-persistent  (default: all three)
  --mode <200|304|both>  server ETag/If-None-Match behaviour for warm arms   (default: both)
                         cold arm is unaffected by mode (a fresh context never has a cached
                         validator to send on its first request) and runs once under the first
                         requested mode only.
  --count <N>            set BOTH --cold-count and --warm-count in one go
  --cold-count <N>       iterations for the cold arm                         (default: 30)
  --warm-count <N>       reloads for each warm arm+mode combination          (default: 60)
  --trace-samples <N>    cold-arm iterations that also capture a CDP trace   (default: 3)
  --heap-every <N>       sample JS heap size every N warm reloads           (default: 10)
  --port <N>             this script's OWN static server port               (default: 8124)
  --out-dir <path>       directory for the JSON result                      (default: docs/research/measurements)
  --out <path>           explicit JSON output path (overrides --out-dir)
  --headed               run Chromium headed (debugging only)
  --verbose              print per-iteration progress
  --help                 this text

Examples:
  node scripts/w0-warm-page-measure.mjs                                   # full W0 plan
  node scripts/w0-warm-page-measure.mjs --arms cold --count 3 --trace-samples 1   # fast smoke path
  node scripts/w0-warm-page-measure.mjs --arms warm-persistent --mode 304 --warm-count 60
`);
}

// ---------------------------------------------------------------------------------------------------
// Self-contained static server — mirrors serve.js's file set, NEVER imports/touches serve.js itself.
// ---------------------------------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function loadDist(root) {
  const cache = new Map();
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else {
        const data = fs.readFileSync(fp);
        const rel = '/' + path.relative(root, fp).split(path.sep).join('/');
        const etag = '"' + crypto.createHash('sha1').update(data).digest('hex') + '"';
        cache.set(rel, { data, etag, ext: path.extname(fp) });
      }
    }
  })(root);
  return cache;
}

function startServer(port, cache, stats) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const hit = cache.get(p);
    stats.requests++;
    if (!hit) { res.writeHead(404); res.end('not found'); return; }
    if (stats.mode === '304' && req.headers['if-none-match'] === hit.etag) {
      res.writeHead(304, { ETag: hit.etag, 'Cache-Control': 'no-cache' });
      res.end();
      stats.notModified304++;
      return;
    }
    const headers = { 'Content-Type': TYPES[hit.ext] || 'application/octet-stream', 'Content-Length': hit.data.length };
    if (stats.mode === '304') { headers.ETag = hit.etag; headers['Cache-Control'] = 'no-cache'; }
    // mode 200 sends NEITHER header — this is byte-for-byte today's serve.js (no validators at all).
    res.writeHead(200, headers);
    res.end(hit.data);
    stats.bytesServed += hit.data.length;
    stats.responses200++;
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port, backlog: 1024 }, () => resolve(server));
  });
}

// ---------------------------------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------------------------------
function pct(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  const v = lo === hi ? sortedAsc[lo] : sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
  return Math.round(v * 100) / 100;
}
function summarize(values) {
  const clean = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((x, y) => x - y);
  if (!clean.length) return { n: 0, nTotal: values.length, p50: null, p90: null, mean: null, min: null, max: null };
  const sum = clean.reduce((x, y) => x + y, 0);
  return {
    n: clean.length, nTotal: values.length,
    p50: pct(clean, 50), p90: pct(clean, 90),
    mean: Math.round((sum / clean.length) * 100) / 100,
    min: clean[0], max: clean[clean.length - 1],
  };
}

async function readNavTiming(page) {
  return page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation');
    if (!nav) return null;
    return {
      transferSize: nav.transferSize ?? null,
      encodedBodySize: nav.encodedBodySize ?? null,
      decodedBodySize: nav.decodedBodySize ?? null,
      domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
      domInteractive: nav.domInteractive,
      responseEnd: nav.responseEnd,
      fetchStart: nav.fetchStart,
    };
  });
}

function bucketizeTrace(events) {
  const buckets = { transferMs: 0, parseCompileMs: 0, executeRenderMs: 0, otherMs: 0 };
  for (const e of events) {
    if (!e || !e.name || typeof e.dur !== 'number') continue;
    const ms = e.dur / 1000;
    if (COMPILE_NAMES.has(e.name)) buckets.parseCompileMs += ms;
    else if (EXECUTE_NAMES.has(e.name)) buckets.executeRenderMs += ms;
    else if (TRANSFER_NAMES.has(e.name)) buckets.transferMs += ms;
    else buckets.otherMs += ms;
  }
  for (const k of Object.keys(buckets)) buckets[k] = Math.round(buckets[k] * 100) / 100;
  return buckets;
}
function topEventsByDuration(events, n) {
  const byName = new Map();
  for (const e of events) {
    if (!e || !e.name || typeof e.dur !== 'number') continue;
    byName.set(e.name, (byName.get(e.name) || 0) + e.dur / 1000);
  }
  return [...byName.entries()].sort((x, y) => y[1] - x[1]).slice(0, n)
    .map(([name, ms]) => ({ name, totalMs: Math.round(ms * 100) / 100 }));
}

async function captureCdpTrace(context, page, navFn) {
  const client = await context.newCDPSession(page);
  const events = [];
  const onData = (params) => { if (params && Array.isArray(params.value)) events.push(...params.value); };
  client.on('Tracing.dataCollected', onData);
  const done = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.start', { categories: TRACE_CATEGORIES, transferMode: 'ReportEvents' });
  await navFn();
  await client.send('Tracing.end');
  await done;
  client.off('Tracing.dataCollected', onData);
  await client.detach().catch(() => {});
  return events;
}

// ---------------------------------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------------------------------
async function runCold(baseUrl, count, traceSamples, headed, verbose) {
  const browser = await chromium.launch({ headless: !headed, args: CHROME_ARGS });
  const results = [];
  const traces = [];
  try {
    for (let i = 0; i < count; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const url = `${baseUrl}/index.html`;
      if (i < traceSamples) {
        const events = await captureCdpTrace(context, page, () => page.goto(url, { waitUntil: 'domcontentloaded' }));
        traces.push({ iteration: i, eventCount: events.length, buckets: bucketizeTrace(events), topEvents: topEventsByDuration(events, 20) });
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      results.push(await readNavTiming(page));
      await context.close();
      if (verbose) console.error(`  cold[${i + 1}/${count}] dcl=${results[results.length - 1]?.domContentLoadedEventEnd ?? 'null'}ms`);
    }
  } finally { await browser.close(); }
  return { results, traces };
}

async function runWarmEphemeral(baseUrl, count, heapEvery, headed, verbose) {
  const browser = await chromium.launch({ headless: !headed, args: CHROME_ARGS });
  const results = [];
  const heapSamples = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' }); // the ONE cold parse — not counted
    const client = await context.newCDPSession(page);
    await client.send('Performance.enable').catch(() => {});
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window.name = ''; });
      await page.reload({ waitUntil: 'domcontentloaded' });
      results.push(await readNavTiming(page));
      if (i % heapEvery === 0) {
        try {
          const { metrics } = await client.send('Performance.getMetrics');
          const heap = (metrics.find(m => m.name === 'JSHeapUsedSize') || {}).value ?? null;
          heapSamples.push({ iteration: i, jsHeapUsedSize: heap });
        } catch { /* diagnostic only */ }
      }
      if (verbose) console.error(`  warm-ephemeral[${i + 1}/${count}] dcl=${results[results.length - 1]?.domContentLoadedEventEnd ?? 'null'}ms`);
    }
    await context.close();
  } finally { await browser.close(); }
  return { results, heapSamples };
}

async function runWarmPersistent(baseUrl, count, heapEvery, headed, verbose) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-w0-persist-'));
  const results = [];
  const heapSamples = [];
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: !headed, args: CHROME_ARGS, viewport: { width: 390, height: 844 },
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' }); // the ONE cold parse — not counted
    const client = await context.newCDPSession(page);
    await client.send('Performance.enable').catch(() => {});
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window.name = ''; });
      await page.reload({ waitUntil: 'domcontentloaded' });
      results.push(await readNavTiming(page));
      if (i % heapEvery === 0) {
        try {
          const { metrics } = await client.send('Performance.getMetrics');
          const heap = (metrics.find(m => m.name === 'JSHeapUsedSize') || {}).value ?? null;
          heapSamples.push({ iteration: i, jsHeapUsedSize: heap });
        } catch { /* diagnostic only */ }
      }
      if (verbose) console.error(`  warm-persistent[${i + 1}/${count}] dcl=${results[results.length - 1]?.domContentLoadedEventEnd ?? 'null'}ms`);
    }
  } finally {
    if (context) await context.close().catch(() => {});
    fs.rmSync(userDataDir, { recursive: true, force: true }); // setup owns its teardown — CLAUDE.md §11a
  }
  return { results, heapSamples };
}

// ---------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(`FATAL: ${path.join(DIST_DIR, 'index.html')} does not exist. Run "python build.py" first.`);
    process.exitCode = 1;
    return;
  }

  const cache = loadDist(DIST_DIR);
  const stats = { mode: '200', requests: 0, bytesServed: 0, responses200: 0, notModified304: 0 };
  const server = await startServer(args.port, cache, stats);
  const baseUrl = `http://localhost:${args.port}`;
  console.log(`W0 server listening on :${args.port}, serving ${cache.size} files from ${path.relative(REPO_ROOT, DIST_DIR)}/`);

  const armResults = {}; // key: `${arm}@${mode}` -> { results, traces?, heapSamples?, serverModeStatsAtStart, serverModeStatsAtEnd }
  const modesToRun = args.mode === 'both' ? ['200', '304'] : [args.mode];

  try {
    for (const arm of args.arms) {
      if (arm === 'cold') {
        const mode = modesToRun[0];
        stats.mode = mode;
        const before = { ...stats };
        console.log(`\n[cold@${mode}] ${args.coldCount} fresh-context navigations (mode is a no-op for cold; see header)...`);
        const { results, traces } = await runCold(baseUrl, args.coldCount, args.traceSamples, args.headed, args.verbose);
        armResults[`cold@${mode}`] = { expected: args.coldCount, results, traces, serverDelta: diffStats(before, stats) };
      } else {
        for (const mode of modesToRun) {
          stats.mode = mode;
          const before = { ...stats };
          console.log(`\n[${arm}@${mode}] ${args.warmCount} reloads...`);
          const { results, heapSamples } = arm === 'warm-ephemeral'
            ? await runWarmEphemeral(baseUrl, args.warmCount, args.heapEvery, args.headed, args.verbose)
            : await runWarmPersistent(baseUrl, args.warmCount, args.heapEvery, args.headed, args.verbose);
          armResults[`${arm}@${mode}`] = { expected: args.warmCount, results, heapSamples, serverDelta: diffStats(before, stats) };
        }
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ---- Aggregate per-arm stats ----
  const armStats = {};
  for (const [key, data] of Object.entries(armResults)) {
    armStats[key] = {
      dcl: summarize(data.results.map(r => r?.domContentLoadedEventEnd ?? null)),
      transferSize: summarize(data.results.map(r => r?.transferSize ?? null)),
    };
  }

  // ---- GO/NO-GO gate (research doc §Measurement plan item 5) ----
  // Primary comparison: cold (today's architecture) vs warm-ephemeral@304 (Option A, recommended first).
  const coldKey = Object.keys(armResults).find(k => k.startsWith('cold@'));
  const warmAKey = 'warm-ephemeral@304';
  const warmBKey = 'warm-persistent@304';
  const gate = { thresholdRatio: 0.60, escalateImprovement: 0.15 };
  if (coldKey && armStats[coldKey]?.dcl.p50 != null) {
    gate.coldP50 = armStats[coldKey].dcl.p50;
    gate.coldArm = coldKey;
    if (armStats[warmAKey]?.dcl.p50 != null) {
      gate.warmAP50 = armStats[warmAKey].dcl.p50;
      gate.warmArm = warmAKey;
      gate.ratio = Math.round((gate.warmAP50 / gate.coldP50) * 1000) / 1000;
      gate.result = gate.ratio <= gate.thresholdRatio ? 'GO' : 'NO-GO';
      if (armStats[warmBKey]?.dcl.p50 != null) {
        gate.warmBP50 = armStats[warmBKey].dcl.p50;
        gate.improvementOverA = Math.round(((gate.warmAP50 - gate.warmBP50) / gate.warmAP50) * 1000) / 1000;
        gate.escalateToB = gate.improvementOverA >= gate.escalateImprovement ? 'ESCALATE' : 'STAY-ON-A';
      }
    } else {
      gate.result = 'INCONCLUSIVE (warm-ephemeral@304 not run — pass --arms warm-ephemeral --mode 304 or omit --arms/--mode)';
    }
  } else {
    gate.result = 'INCONCLUSIVE (cold arm not run)';
  }

  // ---- Self-verification (L20: prove the workload happened before trusting the numbers) ----
  const checks = [];
  checks.push({ name: 'server received requests', ok: stats.requests > 0, detail: `requests=${stats.requests}` });
  checks.push({ name: 'server served real bytes', ok: stats.bytesServed > 0, detail: `bytesServed=${stats.bytesServed}` });
  for (const [key, data] of Object.entries(armResults)) {
    const gotNonNull = data.results.filter(r => r != null).length;
    checks.push({
      name: `${key}: got ${data.expected} non-null nav-timing samples`,
      ok: gotNonNull === data.expected,
      detail: `expected=${data.expected} nonNull=${gotNonNull}`,
    });
    if (key.endsWith('@304') && data.expected > 1) {
      checks.push({
        name: `${key}: at least one real HTTP 304 observed`,
        ok: data.serverDelta.notModified304 > 0,
        detail: `304 count in this arm's window=${data.serverDelta.notModified304} (proves If-None-Match actually round-tripped, not just that --mode 304 was passed)`,
      });
    }
  }
  const traceEventsTotal = Object.values(armResults).reduce((sum, d) => sum + (d.traces || []).reduce((s, t) => s + t.eventCount, 0), 0);
  if (args.traceSamples > 0 && args.arms.includes('cold')) {
    checks.push({ name: 'CDP trace captured >=1 event (diagnostic — non-fatal if it fails)', ok: traceEventsTotal > 0, detail: `totalTraceEvents=${traceEventsTotal}`, nonFatal: true });
  }
  const hardFails = checks.filter(c => !c.ok && !c.nonFatal);
  const selfVerification = { ok: hardFails.length === 0, checks };

  // ---- Write JSON ----
  fs.mkdirSync(args.outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = args.out || path.join(args.outDir, `w0-${stamp}.json`);
  const payload = {
    meta: {
      generatedAt: new Date().toISOString(), repoRoot: REPO_ROOT, distIndexBytes: fs.statSync(path.join(DIST_DIR, 'index.html')).size,
      nodeVersion: process.version, port: args.port, argv: process.argv.slice(2),
    },
    server: stats,
    armResults, armStats, gate, selfVerification,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  // ---- Human summary ----
  console.log('\n=== W0 summary ===');
  console.log('arm'.padEnd(24) + 'n'.padEnd(6) + 'dcl-p50(ms)'.padEnd(14) + 'dcl-p90(ms)'.padEnd(14) + 'transfer-p50(B)');
  for (const [key, s] of Object.entries(armStats)) {
    console.log(key.padEnd(24) + String(s.dcl.n).padEnd(6) + String(s.dcl.p50).padEnd(14) + String(s.dcl.p90).padEnd(14) + String(s.transferSize.p50));
  }
  console.log('\n=== GO/NO-GO gate (warm-ephemeral@304 p50 <= 60% of cold p50) ===');
  console.log(JSON.stringify(gate, null, 2));
  console.log('\n=== Self-verification ===');
  for (const c of checks) console.log(`  [${c.ok ? 'OK' : (c.nonFatal ? 'WARN' : 'FAIL')}] ${c.name} (${c.detail})`);
  console.log(`\nJSON written to ${outPath}`);

  if (!selfVerification.ok) {
    console.error('\nSELF-VERIFICATION FAILED — at least one hard check did not pass. Treat this run\'s numbers as UNTRUSTED.');
    process.exitCode = 1;
  }
}

function diffStats(before, after) {
  return {
    requests: after.requests - before.requests,
    bytesServed: after.bytesServed - before.bytesServed,
    responses200: after.responses200 - before.responses200,
    notModified304: after.notModified304 - before.notModified304,
  };
}

main().catch((e) => {
  console.error('\nFATAL:', e && e.stack || e);
  process.exitCode = 1;
});
