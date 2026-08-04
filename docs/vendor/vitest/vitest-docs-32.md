---
name: vitest-docs-32
description: "vitest (test runner) — vendor doc 32/48 (vitest.dev)"
type: reference
---

### clearCache

* **CLI:** `--clearCache`

Delete all Vitest caches, including `experimental.fsModuleCache`, without running any tests. This will reduce the performance in the subsequent test run.

### tagsFilter

* **CLI:** `--tagsFilter <expression>`

Run only tests with the specified tags. You can use logical operators `&&` (and), `||` (or) and `!` (not) to create complex expressions, see [Test Tags](/guide/test-tags#syntax) for more information.

### strictTags

* **CLI:** `--strictTags`
* **Config:** [strictTags](/config/stricttags)

Should Vitest throw an error if test has a tag that is not defined in the config. (default: `true`)

### experimental.fsModuleCache

* **CLI:** `--experimental.fsModuleCache`
* **Config:** [experimental.fsModuleCache](/config/experimental#experimental-fsmodulecache)

Enable caching of modules on the file system between reruns.

### experimental.importDurations.print

* **CLI:** `--experimental.importDurations.print <boolean|on-warn>`
* **Config:** [experimental.importDurations.print](/config/experimental#experimental-importdurations-print)

When to print import breakdown to CLI terminal. Use `true` to always print, `false` to never print, or `on-warn` to print only when imports exceed the warn threshold (default: false).

### experimental.importDurations.limit

* **CLI:** `--experimental.importDurations.limit <number>`
* **Config:** [experimental.importDurations.limit](/config/experimental#experimental-importdurations-limit)

Maximum number of imports to collect and display (default: 0, or 10 if print or UI is enabled).

### experimental.importDurations.failOnDanger

* **CLI:** `--experimental.importDurations.failOnDanger`
* **Config:** [experimental.importDurations.failOnDanger](/config/experimental#experimental-importdurations-failondanger)

Fail the test run if any import exceeds the danger threshold (default: false).

### experimental.importDurations.thresholds.warn

* **CLI:** `--experimental.importDurations.thresholds.warn <number>`
* **Config:** [experimental.importDurations.thresholds.warn](/config/experimental#experimental-importdurations-thresholds-warn)

Warning threshold - imports exceeding this are shown in yellow/orange (default: 100).

### experimental.importDurations.thresholds.danger

* **CLI:** `--experimental.importDurations.thresholds.danger <number>`
* **Config:** [experimental.importDurations.thresholds.danger](/config/experimental#experimental-importdurations-thresholds-danger)

Danger threshold - imports exceeding this are shown in red (default: 500).

### experimental.viteModuleRunner

* **CLI:** `--experimental.viteModuleRunner`
* **Config:** [experimental.viteModuleRunner](/config/experimental#experimental-vitemodulerunner)

Control whether Vitest uses Vite's module runner to run the code or fallback to the native `import`. (default: `true`)

### experimental.nodeLoader

* **CLI:** `--experimental.nodeLoader`
* **Config:** [experimental.nodeLoader](/config/experimental#experimental-nodeloader)

Controls whether Vitest will use Node.js Loader API to process in-source or mocked files. This has no effect if `viteModuleRunner` is enabled. Disabling this can increase performance. (default: `true`)

### experimental.vcsProvider

* **CLI:** `--experimental.vcsProvider <path>`
* **Config:** [experimental.vcsProvider](/config/experimental#experimental-vcsprovider)

Custom provider for detecting changed files. (default: `git`)

### experimental.preParse

* **CLI:** `--experimental.preParse`
* **Config:** [experimental.preParse](/config/experimental#experimental-preparse)

Parse test specifications before running them. This will apply `.only` flag and test name pattern across all files without running them. (default: `false`)

### changed

* **Type:** `boolean | string`
* **Default:** false

Run tests only against changed files. If no value is provided, it will run tests against uncommitted changes (including staged and unstaged).

To run tests against changes made in the last commit, you can use `--changed HEAD~1`. You can also pass commit hash (e.g. `--changed 09a9920`) or branch name (e.g. `--changed origin/develop`).

When used with code coverage the report will contain only the files that were related to the changes.

If paired with the [`forceRerunTriggers`](/config/forcereruntriggers) config option it will run the whole test suite if at least one of the files listed in the `forceRerunTriggers` list changes. By default, changes to the Vitest config file and `package.json` will always rerun the whole suite.

### shard

* **Type:** `string`
* **Default:** disabled

Test suite shard to execute in a format of `<index>`/`<count>`, where

* `count` is a positive integer, count of divided parts
* `index` is a positive integer, index of divided part

This command will divide all tests into `count` equal parts, and will run only those that happen to be in an `index` part. For example, to split your tests suite into three parts, use this:

```sh
vitest run --shard=1/3
vitest run --shard=2/3
vitest run --shard=3/3
```

:::warning
You cannot use this option with `--watch` enabled (enabled in dev by default).
:::

::: tip
If `--reporter=blob` is used without an output file, the default path will include the current shard config to avoid collisions with other Vitest processes.
:::

### merge-reports

* **Type:** `boolean | string`

Merges every blob report located in the specified folder (`.vitest-reports` by default). You can use any reporters with this command (except [`blob`](/guide/reporters#blob-reporter)):

```sh
vitest --merge-reports --reporter=junit
```

---

---
url: /api/browser/commands.md
---

# Commands

Command is a function that invokes another function on the server and passes down the result back to the browser. Vitest exposes several built-in commands you can use in your browser tests.

## Built-in Commands

### Files Handling

You can use the `readFile`, `writeFile`, and `removeFile` APIs to handle files in your browser tests. Since Vitest 3.2, all paths are resolved relative to the [project](/guide/projects) root (which is `process.cwd()`, unless overridden manually). Previously, paths were resolved relative to the test file.

By default, Vitest uses `utf-8` encoding but you can override it with options.

::: tip
This API follows [`server.fs`](https://vitejs.dev/config/server-options.html#server-fs-allow) limitations for security reasons.

If [`browser.api.allowWrite`](/config/browser/api) or [`api.allowWrite`](/config/api#api-allowwrite) are disabled, `writeFile` and `removeFile` functions won't do anything.
:::

```ts
import { server } from 'vitest/browser'

const { readFile, writeFile, removeFile } = server.commands

it('handles files', async () => {
  const file = './test.txt'

  await writeFile(file, 'hello world')
  const content = await readFile(file)

  expect(content).toBe('hello world')

  await removeFile(file)
})
```
