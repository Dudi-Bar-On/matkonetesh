---
name: vitest-docs-26
description: "vitest (test runner) — vendor doc 26/48 (vitest.dev)"
type: reference
---

# browser.headless

* **Type:** `boolean`
* **Default:** `process.env.CI`
* **CLI:** `--browser.headless`, `--browser.headless=false`

Run the browser in a `headless` mode. If you are running Vitest in CI, it will be enabled by default.

---

---
url: /config/browser/instances.md
---

# browser.instances

* **Type:** `BrowserConfig`
* **Default:** `[]`

Defines multiple browser setups. Every config has to have at least a `browser` field.

You can specify most of the [project options](/config/) (not marked with a  icon) and some of the `browser` options like `browser.testerHtmlPath`.

::: warning
Every browser config inherits options from the root config:

```ts{3,9} [vitest.config.ts]
export default defineConfig({
  test: {
    setupFile: ['./root-setup-file.js'],
    browser: {
      enabled: true,
      testerHtmlPath: './custom-path.html',
      instances: [
        {
          // will have both setup files: "root" and "browser"
          setupFile: ['./browser-setup-file.js'],
          // implicitly has "testerHtmlPath" from the root config // [!code warning]
          // testerHtmlPath: './custom-path.html', // [!code warning]
        },
      ],
    },
  },
})
```

For more examples, refer to the ["Multiple Setups" guide](/guide/browser/multiple-setups).
:::

List of available `browser` options:

* `browser` (the name of the browser)
* [`headless`](/config/browser/headless)
* [`locators`](/config/browser/locators)
* [`viewport`](/config/browser/viewport)
* [`testerHtmlPath`](/config/browser/testerhtmlpath)
* [`screenshotDirectory`](/config/browser/screenshotdirectory)
* [`screenshotFailures`](/config/browser/screenshotfailures)
* [`provider`](/config/browser/provider)

Under the hood, Vitest transforms these instances into separate [test projects](/api/advanced/test-project) sharing a single Vite server for better caching performance.

---

---
url: /config/browser/isolate.md
---

# browser.isolate&#x20;

* **Type:** `boolean`
* **Default:** the same as [`--isolate`](/config/isolate)
* **CLI:** `--browser.isolate`, `--browser.isolate=false`

Run every test in a separate iframe.

::: danger DEPRECATED
This option is deprecated. Use [`isolate`](/config/isolate) instead.
:::

---

---
url: /config/browser/locators.md
---

# browser.locators

Options for built-in [browser locators](/api/browser/locators).

## browser.locators.testIdAttribute

* **Type:** `string`
* **Default:** `data-testid`

Attribute used to find elements with `getByTestId` locator.

## browser.locators.exact 4.1.3 {#browser-locators-exact}

* **Type:** `boolean`
* **Default:** `false`

When set to `true`, [locators](/api/browser/locators) will match text exactly by default, requiring a full, case-sensitive match. Individual locator calls can override this default via their own `exact` option.

```ts
// With exact: false (default), this matches "Hello, World!", "Say Hello, World", etc.
// With exact: true, this only matches the string "Hello, World" exactly.
const locator = page.getByText('Hello, World', { exact: true })
await locator.click()
```

---

---
url: /config/browser/orchestratorscripts.md
---

# browser.orchestratorScripts

* **Type:** `BrowserScript[]`
* **Default:** `[]`

Custom scripts that should be injected into the orchestrator HTML before test iframes are initiated. This HTML document only sets up iframes and doesn't actually import your code.

The script `src` and `content` will be processed by Vite plugins. Script should be provided in the following shape:

```ts
export interface BrowserScript {
  /**
   * If "content" is provided and type is "module", this will be its identifier.
   *
   * If you are using TypeScript, you can add `.ts` extension here for example.
   * @default `injected-${index}.js`
   */
  id?: string
  /**
   * JavaScript content to be injected. This string is processed by Vite plugins if type is "module".
   *
   * You can use `id` to give Vite a hint about the file extension.
   */
  content?: string
  /**
   * Path to the script. This value is resolved by Vite so it can be a node module or a file path.
   */
  src?: string
  /**
   * If the script should be loaded asynchronously.
   */
  async?: boolean
  /**
   * Script type.
   * @default 'module'
   */
  type?: string
}
```

---

---
url: /config/browser/provider.md
---

# browser.provider {#browser-provider}

* **Type:** `BrowserProviderOption`

The return value of the provider factory. You can import the factory from `@vitest/browser-<provider-name>` or make your own provider:

```ts{8-10}
import { playwright } from '@vitest/browser-playwright'
import { webdriverio } from '@vitest/browser-webdriverio'
import { preview } from '@vitest/browser-preview'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      provider: webdriverio(),
      provider: preview(),
    },
  },
})
```

To configure how provider initializes the browser, you can pass down options to the factory function:

```ts{7-13,20-26}
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      // shared provider options between all instances
      provider: playwright({
        launchOptions: {
          slowMo: 50,
          channel: 'chrome-beta',
        },
        actionTimeout: 5_000,
      }),
      instances: [
        { browser: 'chromium' },
        {
          browser: 'firefox',
          // overriding options only for a single instance
          // this will NOT merge options with the parent one
          provider: playwright({
            launchOptions: {
              firefoxUserPrefs: {
                'browser.startup.homepage': 'https://example.com',
              },
            },
          })
        }
      ],
    },
  },
})
```

## Custom Provider advanced {#custom-provider}

::: danger ADVANCED API
The custom provider API is highly experimental and can change between patches. If you just need to run tests in a browser, use the [`browser.instances`](/config/browser/instances) option instead.
:::

```ts
export interface BrowserProvider {
  name: string
  mocker?: BrowserModuleMocker
  readonly initScripts?: string[]
  /**
   * @experimental opt-in into file parallelisation
   */
  supportsParallelism: boolean
  getCommandsContext: (sessionId: string) => Record<string, unknown>
  openPage: (sessionId: string, url: string) => Promise<void>
  getCDPSession?: (sessionId: string) => Promise<CDPSession>
  close: () => Awaitable<void>
}
```

---

---
url: /config/browser/screenshotdirectory.md
---

# browser.screenshotDirectory

* **Type:** `string`
* **Default:** `__screenshots__` in the test file directory

Path to the screenshots directory relative to the `root`.

---

---
url: /config/browser/screenshotfailures.md
---

# browser.screenshotFailures

* **Type:** `boolean`
* **Default:** `!browser.ui`

Should Vitest take screenshots if the test fails.

---

---
url: /config/browser/testerhtmlpath.md
---

# browser.testerHtmlPath

* **Type:** `string`

A path to the HTML entry point. Can be relative to the root of the project. This file will be processed with [`transformIndexHtml`](https://vite.dev/guide/api-plugin#transformindexhtml) hook.

---

---
url: /config/browser/trace.md
---
