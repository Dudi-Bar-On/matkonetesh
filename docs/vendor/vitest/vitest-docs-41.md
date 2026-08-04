---
name: vitest-docs-41
description: "vitest (test runner) — vendor doc 41/48 (vitest.dev)"
type: reference
---

# Configuring WebdriverIO

::: info Playwright vs WebdriverIO
If you do not already use WebdriverIO in your project, we recommend starting with [Playwright](/config/browser/playwright) as it is easier to configure and has more flexible API.
:::

To run tests using WebdriverIO, you need to install the [`@vitest/browser-webdriverio`](https://npmx.dev/package/@vitest/browser-webdriverio) npm package and specify its `webdriverio` export in the `test.browser.provider` property of your config:

```ts [vitest.config.js]
import { webdriverio } from '@vitest/browser-webdriverio'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: webdriverio(),
      instances: [{ browser: 'chrome' }]
    },
  },
})
```

You can configure all the parameters that [`remote`](https://webdriver.io/docs/api/modules/#remoteoptions-modifier) function accepts:

```ts{8-12,19-25} [vitest.config.js]
import { webdriverio } from '@vitest/browser-webdriverio'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      // shared provider options between all instances
      provider: webdriverio({
        capabilities: {
          browserVersion: '82',
        },
      }),
      instances: [
        { browser: 'chrome' },
        {
          browser: 'firefox',
          // overriding options only for a single instance
          // this will NOT merge options with the parent one
          provider: webdriverio({
            capabilities: {
              'moz:firefoxOptions': {
                args: ['--disable-gpu'],
              },
            },
          })
        },
      ],
    },
  },
})
```

You can find most available options in the [WebdriverIO documentation](https://webdriver.io/docs/configuration/). Note that Vitest will ignore all test runner options because we only use `webdriverio`'s browser capabilities.

::: tip
Most useful options are located on `capabilities` object. WebdriverIO allows nested capabilities, but Vitest will ignore those options because we rely on a different mechanism to spawn several browsers.

Note that Vitest will ignore `capabilities.browserName` — use [`test.browser.instances.browser`](/config/browser/instances#browser) instead.
:::

---

---
url: /api/browser/context.md
---

# Context API

Vitest exposes a context module via `vitest/browser` entry point. As of 2.0, it exposes a small set of utilities that might be useful to you in tests.

## `userEvent`

::: tip
The `userEvent` API is explained in detail at [Interactivity API](/api/browser/interactivity).
:::

```ts
/**
 * Handler for user interactions. The support is implemented by the browser provider (`playwright` or `webdriverio`).
 * If used with `preview` provider, fallbacks to simulated events via `@testing-library/user-event`.
 * @experimental
 */
export const userEvent: {
  setup: () => UserEvent
  cleanup: () => Promise<void>
  click: (element: Element, options?: UserEventClickOptions) => Promise<void>
  dblClick: (element: Element, options?: UserEventDoubleClickOptions) => Promise<void>
  tripleClick: (element: Element, options?: UserEventTripleClickOptions) => Promise<void>
  selectOptions: (
    element: Element,
    values: HTMLElement | HTMLElement[] | string | string[],
    options?: UserEventSelectOptions,
  ) => Promise<void>
  keyboard: (text: string) => Promise<void>
  type: (element: Element, text: string, options?: UserEventTypeOptions) => Promise<void>
  clear: (element: Element) => Promise<void>
  tab: (options?: UserEventTabOptions) => Promise<void>
  hover: (element: Element, options?: UserEventHoverOptions) => Promise<void>
  unhover: (element: Element, options?: UserEventHoverOptions) => Promise<void>
  fill: (element: Element, text: string, options?: UserEventFillOptions) => Promise<void>
  dragAndDrop: (source: Element, target: Element, options?: UserEventDragAndDropOptions) => Promise<void>
}
```

## `commands`

::: tip
This API is explained in detail at [Commands API](/api/browser/commands).
:::

```ts
/**
 * Available commands for the browser.
 * A shortcut to `server.commands`.
 */
export const commands: BrowserCommands
```

## `page`

The `page` export provides utilities to interact with the current `page`.

::: warning
While it exposes some utilities from Playwright's `page`, it is not the same object. Since the browser context is evaluated in the browser, your tests don't have access to Playwright's `page` because it runs on the server.

Use [Commands API](/api/browser/commands) if you need to have access to Playwright's `page` object.
:::

```ts
export const page: {
  /**
   * Change the size of iframe's viewport.
   */
  viewport(width: number, height: number): Promise<void>
  /**
   * Make a screenshot of the test iframe or a specific element.
   * @returns Path to the screenshot file or path and base64.
   */
  screenshot(options: Omit<ScreenshotOptions, 'base64'> & { base64: true }): Promise<{
    path: string
    base64: string
  }>
  screenshot(options?: ScreenshotOptions): Promise<string>
  /**
   * Add a trace marker when browser tracing is enabled.
   */
  mark(name: string, options?: { stack?: string }): Promise<void>
  /**
   * Group multiple operations under a trace marker when browser tracing is enabled.
   */
  mark<T>(name: string, body: () => T | Promise<T>, options?: { stack?: string }): Promise<T>
  /**
   * Extend default `page` object with custom methods.
   */
  extend(methods: Partial<BrowserPage>): BrowserPage
  /**
   * Wrap an HTML element in a `Locator`. When querying for elements, the search will always return this element.
   */
  elementLocator(element: Element): Locator
  /**
   * The iframe locator. This is a document locator that enters the iframe body
   * and works similarly to the `page` object.
   * **Warning:** At the moment, this is supported only by the `playwright` provider.
   */
  frameLocator(iframeElement: Locator): FrameLocator

  /**
   * Locator APIs. See its documentation for more details.
   */
  getByRole(role: ARIARole | string, options?: LocatorByRoleOptions): Locator
  getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator
  getByTestId(text: string | RegExp): Locator
  getByAltText(text: string | RegExp, options?: LocatorOptions): Locator
  getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator
  getByText(text: string | RegExp, options?: LocatorOptions): Locator
  getByTitle(text: string | RegExp, options?: LocatorOptions): Locator
}
```

::: tip
The `getBy*` API is explained at [Locators API](/api/browser/locators).
:::

::: warning WARNING 3.2.0
Note that `screenshot` will always return a base64 string if `save` is set to `false`.
The `path` is also ignored in that case.
:::
