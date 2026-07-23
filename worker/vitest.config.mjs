// worker/vitest.config.mjs
// (.mjs, not .js: worker/package.json has no "type": "module", so Node's
// native loader — used to bootstrap this Vite/Vitest config file itself,
// before any of Vite's own transform pipeline runs — would otherwise try to
// require() this file and fail on the ESM-only pool package.)
//
// Runs worker/index.js's `fetch` handler inside a real `workerd` process via
// @cloudflare/vitest-pool-workers, wired to wrangler.toml so the CODES KV
// binding shape matches production exactly. No `preview_id` is required —
// the pool drives its own isolated, local KV simulation regardless of
// wrangler.toml's `id`/`preview_id` (see
// docs/analysis/program/PRE-3-worker-harness-design.md §3.1).
//
// ── Deviation from the design doc / task brief, stated per their own
// instruction to say why ──
// Both the brief and the design doc (§3.1, §7) describe configuring via
// `defineWorkersConfig` imported from "@cloudflare/vitest-pool-workers/config",
// plus a `fetchMock` (undici MockAgent) exported from "cloudflare:test".
// Neither exists in the installed package. Verified directly against the
// installed package's own `package.json#exports` map and
// `types/cloudflare-test.d.ts` (not assumed): the "./config" export subpath
// and `defineWorkersConfig`/`fetchMock` belong to an older major line of
// @cloudflare/vitest-pool-workers (confirmed present through 0.12.0, whose
// own `dependencies.wrangler` is 4.57.0 and whose `peerDependencies.vitest`
// is "2.0.x - 3.2.x"). The package was rewritten around a `cloudflareTest()`
// Vite-plugin config API starting at 0.13.0 (own `dependencies.wrangler`
// 4.73.0, `peerDependencies.vitest` "^4.1.0") through the latest 0.18.7 (own
// `dependencies.wrangler` 4.113.0 — closest to this repo's installed
// wrangler@4.111.0). The design doc's own §3.1 install command
// ("npm i -D vitest@^4.1.0 ...") already specifies the newer vitest major,
// which is incompatible with the older defineWorkersConfig/fetchMock line
// (peer range "2.0.x - 3.2.x") — no single version satisfies both the doc's
// install command and its API description. This file follows the current,
// installed, source-verified API (`cloudflareTest()` plugin; outbound-fetch
// mocking via `vi.spyOn(globalThis, "fetch")`, confirmed against
// cloudflare/workers-sdk's own fixtures/vitest-pool-workers-examples/
// request-mocking/test/imperative.test.ts) instead of the doc's sketch.
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      // GEMINI_KEY is a real secret in production (`wrangler secret put
      // GEMINI_KEY`, never committed — see worker/wrangler.toml:13-14 and
      // CLAUDE.md "Secrets never enter the repo"). Tests need
      // env.GEMINI_KEY truthy only to get past the `server_misconfigured`
      // guard at worker/index.js:47; this fake value lives only in this
      // test-only in-memory Miniflare binding and is never a real key.
      miniflare: {
        bindings: { GEMINI_KEY: 'test-only-fake-key-not-real' },
      },
    }),
  ],
});
