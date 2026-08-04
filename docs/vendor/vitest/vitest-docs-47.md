---
name: vitest-docs-47
description: "vitest (test runner) — vendor doc 47/48 (vitest.dev)"
type: reference
---

## Coverage in Agent Environments

When Vitest detects it is running inside an AI coding agent, it automatically adjusts the default `text` reporter to reduce output and minimize token usage:

* `skipFull: true` is set on the `text` reporter, so files with 100% coverage are omitted from the terminal output.
* The [`text-summary`](/config/coverage#coverage-reporter) reporter is added automatically, so the agent always sees a concise totals table even when `skipFull` hides all individual files.

These adjustments only apply when the `text` reporter is already part of the active reporter list (it is included in the default). Explicitly configured reporters are never removed.

---

---
url: /config/css.md
---

# css

* **Type:** `boolean | { include?, exclude?, modules? }`

Configure if CSS should be processed. When excluded, CSS files will be replaced with empty strings to bypass the subsequent processing. CSS Modules will return a proxy to not affect runtime.

::: warning
This option is not applied to [browser tests](/guide/browser/).
:::

## css.include

* **Type:** `RegExp | RegExp[]`
* **Default:** `[]`

RegExp pattern for files that should return actual CSS and will be processed by Vite pipeline.

:::tip
To process all CSS files, use `/.+/`.
:::

## css.exclude

* **Type:** `RegExp | RegExp[]`
* **Default:** `[]`

RegExp pattern for files that will return an empty CSS file.

## css.modules

* **Type:** `{ classNameStrategy? }`
* **Default:** `{}`

### css.modules.classNameStrategy

* **Type:** `'stable' | 'scoped' | 'non-scoped'`
* **Default:** `'stable'`

If you decide to process CSS files, you can configure if class names inside CSS modules should be scoped. You can choose one of the options:

* `stable`: class names will be generated as `_${name}_${hashedFilename}`, which means that generated class will stay the same, if CSS content is changed, but will change, if the name of the file is modified, or file is moved to another folder. This setting is useful, if you use snapshot feature.
* `scoped`: class names will be generated as usual, respecting `css.modules.generateScopedName` method, if you have one and CSS processing is enabled. By default, filename will be generated as `_${name}_${hash}`, where hash includes filename and content of the file.
* `non-scoped`: class names will not be hashed.

::: warning
By default, Vitest exports a proxy, bypassing CSS Modules processing. If you rely on CSS properties on your classes, you have to enable CSS processing using `include` option.
:::

---

---
url: /guide/advanced/pool.md
---
# Custom Pool advanced {#custom-pool}

::: warning
This is an advanced, experimental and very low-level API. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.
:::

Vitest runs tests in a pool. By default, there are several pool runners:

* `threads` to run tests using `node:worker_threads` (isolation is provided with a new worker context)
* `forks` to run tests using `node:child_process` (isolation is provided with a new `child_process.fork` process)
* `vmThreads` to run tests using `node:worker_threads` (but isolation is provided with `vm` module instead of a new worker context)
* `browser` to run tests using browser providers
* `typescript` to run typechecking on tests

::: tip
See [`vitest-pool-example`](https://npmx.dev/package/vitest-pool-example) for example of a custom pool runner implementation.
:::

## Usage

You can provide your own pool runner by a function that returns `PoolRunnerInitializer`.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import customPool from './my-custom-pool.ts'

export default defineConfig({
  test: {
    // will run every file with a custom pool by default
    pool: customPool({
      customProperty: true,
    })
  },
})
```

If you need to run tests in different pools, use the [`projects`](/guide/projects) feature:

```ts [vitest.config.ts]
import customPool from './my-custom-pool.ts'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          pool: 'threads',
        },
      },
      {
        extends: true,
        test: {
          pool: customPool({
            customProperty: true,
          })
        }
      }
    ],
  },
})
```

## API

The `pool` option accepts a `PoolRunnerInitializer` that can be used for custom pool runners. The `name` property should indicate name of the custom pool runner. It should be identical with your worker's `name` property.

```ts [my-custom-pool.ts]
import type { PoolRunnerInitializer } from 'vitest/node'

export function customPool(customOptions: CustomOptions): PoolRunnerInitializer {
  return {
    name: 'custom-pool',
    createPoolWorker: options => new CustomPoolWorker(options, customOptions),
  }
}
```

In your `CustomPoolWorker` you need to define all required methods:

```ts [my-custom-pool.ts]
import type { PoolOptions, PoolWorker, WorkerRequest } from 'vitest/node'

class CustomPoolWorker implements PoolWorker {
  name = 'custom-pool'
  private customOptions: CustomOptions

  constructor(options: PoolOptions, customOptions: CustomOptions) {
    this.customOptions = customOptions
  }

  send(message: WorkerRequest): void {
    // Provide way to send your worker a message
  }

  on(event: string, callback: (arg: any) => void): void {
    // Provide way to listen to your workers events, e.g. message, error, exit
  }

  off(event: string, callback: (arg: any) => void): void {
    // Provide way to unsubscribe `on` listeners
  }

  async start() {
    // do something when the worker is started
  }

  async stop() {
    // cleanup the state
  }

  deserialize(data) {
    return data
  }
}
```

Your `CustomPoolRunner` will be controlling how your custom test runner worker life cycles and communication channel works. For example, your `CustomPoolRunner` could launch a `node:worker_threads` `Worker`, and provide communication via `Worker.postMessage` and `parentPort`.

In your worker file, you can import helper utilities from `vitest/worker`:

```ts [my-worker.ts]
import { init, runBaseTests, setupEnvironment } from 'vitest/worker'

init({
  post: (response) => {
    // Provide way to send this message to CustomPoolRunner's onWorker as message event
  },
  on: (callback) => {
    // Provide a way to listen CustomPoolRunner's "postMessage" calls
  },
  off: (callback) => {
    // Optional, provide a way to remove listeners added by "on" calls
  },
  teardown: () => {
    // Optional, provide a way to teardown worker, e.g. unsubscribe all the `on` listeners
  },
  serialize: (value) => {
    // Optional, provide custom serializer for `post` calls
  },
  deserialize: (value) => {
    // Optional, provide custom deserializer for `on` callbacks
  },
  runTests: (state, traces) => runBaseTests('run', state, traces),
  collectTests: (state, traces) => runBaseTests('collect', state, traces),
  setup: setupEnvironment,
})
```

---

---
url: /config/dangerouslyignoreunhandlederrors.md
---
