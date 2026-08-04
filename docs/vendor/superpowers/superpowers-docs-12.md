---
name: superpowers-docs-12
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 12/33 (README.md)"
type: reference
---

## Recommendation

**Proceed with Phase 1 immediately:**
- verification-before-completion: Configuration change verification
- testing-anti-patterns: Mock-interface drift
- requesting-code-review: Explicit file reading

**Test Phase 2 with Jesse before finalizing:**
- Get feedback on self-reflection impact
- Validate process hygiene approach
- Confirm skills reading requirement is worth overhead

**Hold Phase 3 pending validation:**
- Lean context needs real-world testing
- Implementer-fix workflow change needs careful evaluation

These changes address real problems documented by users while minimizing risk of making skills worse.


<!-- source: docs/plans/2026-01-17-visual-brainstorming.md -->

# Visual Brainstorming Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give Claude a browser-based visual companion for brainstorming sessions - show mockups, prototypes, and interactive choices alongside terminal conversation.

**Architecture:** Claude writes HTML to a temp file. A local Node.js server watches that file and serves it with an auto-injected helper library. User interactions flow via WebSocket to server stdout, which Claude sees in background task output.

**Tech Stack:** Node.js, Express, ws (WebSocket), chokidar (file watching)

---

## Task 1: Create the Server Foundation

**Files:**
- Create: `lib/brainstorm-server/index.js`
- Create: `lib/brainstorm-server/package.json`

**Step 1: Create package.json**

```json
{
  "name": "brainstorm-server",
  "version": "1.0.0",
  "description": "Visual brainstorming companion server for Claude Code",
  "main": "index.js",
  "dependencies": {
    "chokidar": "^3.5.3",
    "express": "^4.18.2",
    "ws": "^8.14.2"
  }
}
```

**Step 2: Create minimal server that starts**

```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const PORT = process.env.BRAINSTORM_PORT || 3333;
const SCREEN_FILE = process.env.BRAINSTORM_SCREEN || '/tmp/brainstorm/screen.html';
const SCREEN_DIR = path.dirname(SCREEN_FILE);

// Ensure screen directory exists
if (!fs.existsSync(SCREEN_DIR)) {
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
}

// Create default screen if none exists
if (!fs.existsSync(SCREEN_FILE)) {
  fs.writeFileSync(SCREEN_FILE, `<!DOCTYPE html>
<html>
<head>
  <title>Brainstorm Companion</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>Brainstorm Companion</h1>
  <p>Waiting for Claude to push a screen...</p>
</body>
</html>`);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track connected browsers for reload notifications
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));

  ws.on('message', (data) => {
    // User interaction event - write to stdout for Claude
    const event = JSON.parse(data.toString());
    console.log(JSON.stringify({ type: 'user-event', ...event }));
  });
});

// Serve current screen with helper.js injected
app.get('/', (req, res) => {
  let html = fs.readFileSync(SCREEN_FILE, 'utf-8');

  // Inject helper script before </body>
  const helperScript = fs.readFileSync(path.join(__dirname, 'helper.js'), 'utf-8');
  const injection = `<script>\n${helperScript}\n</script>`;

  if (html.includes('</body>')) {
    html = html.replace('</body>', `${injection}\n</body>`);
  } else {
    html += injection;
  }

  res.type('html').send(html);
});

// Watch for screen file changes
chokidar.watch(SCREEN_FILE).on('change', () => {
  console.log(JSON.stringify({ type: 'screen-updated', file: SCREEN_FILE }));
  // Notify all browsers to reload
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reload' }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(JSON.stringify({ type: 'server-started', port: PORT, url: `http://localhost:${PORT}` }));
});
```

**Step 3: Run npm install**

Run: `cd lib/brainstorm-server && npm install`
Expected: Dependencies installed

**Step 4: Test server starts**

Run: `cd lib/brainstorm-server && timeout 3 node index.js || true`
Expected: See JSON with `server-started` and port info

**Step 5: Commit**

```bash
git add lib/brainstorm-server/
git commit -m "feat: add brainstorm server foundation"
```

---
