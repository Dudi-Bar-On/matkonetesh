---
name: vitest-docs-19
description: "vitest (test runner) — vendor doc 19/48 (vitest.dev)"
type: reference
---

# attachmentsDir

* **Type:** `string`
* **Default:** `'.vitest-attachments'`

Directory path for storing attachments created by [`context.annotate`](/guide/test-context#annotate) relative to the project root.

---

---
url: /config/bail.md
---

# bail

* **Type:** `number`
* **Default:** `0`
* **CLI:** `--bail=<value>`

Stop test execution when given number of tests have failed.

By default Vitest will run all of your test cases even if some of them fail. This may not be desired for CI builds where you are only interested in 100% successful builds and would like to stop test execution as early as possible when test failures occur. The `bail` option can be used to speed up CI runs by preventing it from running more tests when failures have occurred.

---

---
url: /config/benchmark.md
---

# benchmark  {#benchmark}

* **Type:** `{ include?, exclude?, ... }`

Options used when running `vitest bench`.

## benchmark.include

* **Type:** `string[]`
* **Default:** `['**/*.{bench,benchmark}.?(c|m)[jt]s?(x)']`

Include globs for benchmark test files

## benchmark.exclude

* **Type:** `string[]`
* **Default:** `['node_modules', 'dist', '.idea', '.git', '.cache']`

Exclude globs for benchmark test files

## benchmark.includeSource

* **Type:** `string[]`
* **Default:** `[]`

Include globs for in-source benchmark test files. This option is similar to [`includeSource`](/config/include-source).

When defined, Vitest will run all matched files with `import.meta.vitest` inside.

## benchmark.reporters

* **Type:** `Arrayable<BenchmarkBuiltinReporters | Reporter>`
* **Default:** `'default'`

Custom reporter for output. Can contain one or more built-in report names, reporter instances, and/or paths to custom reporters.

## benchmark.outputFile

Deprecated in favor of `benchmark.outputJson`.

## benchmark.outputJson {#benchmark-outputJson}

* **Type:** `string | undefined`
* **Default:** `undefined`

A file path to store the benchmark result, which can be used for `--compare` option later.

For example:

```sh
# save main branch's result
git checkout main
vitest bench --outputJson main.json

# change a branch and compare against main
git checkout feature
vitest bench --compare main.json
```

## benchmark.compare {#benchmark-compare}

* **Type:** `string | undefined`
* **Default:** `undefined`

A file path to a previous benchmark result to compare against current runs.

---

---
url: /guide/browser.md
---

# Browser Mode {#browser-mode}

This page provides information about the browser mode feature in the Vitest API, which allows you to run your tests in the browser natively, providing access to browser globals like window and document.

::: tip
If you are looking for documentation for `expect`, `vi` or any general API like test projects or type testing, refer to the ["Getting Started" guide](/guide/).
:::

## Installation

For easier setup, you can use `vitest init browser` command to install required dependencies and create browser configuration.

::: code-group

```bash [npm]
npx vitest init browser
```

```bash [yarn]
yarn exec vitest init browser
```

```bash [pnpm]
pnpx vitest init browser
```

```bash [bun]
bunx vitest init browser
```

:::

### Manual Installation

You can also install packages manually. Vitest always requires a provider to be defined. You can chose either [`preview`](/config/browser/preview), [`playwright`](/config/browser/playwright) or [`webdriverio`](/config/browser/webdriverio).

If you want to just preview how your tests look, you can use the `preview` provider:

::: code-group

```bash [npm]
npm install -D vitest @vitest/browser-preview
```

```bash [yarn]
yarn add -D vitest @vitest/browser-preview
```

```bash [pnpm]
pnpm add -D vitest @vitest/browser-preview
```

```bash [bun]
bun add -D vitest @vitest/browser-preview
```

:::

::: warning
However, to run tests in CI you need to install either [`playwright`](https://npmx.dev/package/playwright) or [`webdriverio`](https://npmx.dev/package/webdriverio). We also recommend switching to either one of them for testing locally instead of using the default `preview` provider since it relies on simulating events instead of using Chrome DevTools Protocol.

If you don't already use one of these tools, we recommend starting with Playwright because it supports parallel execution, which makes your tests run faster.

::: tabs key:provider
\== Playwright
[Playwright](https://npmx.dev/package/playwright) is a framework for Web Testing and Automation.

::: code-group

```bash [npm]
npm install -D vitest @vitest/browser-playwright
```

```bash [yarn]
yarn add -D vitest @vitest/browser-playwright
```

```bash [pnpm]
pnpm add -D vitest @vitest/browser-playwright
```

```bash [bun]
bun add -D vitest @vitest/browser-playwright
```

\== WebdriverIO

[WebdriverIO](https://npmx.dev/package/webdriverio) allows you to run tests locally using the WebDriver protocol.

::: code-group

```bash [npm]
npm install -D vitest @vitest/browser-webdriverio
```

```bash [yarn]
yarn add -D vitest @vitest/browser-webdriverio
```

```bash [pnpm]
pnpm add -D vitest @vitest/browser-webdriverio
```

```bash [bun]
bun add -D vitest @vitest/browser-webdriverio
```

:::
