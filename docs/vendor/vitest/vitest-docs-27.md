---
name: vitest-docs-27
description: "vitest (test runner) — vendor doc 27/48 (vitest.dev)"
type: reference
---

# browser.trace

* **Type:** `'on' | 'off' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure' | object`
* **CLI:** `--browser.trace=on`, `--browser.trace=retain-on-failure`
* **Default:** `'off'`

Capture a trace of your browser test runs. You can preview traces with [Playwright Trace Viewer](https://trace.playwright.dev/).

This options supports the following values:

* `'on'` - capture trace for all tests. (not recommended as it's performance heavy)
* `'off'` - do not capture traces.
* `'on-first-retry'` - capture trace only when retrying the test for the first time.
* `'on-all-retries'` - capture trace on every retry of the test.
* `'retain-on-failure'` - capture trace only for tests that fail. This will automatically delete traces for tests that pass.
* `object` - an object with the following shape:

```ts
interface TraceOptions {
  mode: 'on' | 'off' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure'
  /**
   * The directory where all traces will be stored. By default, Vitest
   * stores all traces in `__traces__` folder close to the test file.
   */
  tracesDir?: string
  /**
   * Whether to capture screenshots during tracing. Screenshots are used to build a timeline preview.
   * @default true
   */
  screenshots?: boolean
  /**
   * If this option is true tracing will
   * - capture DOM snapshot on every action
   * - record network activity
   * @default true
   */
  snapshots?: boolean
}
```

::: danger WARNING
This option is supported only by the [**playwright**](/config/browser/playwright) provider.
:::

---

---
url: /config/browser/trackunhandlederrors.md
---

# browser.trackUnhandledErrors

* **Type:** `boolean`
* **Default:** `true`

Enables tracking uncaught errors and exceptions so they can be reported by Vitest.

If you need to hide certain errors, it is recommended to use [`onUnhandledError`](/config/onunhandlederror) option instead.

Disabling this will completely remove all Vitest error handlers, which can help debugging with the "Pause on exceptions" checkbox turned on.

---

---
url: /config/browser/ui.md
---

# browser.ui

* **Type:** `boolean`
* **Default:** `!isCI`
* **CLI:** `--browser.ui=false`

Should Vitest UI be injected into the page. By default, injects UI iframe during development.

---

---
url: /config/browser/viewport.md
---

# browser.viewport

* **Type:** `{ width, height }`
* **Default:** `414x896`

Default iframe's viewport.

---

---
url: /config/cache.md
---

# cache&#x20;

* **Type:** `false`
* **CLI:** `--no-cache`, `--cache=false`

Use this option if you want to disable the cache feature. At the moment Vitest stores cache for test results to run the longer and failed tests first.

The cache directory is controlled by the Vite's [`cacheDir`](https://vitejs.dev/config/shared-options.html#cachedir) option:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: 'custom-folder/.vitest'
})
```

You can limit the directory only for Vitest by using `process.env.VITEST`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: process.env.VITEST ? 'custom-folder/.vitest' : undefined
})
```

---

---
url: /config/chaiconfig.md
---

# chaiConfig

* **Type:** `{ includeStack?, showDiff?, truncateThreshold? }`
* **Default:** `{ includeStack: false, showDiff: true, truncateThreshold: 40 }`

Equivalent to [Chai config](https://github.com/chaijs/chai/blob/4.x.x/lib/chai/config.js).

## chaiConfig.includeStack

* **Type:** `boolean`
* **Default:** `false`

Influences whether stack trace is included in Assertion error message. Default of false suppresses stack trace in the error message.

## chaiConfig.showDiff

* **Type:** `boolean`
* **Default:** `true`

Influences whether or not the `showDiff` flag should be included in the thrown AssertionErrors. `false` will always be `false`; `true` will be true when the assertion has requested a diff to be shown.

## chaiConfig.truncateThreshold

* **Type:** `number`
* **Default:** `40`

Sets length threshold for actual and expected values in assertion errors. If this threshold is exceeded, for example for large data structures, the value is replaced with something like `[ Array(3) ]` or `{ Object (prop1, prop2) }`. Set it to `0` if you want to disable truncating altogether.

This config option affects truncating values in `test.each` titles and inside the assertion error message.

---

---
url: /config/clearmocks.md
---

# clearMocks

* **Type:** `boolean`
* **Default:** `false`

Should Vitest automatically call [`vi.clearAllMocks()`](/api/vi#vi-clearallmocks) before each test.

This will clear mock history without affecting mock implementations.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
  },
})
```

::: warning
Be aware that this option may cause problems with async [concurrent tests](/api/test#test-concurrent). If enabled, the completion of one test will clear the mock history for all mocks, including those currently being used by other tests in progress.
:::

---

---
url: /guide/cli.md
---

# Command Line Interface

## Commands

### `vitest`

Start Vitest in the current directory. Will enter the watch mode in development environment and run mode in CI (or non-interactive terminal) automatically.

You can pass an additional argument as the filter of the test files to run. For example:

```bash
vitest foobar
```

Will run only the test file that contains `foobar` in their paths. This filter only checks inclusion and doesn't support regexp or glob patterns (unless your terminal processes it before Vitest receives the filter).

Since Vitest 3, you can also specify the test by filename and line number:

```bash
$ vitest basic/foo.test.ts:10
```

::: warning
Note that Vitest requires the full filename for this feature to work. It can be relative to the current working directory or an absolute file path.

```bash
$ vitest basic/foo.js:10 # ✅
$ vitest ./basic/foo.js:10 # ✅
$ vitest /users/project/basic/foo.js:10 # ✅
$ vitest foo:10 # ❌
$ vitest ./basic/foo:10 # ❌
```

At the moment Vitest also doesn't support ranges:

```bash
$ vitest basic/foo.test.ts:10, basic/foo.test.ts:25 # ✅
$ vitest basic/foo.test.ts:10-25 # ❌
```

:::

### `vitest run`

Perform a single run without watch mode.

### `vitest watch`

Run all test suites but watch for changes and rerun tests when they change. Same as calling `vitest` without an argument. Will fallback to `vitest run` in CI or when stdin is not a TTY (non-interactive environment).

### `vitest dev`

Alias to `vitest watch`.

### `vitest related`

Run only tests that cover a list of source files. Works with static imports (e.g., `import('./index.js')` or `import index from './index.js`), but not the dynamic ones (e.g., `import(filepath)`). All files should be relative to root folder.

Useful to run with [`lint-staged`](https://github.com/okonet/lint-staged) or with your CI setup.

```bash
vitest related /src/index.ts /src/hello-world.js
```

::: tip
Don't forget that Vitest runs with enabled watch mode by default. If you are using tools like `lint-staged`, you  should also pass `--run` option, so that command can exit normally.

```js [.lintstagedrc.js]
export default {
  '*.{js,ts}': 'vitest related --run',
}
```

:::

### `vitest bench`

Run only [benchmark](/guide/features.html#benchmarking) tests, which compare performance results.
