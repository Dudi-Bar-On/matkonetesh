// Static server for the Playwright test webServer. SINGLE in-memory process.
//
// It serves dist/ from an in-memory Buffer map (zero per-request disk I/O). That in-memory property — not
// clustering — is what keeps high --workers reliable: the original Python/naive server stalled because it did
// a fresh ~2.4MB DISK read per request, which got conflated with "single process is too slow". A Node cluster
// was added to fix the disk problem, but its `cluster.on('exit', () => cluster.fork())` respawn (no
// exitedAfterDisconnect guard — Node's own documented anti-pattern) meant a killed worker respawned into a
// wedged ZOMBIE server that held the port, accepted connections, and never responded — wedging 8123 for every
// later run. Dropping the cluster removes that whole risk class. The suite peaks at ≤10-20 concurrent
// connections; a single in-memory process serves that with orders of magnitude to spare.
// (Analysis: docs/research/test-stack-alternatives-research.md.)
//
// TEARDOWN (§11a — every setup owns its teardown): Playwright owns start/stop via webServer.command and
// tree-kills on teardown; NEVER kill a suite mid-run. The SIGINT/SIGTERM handlers below are defense-in-depth
// so a direct signal also closes the listener cleanly instead of leaving an orphan.
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.argv[2], 10) || 8123;
const root = path.join(__dirname, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Read every file under dist/ into memory once. The cache keys ARE the only servable paths, so a traversal
// like /../secret simply misses the map → 404 (safer than a startsWith(root) guard).
const cache = new Map();
(function load(dir) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) load(fp);
    else cache.set('/' + path.relative(root, fp).split(path.sep).join('/'), fs.readFileSync(fp));
  }
})(root);

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const data = cache.get(p);
  if (!data) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Content-Length': data.length });
  res.end(data);
});
server.keepAliveTimeout = 60_000;             // reuse connections across a worker's many navigations
server.listen({ port, backlog: 1024 });       // large backlog absorbs connection bursts
console.log('node in-memory static server on :' + port + ' serving dist/ (single process)');

function shutdown() { try { server.close(() => process.exit(0)); } catch (e) { process.exit(0); } setTimeout(() => process.exit(0), 2000).unref(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
