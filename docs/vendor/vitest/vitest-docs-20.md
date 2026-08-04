---
name: vitest-docs-20
description: "vitest (test runner) — vendor doc 20/48 (vitest.dev)"
type: reference
---

## Configuration

To activate browser mode in your Vitest configuration, set the `browser.enabled` field to `true` in your Vitest configuration file. Here is an example configuration using the browser field:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      enabled: true,
      // at least one instance is required
      instances: [
        { browser: 'chromium' },
      ],
    },
  }
})
```

::: info
Vitest assigns port `63315` to avoid conflicts with the development server, allowing you to run both in parallel. You can change that with the [`browser.api`](/config/browser/api) option.

The CLI does not print the Vite server URL automatically. You can press "b" to print the URL when running in watch mode.
:::

If you have not used Vite before, make sure you have your framework's plugin installed and specified in the config. Some frameworks might require extra configuration to work - check their Vite related documentation to be sure.

::: code-group

```ts [react]
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    }
  }
})
```

```ts [vue]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    }
  }
})
```

```ts [svelte]
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [svelte()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    }
  }
})
```

```ts [solid]
import { defineConfig } from 'vitest/config'
import solidPlugin from 'vite-plugin-solid'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    }
  }
})
```

```ts [marko]
import { defineConfig } from 'vitest/config'
import marko from '@marko/vite'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [marko()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    }
  }
})
```

```ts [qwik]
import { defineConfig } from 'vitest/config'
import { qwikVite } from '@builder.io/qwik/optimizer'
import { playwright } from '@vitest/browser-playwright'

// optional, run the tests in SSR mode
import { testSSR } from 'vitest-browser-qwik/ssr-plugin'

export default defineConfig({
  plugins: [testSSR(), qwikVite()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }]
    },
  },
})
```

:::

If you need to run some tests using Node-based runner, you can define a [`projects`](/guide/projects) option with separate configurations for different testing strategies:

{#projects-config}

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // an example of file based convention,
          // you don't have to follow it
          include: [
            'tests/unit/**/*.{test,spec}.ts',
            'tests/**/*.unit.{test,spec}.ts',
          ],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          // an example of file based convention,
          // you don't have to follow it
          include: [
            'tests/browser/**/*.{test,spec}.ts',
            'tests/**/*.browser.{test,spec}.ts',
          ],
          name: 'browser',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
    ],
  },
})
```

## Browser Option Types

The browser option in Vitest depends on the provider. Vitest will fail, if you pass `--browser` and don't specify its name in the config file. Available options:

* `webdriverio` supports these browsers:
  * `firefox`
  * `chrome`
  * `edge`
  * `safari`
* `playwright` supports these browsers:
  * `firefox`
  * `webkit`
  * `chromium`

## Browser Compatibility

Vitest uses [Vite dev server](https://vitejs.dev/guide/#browser-support) to run your tests, so we only support features specified in the [`esbuild.target`](https://vitejs.dev/config/shared-options.html#esbuild) option (`esnext` by default).

By default, Vite targets browsers which support the native [ES Modules](https://caniuse.com/es6-module), native [ESM dynamic import](https://caniuse.com/es6-module-dynamic-import), and [`import.meta`](https://caniuse.com/mdn-javascript_operators_import_meta). On top of that, we utilize [`BroadcastChannel`](https://caniuse.com/?search=BroadcastChannel) to communicate between iframes:

* Chrome >=87
* Firefox >=78
* Safari >=15.4
* Edge >=88

## Running Tests

When you specify a browser name in the browser option, Vitest will try to run the specified browser using `preview` by default, and then run the tests there. If you don't want to use `preview`, you can configure the custom browser provider by using `browser.provider` option.

To specify a browser using the CLI, use the `--browser` flag followed by the browser name, like this:

```sh
npx vitest --browser=chromium
```

Or you can provide browser options to CLI with dot notation:

```sh
npx vitest --browser.headless
```

::: warning
Since Vitest 3.2, if you don't have the `browser` option in your config but specify the `--browser` flag, Vitest will fail because it can't assume that config is meant for the browser and not Node.js tests.
:::

By default, Vitest will automatically open the browser UI for development. Your tests will run inside an iframe in the center. You can configure the viewport by selecting the preferred dimensions, calling `page.viewport` inside the test, or setting default values in [the config](/config/browser/viewport).
