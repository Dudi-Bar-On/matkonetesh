---
name: vitest-docs-43
description: "vitest (test runner) — vendor doc 43/48 (vitest.dev)"
type: reference
---

## coverage.enabled

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.enabled`, `--coverage.enabled=false`

Enables coverage collection. Can be overridden using `--coverage` CLI option.

## coverage.include

* **Type:** `string[]`
* **Default:** Files that were imported during test run
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.include=<pattern>`, `--coverage.include=<pattern1> --coverage.include=<pattern2>`

List of files included in coverage as glob patterns. By default only files covered by tests are included.

It is recommended to pass file extensions in the pattern.

See [Including and excluding files from coverage report](/guide/coverage.html#including-and-excluding-files-from-coverage-report) for examples.

## coverage.exclude

* **Type:** `string[]`
* **Default:** : `[]`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.exclude=<path>`, `--coverage.exclude=<path1> --coverage.exclude=<path2>`

List of files excluded from coverage as glob patterns.

See [Including and excluding files from coverage report](/guide/coverage.html#including-and-excluding-files-from-coverage-report) for examples.

## coverage.clean

* **Type:** `boolean`
* **Default:** `true`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.clean`, `--coverage.clean=false`

Clean coverage results before running tests.

## coverage.cleanOnRerun

* **Type:** `boolean`
* **Default:** `true`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.cleanOnRerun`, `--coverage.cleanOnRerun=false`

Clean coverage report on watch rerun. Set to `false` to preserve coverage results from previous run in watch mode.

## coverage.reportsDirectory

* **Type:** `string`
* **Default:** `'./coverage'`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.reportsDirectory=<path>`

::: warning
Vitest will delete this directory before running tests if `coverage.clean` is enabled (default value).
:::

Directory to write coverage report to.

## coverage.reporter

* **Type:** `string | string[] | [string, {}][]`
* **Default:** `['text', 'html', 'clover', 'json']`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.reporter=<reporter>`, `--coverage.reporter=<reporter1> --coverage.reporter=<reporter2>`

Coverage reporters to use. See [istanbul documentation](https://istanbul.js.org/docs/advanced/alternative-reporters/) for detailed list of all reporters. See [`@types/istanbul-reports`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/276d95e4304b3670eaf6e8e5a7ea9e265a14e338/types/istanbul-reports/index.d.ts) for details about reporter specific options.

The reporter has three different types:

* A single reporter: `{ reporter: 'html' }`
* Multiple reporters without options: `{ reporter: ['html', 'json'] }`
* A single or multiple reporters with reporter options:
  ```ts
  {
    reporter: [
      ['lcov', { 'projectRoot': './src' }],
      ['json', { 'file': 'coverage.json' }],
      ['text']
    ]
  }
  ```

You can also pass custom coverage reporters. See [Guide - Custom Coverage Reporter](/guide/coverage#custom-coverage-reporter) for more information.

```ts
  {
    reporter: [
      // Specify reporter using name of the NPM package
      '@vitest/custom-coverage-reporter',
      ['@vitest/custom-coverage-reporter', { someOption: true }],

      // Specify reporter using local path
      '/absolute/path/to/custom-reporter.cjs',
      ['/absolute/path/to/custom-reporter.cjs', { someOption: true }],
    ]
  }
```

You can check your coverage report in Vitest UI: check [Vitest UI Coverage](/guide/coverage#vitest-ui) for more details.

::: tip AI coding agents
When Vitest detects it is running inside an AI coding agent, it automatically adds the `text-summary` reporter and sets `skipFull: true` on the `text` reporter to reduce output and minimize token usage.
:::

## coverage.reportOnFailure {#coverage-reportonfailure}

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.reportOnFailure`, `--coverage.reportOnFailure=false`

Generate coverage report even when tests fail.

## coverage.allowExternal

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.allowExternal`, `--coverage.allowExternal=false`

Collect coverage of files outside the [project `root`](/config/root).

## coverage.excludeAfterRemap

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.excludeAfterRemap`, `--coverage.excludeAfterRemap=false`

Apply exclusions again after coverage has been remapped to original sources.
This is useful when your source files are transpiled and may contain source maps of non-source files.

Use this option when you are seeing files that show up in report even if they match your `coverage.exclude` patterns.

## coverage.skipFull

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.skipFull`, `--coverage.skipFull=false`

Do not show files with 100% statement, branch, and function coverage.

## coverage.thresholds

Options for coverage thresholds.

If a threshold is set to a positive number, it will be interpreted as the minimum percentage of coverage required. For example, setting the lines threshold to `90` means that 90% of lines must be covered.

If a threshold is set to a negative number, it will be treated as the maximum number of uncovered items allowed. For example, setting the lines threshold to `-10` means that no more than 10 lines may be uncovered.

```ts
{
  coverage: {
    thresholds: {
      // Requires 90% function coverage
      functions: 90,

      // Require that no more than 10 lines are uncovered
      lines: -10,
    }
  }
}
```

### coverage.thresholds.lines

* **Type:** `number`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.lines=<number>`

Global threshold for lines.

### coverage.thresholds.functions

* **Type:** `number`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.functions=<number>`

Global threshold for functions.

### coverage.thresholds.branches

* **Type:** `number`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.branches=<number>`

Global threshold for branches.

### coverage.thresholds.statements

* **Type:** `number`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.statements=<number>`

Global threshold for statements.

### coverage.thresholds.perFile

* **Type:** `boolean`
* **Default:** `false`
* **Available for providers:** `'v8' | 'istanbul'`
* **CLI:** `--coverage.thresholds.perFile`, `--coverage.thresholds.perFile=false`

Check thresholds per file.
