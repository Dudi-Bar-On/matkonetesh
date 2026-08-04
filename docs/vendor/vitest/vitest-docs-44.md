---
name: vitest-docs-44
description: "vitest (test runner) — vendor doc 44/48 (vitest.dev)"
type: reference
---

### coverage.thresholds.autoUpdate

* **Type:** `boolean | function`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.autoUpdate=<boolean>`

Update all threshold values `lines`, `functions`, `branches` and `statements` to configuration file when current coverage is better than the configured thresholds.
This option helps to maintain thresholds when coverage is improved.

You can also pass a function for formatting the updated threshold values:

```ts
{
  coverage: {
    thresholds: {
      // Update thresholds without decimals
      autoUpdate: (newThreshold) => Math.floor(newThreshold),

      // 95.85 -> 95
      functions: 95,
    }
  }
}
```

### coverage.thresholds.100

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.100`, `--coverage.thresholds.100=false`

Sets global thresholds to 100.
Shortcut for `--coverage.thresholds.lines 100 --coverage.thresholds.functions 100 --coverage.thresholds.branches 100 --coverage.thresholds.statements 100`.

### coverage.thresholds\[glob-pattern]

* **Type:** `{ statements?: number functions?: number branches?: number lines?: number }`
* **Default:** `undefined`
* **Available for providers:** `'v8' | 'istanbul'`

Sets thresholds for files matching the glob pattern.

::: tip NOTE
Vitest counts all files, including those covered by glob-patterns, into the global coverage thresholds.
This is different from Jest behavior.
:::

```ts
{
  coverage: {
    thresholds: {
      // Thresholds for all files
      functions: 95,
      branches: 70,

      // Thresholds for matching glob pattern
      'src/utils/**.ts': {
        statements: 95,
        functions: 90,
        branches: 85,
        lines: 80,
      },

      // Files matching this pattern will only have lines thresholds set.
      // Global thresholds are not inherited.
      '**/math.ts': {
        lines: 100,
      }
    }
  }
}
```

### coverage.thresholds\[glob-pattern].100

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`

Sets thresholds to 100 for files matching the glob pattern.

```ts
{
  coverage: {
    thresholds: {
      // Thresholds for all files
      functions: 95,
      branches: 70,

      // Thresholds for matching glob pattern
      'src/utils/**.ts': { 100: true },
      '**/math.ts': { 100: true }
    }
  }
}
```

## coverage.ignoreClassMethods

* **Type:** `string[]`
* **Default:** `[]`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.ignoreClassMethods=<method>`

Set to array of class method names to ignore for coverage.
See [istanbul documentation](https://github.com/istanbuljs/nyc#ignoring-methods) for more information.

## coverage.watermarks

* **Type:**

```ts
{
  statements?: [number, number],
  functions?: [number, number],
  branches?: [number, number],
  lines?: [number, number]
}
```

* **Default:**

```ts
{
  statements: [50, 80],
  functions: [50, 80],
  branches: [50, 80],
  lines: [50, 80]
}
```

* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.watermarks.statements=50,80`, `--coverage.watermarks.branches=50,80`

Watermarks for statements, lines, branches and functions. See [istanbul documentation](https://github.com/istanbuljs/nyc#high-and-low-watermarks) for more information.

## coverage.processingConcurrency

* **Type:** `boolean`
* **Default:** `Math.min(20, os.availableParallelism?.() ?? os.cpus().length)`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.processingConcurrency=<number>`

Concurrency limit used when processing the coverage results.

## coverage.instrumenter 4.1.5 {#coverage-instrumenter}

* **Type:** `(options: InstrumenterOptions) => CoverageInstrumenter`
* **Available for providers:** `'istanbul'`

Factory for a custom instrumenter to use in place of the default `istanbul-lib-instrument`. Vitest calls the factory once during initialization and reuses the returned instrumenter for every file. The rest of the Istanbul pipeline (collection, merging, reporting) is unchanged.

The factory receives an `InstrumenterOptions` object with Vitest's runtime coverage settings, and must return an object implementing the `CoverageInstrumenter` interface. Both types are exported from `vitest/node`.

```ts
interface InstrumenterOptions {
  coverageVariable: string
  coverageGlobalScope: string
  coverageGlobalScopeFunc: boolean
  ignoreClassMethods: string[]
}

interface CoverageInstrumenter {
  instrumentSync: (code: string, filename: string, inputSourceMap?: any) => string
  lastSourceMap: () => any
  lastFileCoverage: () => any
}
```

```ts
import { defineConfig } from 'vitest/config'
import { createInstrumenter } from '@vitest/some-custom-instrumenter'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      instrumenter: options => createInstrumenter(options),
    }
  }
})
```

## coverage.customProviderModule

* **Type:** `string`
* **Available for providers:** `'custom'`
* **CLI:** `--coverage.customProviderModule=<path or module name>`

Specifies the module name or path for the custom coverage provider module. See [Guide - Custom Coverage Provider](/guide/coverage#custom-coverage-provider) for more information.

## coverage.htmlDir

* **Type:** `string`
* **Default:** Automatically inferred from `html`, `html-spa`, or `lcov` coverage reporters
* **CLI:** `--coverage.htmlDir=<path>`

Directory of HTML coverage output to be served in [Vitest UI](/guide/ui) and [HTML reporter](/guide/reporters.html#html-reporter).

This is automatically configured when using builtin coverage reporters that produce HTML output (`html`, `html-spa`, and `lcov`). Use this option to override with a custom coverage reporting location when using custom coverage reporters.

Note that setting this option does not change where coverage HTML report is generated. Configure the `coverage.reporter` option to change the directory instead.

## coverage.changed

* **Type:** `boolean | string`
* **Default:** `false` (inherits from `test.changed`)
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.changed`, `--coverage.changed=<commit/branch>`

Collect coverage only for files changed since a specified commit or branch. When set to `true`, it uses staged and unstaged changes.

---

---
url: /guide/coverage.md
---

# Coverage

Vitest supports Native code coverage via [`v8`](https://v8.dev/blog/javascript-code-coverage) and instrumented code coverage via [`istanbul`](https://istanbul.js.org/).

## Coverage Providers

Both `v8` and `istanbul` support are optional. By default, `v8` will be used.

You can select the coverage tool by setting `test.coverage.provider` to `v8` or `istanbul`:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8' // or 'istanbul'
    },
  },
})
```

When you start the Vitest process, it will prompt you to install the corresponding support package automatically.

Or if you prefer to install them manually:

::: code-group

```bash [v8]
npm i -D @vitest/coverage-v8
```

```bash [istanbul]
npm i -D @vitest/coverage-istanbul
```

:::
