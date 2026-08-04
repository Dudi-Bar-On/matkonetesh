---
name: vitest-docs-42
description: "vitest (test runner) — vendor doc 42/48 (vitest.dev)"
type: reference
---

### mark

```ts
function mark(name: string, options?: { stack?: string }): Promise<void>
function mark<T>(
  name: string,
  body: () => T | Promise<T>,
  options?: { stack?: string },
): Promise<T>
```

Adds a named marker to the trace timeline for the current test.

Pass `options.stack` to override the callsite location in trace metadata. This is useful for wrapper libraries that need to preserve the end-user source location.

If you pass a callback, Vitest creates a trace group with this name, runs the callback, and closes the group automatically.

```ts
import { page } from 'vitest/browser'

await page.mark('before submit')
await page.getByRole('button', { name: 'Submit' }).click()
await page.mark('after submit')

await page.mark('submit flow', async () => {
  await page.getByRole('textbox', { name: 'Email' }).fill('john@example.com')
  await page.getByRole('button', { name: 'Submit' }).click()
})
```

::: tip
This method is useful only when [`browser.trace`](/config/browser/trace) is enabled.
:::

### frameLocator

```ts
function frameLocator(iframeElement: Locator): FrameLocator
```

The `frameLocator` method returns a `FrameLocator` instance that can be used to find elements inside the iframe.

The frame locator is similar to `page`. It does not refer to the Iframe HTML element, but to the iframe's document.

```ts
const frame = page.frameLocator(
  page.getByTestId('iframe')
)

await frame.getByText('Hello World').click() // ✅
await frame.click() // ❌ Not available
```

::: danger IMPORTANT
At the moment, the `frameLocator` method is only supported by the `playwright` provider.

The interactive methods (like `click` or `fill`) are always available on elements within the iframe, but assertions with `expect.element` require the iframe to have the [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy).
:::

## `cdp`

```ts
function cdp(): CDPSession
```

The `cdp` export returns the current Chrome DevTools Protocol session. It is mostly useful to library authors to build tools on top of it.

::: warning
CDP session works only with `playwright` provider and only when using `chromium` browser. You can read more about it in playwright's [`CDPSession`](https://playwright.dev/docs/api/class-cdpsession) documentation.

CDP is a privileged debugging API. It is available only when browser API write and exec operations are enabled through [`browser.api.allowWrite`](/config/browser/api#api-allowwrite), [`browser.api.allowExec`](/config/browser/api#api-allowexec), [`api.allowWrite`](/config/api#api-allowwrite), and [`api.allowExec`](/config/api#api-allowexec).
:::

```ts
export const cdp: () => CDPSession
```

## `server`

The `server` export represents the Node.js environment where the Vitest server is running. It is mostly useful for debugging or limiting your tests based on the environment.

```ts
export const server: {
  /**
   * Platform the Vitest server is running on.
   * The same as calling `process.platform` on the server.
   */
  platform: Platform
  /**
   * Runtime version of the Vitest server.
   * The same as calling `process.version` on the server.
   */
  version: string
  /**
   * Name of the browser provider.
   */
  provider: string
  /**
   * Name of the current browser.
   */
  browser: string
  /**
   * Available commands for the browser.
   */
  commands: BrowserCommands
  /**
   * Serialized test config.
   */
  config: SerializedConfig
}
```

## `utils`

Utility functions useful for custom render libraries.

```ts
export const utils: {
  /**
   * This is similar to calling `page.elementLocator`, but it returns only
   * locator selectors.
   */
  getElementLocatorSelectors(element: Element): LocatorSelectors
  /**
   * Prints prettified HTML of an element.
   */
  debug(
    el?: Element | Locator | null | (Element | Locator)[],
    maxLength?: number,
    options?: PrettyDOMOptions,
  ): void
  /**
   * Returns prettified HTML of an element.
   */
  prettyDOM(
    dom?: Element | Locator | undefined | null,
    maxLength?: number,
    prettyFormatOptions?: PrettyDOMOptions,
  ): string
  /**
   * Configures default options of `prettyDOM` and `debug` functions.
   * This will also affect `vitest-browser-{framework}` package.
   */
  configurePrettyDOM(options: StringifyOptions): void
  /**
   * Creates "Cannot find element" error. Useful for custom locators.
   */
  getElementError(selector: string, container?: Element): Error
}
```

### configurePrettyDOM 4.0.0 {#configureprettydom}

The `configurePrettyDOM` function allows you to configure default options for the `prettyDOM` and `debug` functions. This is useful for customizing how HTML is formatted in test failure messages.

```ts
import { utils } from 'vitest/browser'

utils.configurePrettyDOM({
  maxDepth: 3,
  filterNode: 'script, style, [data-test-hide]'
})
```

#### Options

* **`maxDepth`** - Maximum depth to print nested elements (default: `Infinity`)
* **`maxLength`** - Maximum length of the output string (default: `7000`)
* **`filterNode`** - A CSS selector string or function to filter out nodes from the output. When a string is provided, elements matching the selector will be excluded. When a function is provided, it should return `false` to exclude a node.
* **`highlight`** - Enable syntax highlighting (default: `true`)
* And other options from [`@vitest/pretty-format`](https://npmx.dev/package/@vitest/pretty-format)

#### Filtering with CSS Selectors 4.1.0 {#filtering-with-css-selectors}

The `filterNode` option allows you to hide irrelevant markup (like scripts, styles, or hidden elements) from test failure messages, making it easier to identify the actual cause of failures.

```ts
import { utils } from 'vitest/browser'

// Filter out common noise elements
utils.configurePrettyDOM({
  filterNode: 'script, style, [data-test-hide]'
})

// Or use directly with prettyDOM
const html = utils.prettyDOM(element, undefined, {
  filterNode: 'script, style'
})
```

**Common Patterns:**

Filter out scripts and styles:

```ts
utils.configurePrettyDOM({ filterNode: 'script, style' })
```

Hide specific elements with data attributes:

```ts
utils.configurePrettyDOM({ filterNode: '[data-test-hide]' })
```

Hide nested content within an element:

```ts
// Hides all children of elements with data-test-hide-content
utils.configurePrettyDOM({ filterNode: '[data-test-hide-content] *' })
```

Combine multiple selectors:

```ts
utils.configurePrettyDOM({
  filterNode: 'script, style, [data-test-hide], svg'
})
```

::: tip
This feature is inspired by Testing Library's [`defaultIgnore`](https://testing-library.com/docs/dom-testing-library/api-configuration/#defaultignore) configuration.
:::

---

---
url: /config/coverage.md
---

# coverage  {#coverage}

You can use [`v8`](/guide/coverage.html#v8-provider), [`istanbul`](/guide/coverage.html#istanbul-provider) or [a custom coverage solution](/guide/coverage#custom-coverage-provider) for coverage collection.

You can provide coverage options to CLI with dot notation:

```sh
npx vitest --coverage.enabled --coverage.provider=istanbul
```

::: warning
If you are using coverage options with dot notation, don't forget to specify `--coverage.enabled`. Do not provide a single `--coverage` option in that case.
:::

## coverage.provider

* **Type:** `'v8' | 'istanbul' | 'custom'`
* **Default:** `'v8'`
* **CLI:** `--coverage.provider=<provider>`

Use `provider` to select the tool for coverage collection.
