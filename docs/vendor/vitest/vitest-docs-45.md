---
name: vitest-docs-45
description: "vitest (test runner) — vendor doc 45/48 (vitest.dev)"
type: reference
---

## V8 Provider

::: info
The description of V8 coverage below is Vitest specific and does not apply to other test runners.
Since `v3.2.0` Vitest has used [AST based coverage remapping](/blog/vitest-3-2#coverage-v8-ast-aware-remapping) for V8 coverage, which produces identical coverage reports to Istanbul.

This allows users to have the speed of V8 coverage with accuracy of Istanbul coverage.
:::

By default Vitest uses `'v8'` coverage provider.
This provider requires Javascript runtime that's implemented on top of [V8 engine](https://v8.dev/), such as NodeJS, Deno or any Chromium based browsers such as Google Chrome.

Coverage collection is performed during runtime by instructing V8 using [`node:inspector`](https://nodejs.org/api/inspector.html) and [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/) in browsers. User's source files can be executed as-is without any pre-instrumentation steps.

* ✅ Recommended option to use
* ✅ No pre-transpile step. Test files can be executed as-is.
* ✅ Faster execute times than Istanbul.
* ✅ Lower memory usage than Istanbul.
* ✅ Coverage report accuracy is as good as with Istanbul ([since Vitest `v3.2.0`](/blog/vitest-3-2#coverage-v8-ast-aware-remapping)).
* ⚠️ In some cases can be slower than Istanbul, e.g. when loading lots of different modules. V8 does not support limiting coverage collection to specific modules.
* ⚠️ There are some minor limitations set by V8 engine. See [`ast-v8-to-istanbul` | Limitations](https://github.com/AriPerkkio/ast-v8-to-istanbul?tab=readme-ov-file#limitations).
* ❌ Does not work on environments that don't use V8, such as Firefox or Bun. Or on environments that don't expose V8 coverage via profiler, such as Cloudflare Workers.

## Istanbul Provider

[Istanbul code coverage tooling](https://istanbul.js.org/) has existed since 2012 and is very well battle-tested.
This provider works on any Javascript runtime as coverage tracking is done by instrumenting user's source files.

In practice, instrumenting source files means adding additional Javascript in user's files:

```js
// Simplified example of branch and function coverage counters
const coverage = { // [!code ++]
  branches: { 1: [0, 0] }, // [!code ++]
  functions: { 1: 0 }, // [!code ++]
} // [!code ++]

export function getUsername(id) {
  // Function coverage increased when this is invoked  // [!code ++]
  coverage.functions['1']++ // [!code ++]

  if (id == null) {
    // Branch coverage increased when this is invoked  // [!code ++]
    coverage.branches['1'][0]++ // [!code ++]

    throw new Error('User ID is required')
  }
  // Implicit else coverage increased when if-statement condition not met  // [!code ++]
  coverage.branches['1'][1]++ // [!code ++]

  return database.getUser(id)
}

globalThis.__VITEST_COVERAGE__ ||= {} // [!code ++]
globalThis.__VITEST_COVERAGE__[filename] = coverage // [!code ++]
```

* ✅ Works on any Javascript runtime
* ✅ Widely used and battle-tested for over 13 years.
* ✅ In some cases faster than V8. Coverage instrumentation can be limited to specific files, as opposed to V8 where all modules are instrumented.
* ❌ Requires pre-instrumentation step
* ❌ Execution speed is slower than V8 due to instrumentation overhead
* ❌ Instrumentation increases file sizes
* ❌ Memory usage is higher than V8

## Coverage Setup

::: tip
All coverage options are listed in [Coverage Config Reference](/config/coverage).
:::

To test with coverage enabled, you can pass the `--coverage` flag in CLI or set `coverage.enabled` in `vitest.config.ts`:

::: code-group

```json [package.json]
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest run --coverage"
  }
}
```

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      enabled: true
    },
  },
})
```

:::

## Including and Excluding Files from Coverage Report

You can define what files are shown in coverage report by configuring [`coverage.include`](/config/coverage#coverage-include) and [`coverage.exclude`](/config/coverage#coverage-exclude).

By default Vitest will show only files that were imported during test run.
To include uncovered files in the report, you'll need to configure [`coverage.include`](/config/coverage#coverage-include) with a pattern that will pick your source files:

::: code-group

```ts [vitest.config.ts] {6}
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}']
    },
  },
})
```

```sh [Covered Files]
├── src
│   ├── components
│   │   └── counter.tsx   # [!code ++]
│   ├── mock-data
│   │   ├── products.json # [!code error]
│   │   └── users.json    # [!code error]
│   └── utils
│       ├── formatters.ts # [!code ++]
│       ├── time.ts       # [!code ++]
│       └── users.ts      # [!code ++]
├── test
│   └── utils.test.ts     # [!code error]
│
├── package.json          # [!code error]
├── tsup.config.ts        # [!code error]
└── vitest.config.ts      # [!code error]
```

:::

To exclude files that are matching `coverage.include`, you can define an additional [`coverage.exclude`](/config/coverage#coverage-exclude):

::: code-group

```ts [vitest.config.ts] {7}
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/utils/users.ts']
    },
  },
})
```

```sh [Covered Files]
├── src
│   ├── components
│   │   └── counter.tsx   # [!code ++]
│   ├── mock-data
│   │   ├── products.json # [!code error]
│   │   └── users.json    # [!code error]
│   └── utils
│       ├── formatters.ts # [!code ++]
│       ├── time.ts       # [!code ++]
│       └── users.ts      # [!code error]
├── test
│   └── utils.test.ts     # [!code error]
│
├── package.json          # [!code error]
├── tsup.config.ts        # [!code error]
└── vitest.config.ts      # [!code error]
```

:::
