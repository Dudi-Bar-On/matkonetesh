#!/usr/bin/env node
/**
 * graph-baseline.mjs — the mechanical oracle for the Neo4j → native-service migration.
 *
 * WHY THIS EXISTS. The Docker-exit spec's §2 table was measured by hand and typed into a
 * document. Verifying the migration by reading that hand-made table against another hand-made
 * table after the migration is exactly the failure mode this script exists to remove — a number
 * gets misread precisely at the point where nobody is running a query anymore. So the baseline
 * is a command: run it before, run it after, `diff` the two files.
 *
 * OUTPUT CONTRACT (load-bearing — do not change without updating the migration verification):
 *   - One fact per line, `NAME COUNT`, ASCII space-separated.
 *   - Node-label counts first (sorted by label), then relationship-type counts (sorted by type).
 *   - TOTAL_NODES and TOTAL_RELS are printed last, and are literally `.reduce()` over the same
 *     rows already printed above them — never a second query that could disagree with the lines
 *     it is supposed to summarize.
 *   - Same graph in, same bytes out: no timestamps, no non-deterministic ordering, nothing else
 *     on the line. Two runs against an unchanged graph must be byte-identical (`diff` exits 0).
 *   - Empty results (zero labels or zero relationship types) are a hard failure (exit 1), never a
 *     quietly-empty "baseline" — a query that silently returns nothing must not be mistaken for a
 *     graph that legitimately has nothing in it.
 *
 * CONNECTION. Neo4j's Bolt protocol has no dependency-free client for plain Node, so this talks
 * to the same container over its HTTP transactional endpoint (still present, if deprecated, in
 * this Neo4j version — verified live before writing this) using the platform `fetch`. That keeps
 * the script dependency-free: no `npm install` needed to run a read-only count.
 *
 * Reads infra/.env directly (NEO4J_HTTP_PORT, NEO4J_USER, NEO4J_PASSWORD, optionally
 * NEO4J_DATABASE) rather than the Python config module — this is a standalone Node script and the
 * project's Python knowledge stack is not on the Node module path. The credential is read into
 * memory only for the HTTP Basic-Auth header; it is never logged or printed.
 *
 * Usage:
 *   node scripts/graph-baseline.mjs                # prints the baseline to stdout
 *   node scripts/graph-baseline.mjs --http-port N   # override, for the "fails loudly" proof
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, "infra", ".env");

function parseEnvFile(filePath) {
  const out = {};
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`cannot read ${filePath}: ${err.message}`);
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function parseArgs(argv) {
  const opts = { httpPort: null, database: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--http-port") {
      opts.httpPort = argv[++i];
    } else if (argv[i] === "--database") {
      opts.database = argv[++i];
    }
  }
  return opts;
}

function loadConfig() {
  const env = parseEnvFile(ENV_FILE);
  const cliOpts = parseArgs(process.argv.slice(2));

  const httpPort = cliOpts.httpPort || env.NEO4J_HTTP_PORT;
  const user = env.NEO4J_USER;
  const password = env.NEO4J_PASSWORD;
  const database = cliOpts.database || env.NEO4J_DATABASE || "neo4j";

  const missing = [];
  if (!httpPort) missing.push("NEO4J_HTTP_PORT");
  if (!user) missing.push("NEO4J_USER");
  if (!password) missing.push("NEO4J_PASSWORD");
  if (missing.length) {
    throw new Error(
      `infra/.env is missing: ${missing.join(", ")}. Copy infra/.env.example and fill it in.`
    );
  }

  return { httpPort, user, password, database };
}

async function runCypher(config, statement) {
  const url = `http://127.0.0.1:${config.httpPort}/db/${config.database}/tx/commit`;
  const auth = Buffer.from(`${config.user}:${config.password}`).toString("base64");

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ statements: [{ statement }] }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Wrong port, host down, connection refused — all land here. Never swallowed: this is the
    // "fails loudly when pointed at something that is not the graph" requirement.
    throw new Error(`could not reach Neo4j HTTP endpoint at ${url}: ${err.message}`);
  }

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(
      `Neo4j at ${url} returned a non-JSON response (HTTP ${response.status}): ` +
        bodyText.slice(0, 500)
    );
  }

  if (!response.ok) {
    throw new Error(
      `Neo4j at ${url} returned HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`
    );
  }
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    throw new Error(`Neo4j reported query errors: ${JSON.stringify(body.errors)}`);
  }
  const result = body.results && body.results[0];
  if (!result) {
    throw new Error(`Neo4j response had no result set for statement: ${statement}`);
  }
  return result.data.map((row) => row.row);
}

/** labels(n) is a list; the schema (graph_schema.py) enforces exactly one label per node, but
 * this does not assume that silently — a multi-label node is folded into a stable joined key
 * rather than causing a crash or a silent undercount. */
function labelKey(labels) {
  const sorted = [...labels].sort((a, b) => a.localeCompare(b));
  return sorted.join("+");
}

async function collectCounts(config) {
  const nodeRows = await runCypher(
    config,
    "MATCH (n) RETURN labels(n) AS labels, count(*) AS c"
  );
  const relRows = await runCypher(
    config,
    "MATCH ()-[r]->() RETURN type(r) AS relType, count(*) AS c"
  );

  const nodeCounts = new Map();
  for (const [labels, c] of nodeRows) {
    const key = labelKey(labels);
    nodeCounts.set(key, (nodeCounts.get(key) || 0) + c);
  }

  const relCounts = new Map();
  for (const [relType, c] of relRows) {
    relCounts.set(relType, (relCounts.get(relType) || 0) + c);
  }

  return { nodeCounts, relCounts };
}

function formatBaseline({ nodeCounts, relCounts }) {
  const lines = [];

  if (nodeCounts.size === 0) {
    throw new Error(
      "query returned zero node labels — empty output is treated as a failure, not a clean " +
        "baseline (the query may have failed silently, or pointed at the wrong database)"
    );
  }
  if (relCounts.size === 0) {
    throw new Error(
      "query returned zero relationship types — empty output is treated as a failure, not a " +
        "clean baseline (the query may have failed silently, or pointed at the wrong database)"
    );
  }

  const nodeLabels = [...nodeCounts.keys()].sort((a, b) => a.localeCompare(b));
  const relTypes = [...relCounts.keys()].sort((a, b) => a.localeCompare(b));

  let totalNodes = 0;
  for (const label of nodeLabels) {
    const c = nodeCounts.get(label);
    totalNodes += c;
    lines.push(`${label} ${c}`);
  }

  let totalRels = 0;
  for (const relType of relTypes) {
    const c = relCounts.get(relType);
    totalRels += c;
    lines.push(`${relType} ${c}`);
  }

  lines.push(`TOTAL_NODES ${totalNodes}`);
  lines.push(`TOTAL_RELS ${totalRels}`);

  return lines.join("\n") + "\n";
}

async function main() {
  const config = loadConfig();
  const counts = await collectCounts(config);
  const output = formatBaseline(counts);
  process.stdout.write(output);
}

main().catch((err) => {
  process.stderr.write(`graph-baseline.mjs: FAILED — ${err.message}\n`);
  process.exit(1);
});
