// Static server for the Playwright test webServer.
// Python's http.server AND a naive single-process node server both stall under concurrent test load
// (many Playwright workers each fetching the ~2.4MB dist/index.html), causing random page.goto
// ERR_ABORTED / 30s timeouts. Root cause: one event loop doing a fresh 2.4MB disk read per request.
//
// This server removes both bottlenecks so high --workers counts stay reliable:
//   1. CLUSTER — forks one worker per core (capped), all sharing the port; the OS load-balances
//      connections across cores instead of funnelling every request through a single process.
//   2. IN-MEMORY — each worker reads dist/ into memory once at startup and serves from a Buffer,
//      so there is zero per-request disk I/O even under a burst of concurrent navigations.
//   3. BACKLOG — a large listen backlog absorbs connection bursts instead of refusing them.
const http = require('http');
const os = require('os');
const cluster = require('cluster');
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

// Enough workers to absorb a burst of parallel navigations without oversubscribing the box.
const WORKERS = Math.max(2, Math.min(12, os.cpus().length));
const isPrimary = cluster.isPrimary !== undefined ? cluster.isPrimary : cluster.isMaster;

if (isPrimary) {
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on('exit', () => cluster.fork());   // keep the pool full if a worker dies
  console.log('node clustered static server on :' + port + ' (' + WORKERS + ' workers) serving dist/');
} else {
  // Read every file under dist/ into memory once. The cache keys ARE the only servable paths, so a
  // traversal like /../secret simply misses the map → 404 (safer than the old startsWith(root) guard).
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
  server.listen({ port, backlog: 1024 });
}
