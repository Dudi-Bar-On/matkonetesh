---
name: vitest-docs-01
description: "vitest (test runner) — vendor doc 01/48 (vitest.dev)"
type: reference
---

<!-- source: https://vitest.dev/llms-full.txt -->

---
url: /guide/advanced.md
---

# Getting Started advanced {#getting-started}

::: warning
This guide lists advanced APIs to run tests via a Node.js script. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.
:::

You can import any method from the `vitest/node` entry-point.

## startVitest

```ts
function startVitest(
  mode: VitestRunMode,
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest>
```

You can start running Vitest tests using its Node API:

```js
import { startVitest } from 'vitest/node'

const vitest = await startVitest('test')

await vitest.close()
```

`startVitest` function returns [`Vitest`](/api/advanced/vitest) instance if tests can be started.

If watch mode is not enabled, Vitest will call `close` method automatically.

If watch mode is enabled and the terminal supports TTY, Vitest will register console shortcuts.

You can pass down a list of filters as a second argument. Vitest will run only tests that contain at least one of the passed-down strings in their file path.

Additionally, you can use the third argument to pass in CLI arguments, which will override any test config options. Alternatively, you can pass in the complete Vite config as the fourth argument, which will take precedence over any other user-defined options.

After running the tests, you can get the results from the [`state.getTestModules`](/api/advanced/test-module) API:

```ts
import type { TestModule } from 'vitest/node'

const vitest = await startVitest('test')

console.log(vitest.state.getTestModules()) // [TestModule]
```

::: tip
The ["Running Tests"](/guide/advanced/tests#startvitest) guide has a usage example.
:::

## createVitest

```ts
function createVitest(
  mode: VitestRunMode,
  options: CliOptions,
  viteOverrides: ViteUserConfig = {},
  vitestOptions: VitestOptions = {},
): Promise<Vitest>
```

You can create Vitest instance by using `createVitest` function. It returns the same [`Vitest`](/api/advanced/vitest) instance as `startVitest`, but it doesn't start tests and doesn't validate installed packages.

```js
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test', {
  watch: false,
})
```

::: tip
The ["Running Tests"](/guide/advanced/tests#createvitest) guide has a usage example.
:::

## resolveConfig

```ts
function resolveConfig(
  options: UserConfig = {},
  viteOverrides: ViteUserConfig = {},
): Promise<{
  vitestConfig: ResolvedConfig
  viteConfig: ResolvedViteConfig
}>
```

This method resolves the config with custom parameters. If no parameters are given, the `root` will be `process.cwd()`.

```ts
import { resolveConfig } from 'vitest/node'

// vitestConfig only has resolved "test" properties
const { vitestConfig, viteConfig } = await resolveConfig({
  mode: 'custom',
  configFile: false,
  resolve: {
    conditions: ['custom']
  },
  test: {
    setupFiles: ['/my-setup-file.js'],
    pool: 'threads',
  },
})
```

::: info
Due to how Vite's `createServer` works, Vitest has to resolve the config during the plugin's `configResolve` hook. Therefore, this method is not actually used internally and is exposed exclusively as a public API.

If you pass down the config to the `startVitest` or `createVitest` APIs, Vitest will still resolve the config again.
:::

::: warning
The `resolveConfig` doesn't resolve `projects`. To resolve projects configs, Vitest needs an established Vite server.

Also note that `viteConfig.test` will not be fully resolved. If you need Vitest config, use `vitestConfig` instead.
:::

## parseCLI

```ts
function parseCLI(argv: string | string[], config: CliParseOptions = {}): {
  filter: string[]
  options: CliOptions
}
```

You can use this method to parse CLI arguments. It accepts a string (where arguments are split by a single space) or a strings array of CLI arguments in the same format that Vitest CLI uses. It returns a filter and `options` that you can later pass down to `createVitest` or `startVitest` methods.

```ts
import { parseCLI } from 'vitest/node'

const result = parseCLI('vitest ./files.ts --coverage --browser=chrome')

result.options
// {
//   coverage: { enabled: true },
//   browser: { name: 'chrome', enabled: true }
// }

result.filter
// ['./files.ts']
```

---

---
url: /config/alias.md
---

# alias

* **Type:** `Record<string, string> | Array<{ find: string | RegExp, replacement: string, customResolver?: ResolverFunction | ResolverObject }>`

Define custom aliases when running inside tests. They will be merged with aliases from `resolve.alias`.

::: warning
Vitest uses Vite SSR primitives to run tests which has [certain pitfalls](https://vitejs.dev/guide/ssr.html#ssr-externals).

1. Aliases affect only modules imported directly with an `import` keyword by an [inlined](/config/server#server-deps-inline) module (all source code is inlined by default).
2. Vitest does not support aliasing `require` calls.
3. If you are aliasing an external dependency (e.g., `react` -> `preact`), you may want to alias the actual `node_modules` packages instead to make it work for externalized dependencies. Both [Yarn](https://classic.yarnpkg.com/en/docs/cli/add/#toc-yarn-add-alias) and [pnpm](https://pnpm.io/aliases/) support aliasing via the `npm:` prefix.
   :::

---

---
url: /config/allowonly.md
---

# allowOnly

* **Type:** `boolean`
* **Default:** `!process.env.CI`
* **CLI:** `--allowOnly`, `--allowOnly=false`

By default, Vitest does not permit tests marked with the [`only`](/api/test#test-only) flag in Continuous Integration (CI) environments. Conversely, in local development environments, Vitest allows these tests to run.

::: info
Vitest uses [`std-env`](https://npmx.dev/package/std-env) package to detect the environment.
:::

You can customize this behavior by explicitly setting the `allowOnly` option to either `true` or `false`.

::: code-group

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    allowOnly: true,
  },
})
```

```bash [CLI]
vitest --allowOnly
```

:::

When enabled, Vitest will not fail the test suite if tests marked with [`only`](/api/test#test-only) are detected, including in CI environments.

When disabled, Vitest will fail the test suite if tests marked with [`only`](/api/test#test-only) are detected, including in local development environments.

---

---
url: /config/api.md
---

# api

* **Type:** `boolean | number | object`
* **Default:** `false`
* **CLI:** `--api`, `--api.port`, `--api.host`, `--api.strictPort`

Listen to port and serve API for [the UI](/guide/ui) or [browser server](/guide/browser/). When set to `true`, the default port is `51204`.
