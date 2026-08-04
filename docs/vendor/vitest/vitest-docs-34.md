---
name: vitest-docs-34
description: "vitest (test runner) — vendor doc 34/48 (vitest.dev)"
type: reference
---

## Custom package conditions are not resolved

If you are using custom conditions in your `package.json` [exports](https://nodejs.org/api/packages.html#package-entry-points) or [subpath imports](https://nodejs.org/api/packages.html#subpath-imports), you may find that Vitest does not respect these conditions by default.

For example, if you have the following in your `package.json`:

```json
{
  "exports": {
    ".": {
      "custom": "./lib/custom.js",
      "import": "./lib/index.js"
    }
  },
  "imports": {
    "#internal": {
      "custom": "./src/internal.js",
      "default": "./lib/internal.js"
    }
  }
}
```

By default, Vitest will only use the `import` and `default` conditions. To make Vitest respect custom conditions, you need to configure [`ssr.resolve.conditions`](https://vite.dev/config/ssr-options#ssr-resolve-conditions) in your Vitest config:

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  ssr: {
    resolve: {
      conditions: ['custom', 'import', 'default'],
    },
  },
})
```

::: tip Why `ssr.resolve.conditions` and not `resolve.conditions`?
Vitest follows Vite's configuration convention:

* [`resolve.conditions`](https://vite.dev/config/shared-options#resolve-conditions) applies to Vite's `client` environment, which corresponds to Vitest's browser mode, jsdom, happy-dom, or custom environments with `viteEnvironment: 'client'`.
* [`ssr.resolve.conditions`](https://vite.dev/config/ssr-options#ssr-resolve-conditions) applies to Vite's `ssr` environment, which corresponds to Vitest's node environment or custom environments with `viteEnvironment: 'ssr'`.

Since Vitest defaults to the `node` environment (which uses `viteEnvironment: 'ssr'`), module resolution uses `ssr.resolve.conditions`. This applies to both package exports and subpath imports.

You can learn more about Vite environments and Vitest environments in [`environment`](/config/environment).
:::

## Segfaults and Native Code Errors

Running [native NodeJS modules](https://nodejs.org/api/addons.html) in `pool: 'threads'` can run into cryptic errors coming from the native code.

* `Segmentation fault (core dumped)`
* `thread '<unnamed>' panicked at 'assertion failed`
* `Abort trap: 6`
* `internal error: entered unreachable code`

In these cases the native module is likely not built to be multi-thread safe. As a workaround, you can switch to `pool: 'forks'` which runs the test cases in multiple `node:child_process` instead of multiple `node:worker_threads`.

::: code-group

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
  },
})
```

```bash [CLI]
vitest --pool=forks
```

:::

## Unhandled Promise Rejection

This error happens when a Promise rejects but no `.catch()` handler or `await` is attached to it before the microtask queue flushes. This behavior comes from JavaScript itself and is not specific to Vitest. Learn more in the [Node.js documentation](https://nodejs.org/api/process.html#event-unhandledrejection).

A common cause is calling an async function without `await`ing it:

```ts
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) {
    throw new Error(`User ${id} not found`) // [!code highlight]
  }
  return res.json()
}

test('fetches user', async () => {
  fetchUser(123) // [!code error]
})
```

Because `fetchUser()` is not `await`ed, its rejection has no handler and Vitest reports:

```
Unhandled Rejection: Error: User 123 not found
```

### Fix

`await` the promise so Vitest can catch the error:

```ts
test('fetches user', async () => {
  await fetchUser(123) // [!code ++]
})
```

If you expect the call to throw, use [`expect().rejects`](/api/expect#rejects):

```ts
test('rejects for missing user', async () => {
  await expect(fetchUser(123)).rejects.toThrow('User 123 not found')
})
```

---

---
url: /guide/comparisons.md
---

# Comparisons with Other Test Runners

## Jest

[Jest](https://jestjs.io/) took over the Testing Framework space by providing out-of-the-box support for most JavaScript projects, a comfortable API (`it` and `expect`), and the full pack of testing features that most setups would require (snapshots, mocks, coverage). We are thankful to the Jest team and community for creating a delightful testing API and pushing forward a lot of the testing patterns that are now a standard in the web ecosystem.

It is possible to use Jest in Vite setups. [@sodatea](https://bsky.app/profile/haoqun.dev) built [vite-jest](https://github.com/sodatea/vite-jest#readme), which aims to provide first-class Vite integration for [Jest](https://jestjs.io/). The last [blockers in Jest](https://github.com/sodatea/vite-jest/blob/main/packages/vite-jest/README.md#vite-jest) have been solved, so this is a valid option for your unit tests.

However, in a world where we have [Vite](https://vitejs.dev) providing support for the most common web tooling (TypeScript, JSX, most popular UI Frameworks), Jest represents a duplication of complexity. If your app is powered by Vite, having two different pipelines to configure and maintain is not justifiable. With Vitest you get to define the configuration for your dev, build and test environments as a single pipeline, sharing the same plugins and the same vite.config.js.

Even if your library is not using Vite (for example, if it is built with esbuild or Rollup), Vitest is an interesting option as it gives you a faster run for your unit tests and a jump in DX thanks to the default watch mode using Vite instant Hot Module Reload (HMR). Vitest offers compatibility with most of the Jest API and ecosystem libraries, so in most projects, it should be a drop-in replacement for Jest.
