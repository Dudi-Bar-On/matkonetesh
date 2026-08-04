---
name: vitest-docs-40
description: "vitest (test runner) — vendor doc 40/48 (vitest.dev)"
type: reference
---

## `persistentContext` 4.1.0 {#persistentcontext}

* **Type:** `boolean | string`
* **Default:** `false`

When enabled, Vitest uses Playwright's [persistent context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context) instead of a regular browser context. This allows browser state (cookies, localStorage, DevTools settings, etc.) to persist between test runs.

::: warning
This option is ignored when running tests in parallel (e.g. when headless with [`fileParallelism`](/config/fileparallelism) enabled) since persistent context cannot be shared across parallel sessions.
:::

* When set to `true`, the user data is stored in `./node_modules/.cache/vitest-playwright-user-data`
* When set to a string, the value is used as the path to the user data directory

```ts [vitest.config.js]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: playwright({
        persistentContext: true,
        // or specify a custom directory:
        // persistentContext: './my-browser-data',
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

---

---
url: /config/browser/preview.md
---
# Configuring Preview

::: warning
The `preview` provider's main functionality is to show tests in a real browser environment. However, it does not support advanced browser automation features like multiple browser instances or headless mode. For more complex scenarios, consider using [Playwright](/config/browser/playwright) or [WebdriverIO](/config/browser/webdriverio).
:::

To see your tests running in a real browser, you need to install the [`@vitest/browser-preview`](https://npmx.dev/package/@vitest/browser-preview) npm package and specify its `preview` export in the `test.browser.provider` property of your config:

```ts [vitest.config.js]
import { preview } from '@vitest/browser-preview'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: preview(),
      instances: [{ browser: 'chromium' }]
    },
  },
})
```

This will open a new browser window using your default browser to run the tests. You can configure which browser to use by setting the `browser` property in the `instances` array. Vitest will try to open that browser automatically, but it might not work in some environments. In that case, you can manually open the provided URL in your desired browser.

## Differences with Other Providers

The preview provider has some limitations compared to other providers like [Playwright](/config/browser/playwright) or [WebdriverIO](/config/browser/webdriverio):

* It does not support headless mode; the browser window will always be visible.
* It does not support multiple instances of the same browser; each instance must use a different browser.
* It does not support advanced browser capabilities or options; you can only specify the browser name.
* It does not support CDP (Chrome DevTools Protocol) commands or other low-level browser interactions. Unlike Playwright or WebdriverIO, the [`userEvent`](/api/browser/interactivity) API is just re-exported from [`@testing-library/user-event`](https://npmx.dev/package/@testing-library/user-event) and does not have any special integration with the browser.

---

---
url: /config.md
---

# Configuring Vitest

If you are using Vite and have a `vite.config` file, Vitest will read it to match with the plugins and setup as your Vite app. If you want to have a different configuration for testing or your main app doesn't rely on Vite specifically, you could either:

* Create `vitest.config.ts`, which will have the higher priority and will **override** the configuration from `vite.config.ts` (Vitest supports all conventional JS and TS extensions, but doesn't support `json`) - it means all options in your `vite.config` will be **ignored**
* Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
* Use `process.env.VITEST` or `mode` property on `defineConfig` (will be set to `test`/`benchmark` if not overridden with `--mode`) to conditionally apply different configuration in `vite.config.ts`. Note that like any other environment variable, `VITEST` is also exposed on `import.meta.env` in your tests

To configure `vitest` itself, add `test` property in your Vite config. You'll also need to add a reference to Vitest types using a [triple slash command](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) at the top of your config file, if you are importing `defineConfig` from `vite` itself.

If you are not using `vite`, add `defineConfig` imported from `vitest/config` to your config file:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ... Specify options here.
  },
})
```

If you have a `vite` config already, you can add `/// <reference types="vitest/config" />` to include the `test` types:

```js [vite.config.js]
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ... Specify options here.
  },
})
```

You can retrieve Vitest's default options to expand them if needed:

```js [vitest.config.js]
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'packages/template/*'],
  },
})
```

When using a separate `vitest.config.js`, you can also extend Vite's options from another config file if needed:

```js [vitest.config.js]
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    exclude: ['packages/template/*'],
  },
}))
```

If your Vite config is defined as a function, you can define the config like this:

```js [vitest.config.js]
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(configEnv => mergeConfig(
  viteConfig(configEnv),
  defineConfig({
    test: {
      exclude: ['packages/template/*'],
    },
  })
))
```

Since Vitest uses Vite config, you can also use any configuration option from [Vite](https://vitejs.dev/config/). For example, `define` to define global variables, or `resolve.alias` to define aliases - these options should be defined on the top level, *not* within a `test` property.

## Automatic Dependency Installation

Vitest will prompt you to install certain dependencies if they are not already installed. You can disable this behavior by setting the `VITEST_SKIP_INSTALL_CHECKS=1` environment variable.

## Config Options

Configuration options that are not supported inside a [project](/guide/projects) config have  icon next to them. This means they can only be set in the root Vitest config.

---

---
url: /config/browser/webdriverio.md
---
