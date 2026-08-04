---
name: vitest-docs-24
description: "vitest (test runner) — vendor doc 24/48 (vitest.dev)"
type: reference
---

## Limitations

### Thread Blocking Dialogs

When using Vitest Browser, it's important to note that thread blocking dialogs like `alert` or `confirm` cannot be used natively. This is because they block the web page, which means Vitest cannot continue communicating with the page, causing the execution to hang.

In such situations, Vitest provides default mocks with default returned values for these APIs. This ensures that if the user accidentally uses synchronous popup web APIs, the execution would not hang. However, it's still recommended for the user to mock these web APIs for a better experience. Read more in [Mocking](/guide/mocking).

### Spying on Module Exports

Browser Mode uses the browser's native ESM support to serve modules. The module namespace object is sealed and can't be reconfigured, unlike in Node.js tests where Vitest can patch the Module Runner. This means you can't call `vi.spyOn` on an imported object:

```ts
import { vi } from 'vitest'
import * as module from './module.js'

vi.spyOn(module, 'method') // ❌ throws an error
```

To bypass this limitation, Vitest supports `{ spy: true }` option in `vi.mock('./module.js')`. This will automatically spy on every export in the module without replacing them with fake ones.

```ts
import { vi } from 'vitest'
import * as module from './module.js'

vi.mock('./module.js', { spy: true })

vi.mocked(module.method).mockImplementation(() => {
  // ...
})
```

However, the only way to mock exported *variables* is to export a method that will change the internal value:

::: code-group

```js [module.js]
export let MODE = 'test'
export function changeMode(newMode) {
  MODE = newMode
}
```

```js [module.test.ts]
import { expect } from 'vitest'
import { changeMode, MODE } from './module.js'

changeMode('production')
expect(MODE).toBe('production')
```

:::

---

---
url: /config/browser/api.md
---

# browser.api

* **Type:** `number | object`
* **Default:** `63315`
* **CLI:** `--browser.api=63315`, `--browser.api.port=1234, --browser.api.host=example.com`

Configure options for Vite server that serves code in the browser. Does not affect [`test.api`](/config/api) option. By default, Vitest assigns port `63315` to avoid conflicts with the development server, allowing you to run both in parallel.

## api.allowWrite 4.1.0 {#api-allowwrite}

* **Type:** `boolean`
* **Default:** `true` if not exposed to the network, `false` otherwise

Vitest saves [annotation attachments](/guide/test-annotations), [artifacts](/api/advanced/artifacts) and [snapshots](/guide/snapshot) by receiving a WebSocket connection from the browser. This allows anyone who can connect to the API write any arbitrary code on your machine within the root of your project (configured by [`fs.allow`](https://vite.dev/config/server-options#server-fs-allow)). This option also gates privileged browser APIs that can write files indirectly, such as raw Chrome DevTools Protocol access through [`cdp()`](/api/browser/context#cdp).

If browser server is not exposed to the internet (the host is `localhost`), this should not be a problem, so the default value in that case is `true`. If you override the host, Vitest will set `allowWrite` to `false` by default to prevent potentially harmful writes.

## api.allowExec 4.1.0 {#api-allowexec}

* **Type:** `boolean`
* **Default:** `true` if not exposed to the network, `false` otherwise

Allows running any test file via the UI. This applies to the interactive elements (and the server code behind them) in the [UI](/guide/ui) that can run the code. This option also gates privileged browser APIs that can execute code indirectly, such as raw Chrome DevTools Protocol access through [`cdp()`](/api/browser/context#cdp). See [`api.allowExec`](/config/api#api-allowexec) for more information.

---

---
url: /config/browser/commands.md
---

# browser.commands

* **Type:** `Record<string, BrowserCommand>`
* **Default:** `{ readFile, writeFile, ... }`

Custom [commands](/api/browser/commands) that can be imported during browser tests from `vitest/browser`.

---

---
url: /config/browser/connecttimeout.md
---

# browser.connectTimeout

* **Type:** `number`
* **Default:** `60_000`

The timeout in milliseconds. If connection to the browser takes longer, the test suite will fail.

::: info
This is the time it should take for the browser to establish the WebSocket connection with the Vitest server. In normal circumstances, this timeout should never be reached.
:::

---

---
url: /config/browser/detailspanelposition.md
---

# browser.detailsPanelPosition

* **Type:** `'right' | 'bottom'`
* **Default:** `'right'`
* **CLI:** `--browser.detailsPanelPosition=bottom`, `--browser.detailsPanelPosition=right`

Controls the default position of the details panel in the Vitest UI when running browser tests.

* `'right'` - Shows the details panel on the right side with a horizontal split between the browser viewport and the details panel.
* `'bottom'` - Shows the details panel at the bottom with a vertical split between the browser viewport and the details panel.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      detailsPanelPosition: 'bottom', // or 'right'
    },
  },
})
```

## Example

::: tabs
\== bottom

---

---
url: /config/browser/enabled.md
---

# browser.enabled

* **Type:** `boolean`
* **Default:** `false`
* **CLI:** `--browser`, `--browser.enabled=false`

Enabling this flag makes Vitest run all tests in a [browser](/guide/browser/) by default. If you are configuring other browser options via the CLI, you can use `--browser.enabled` alongside them instead of `--browser`:

```sh
vitest --browser.enabled --browser.headless
```

::: warning
To enable [Browser Mode](/guide/browser/), you must also specify the [`provider`](/config/browser/provider) and at least one [`instance`](/config/browser/instances). Available providers:

* [playwright](/config/browser/playwright)
* [webdriverio](/config/browser/webdriverio)
* [preview](/config/browser/preview)
  :::

## Example

```js{7} [vitest.config.js]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
})
```

If you use TypeScript, the `browser` field in `instances` provides autocompletion based on your provider.

---

---
url: /config/browser/expect.md
---

# browser.expect

* **Type:** `ExpectOptions`
