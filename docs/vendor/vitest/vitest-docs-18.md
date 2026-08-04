---
name: vitest-docs-18
description: "vitest (test runner) — vendor doc 18/48 (vitest.dev)"
type: reference
---

## toMatchScreenshot experimental {#tomatchscreenshot}

```ts
function toMatchScreenshot(
  options?: ScreenshotMatcherOptions,
): Promise<void>
function toMatchScreenshot(
  name?: string,
  options?: ScreenshotMatcherOptions,
): Promise<void>
```

::: tip
The `toMatchScreenshot` assertion can be configured globally in your
[Vitest config](/config/browser/expect#tomatchscreenshot).
:::

This assertion allows you to perform visual regression testing by comparing
screenshots of elements or pages against stored reference images.

When differences are detected beyond the configured threshold, the test fails.
To help identify the changes, the assertion generates:

* The actual screenshot captured during the test
* The expected reference screenshot
* A diff image highlighting the differences (when possible)

::: warning Screenshots Stability
The assertion automatically retries taking screenshots until two consecutive
captures yield the same result. This helps reduce flakiness caused by
animations, loading states, or other dynamic content. You can control this
behavior with the `timeout` option.

However, browser rendering can vary across:

* Different browsers and browser versions
* Operating systems (Windows, macOS, Linux)
* Screen resolutions and pixel densities
* GPU drivers and hardware acceleration
* Font rendering and system fonts

It is recommended to read the
[Visual Regression Testing guide](/guide/browser/visual-regression-testing) to
implement this testing strategy efficiently.
:::

::: tip
When a screenshot comparison fails due to **intentional changes**, you can
update the reference screenshot by pressing the `u` key in watch mode, or by
running tests with the `-u` or `--update` flags.
:::

```html
<button data-testid="button">Fancy Button</button>
```

```ts
// basic usage, auto-generates screenshot name
await expect.element(getByTestId('button')).toMatchScreenshot()

// with custom name
await expect.element(getByTestId('button')).toMatchScreenshot('fancy-button')

// with options
await expect.element(getByTestId('button')).toMatchScreenshot({
  comparatorName: 'pixelmatch',
  comparatorOptions: {
    allowedMismatchedPixelRatio: 0.01,
  },
})

// with both name and options
await expect.element(getByTestId('button')).toMatchScreenshot('fancy-button', {
  comparatorName: 'pixelmatch',
  comparatorOptions: {
    allowedMismatchedPixelRatio: 0.01,
  },
})
```

### Options

* `comparatorName: "pixelmatch" = "pixelmatch"`

  The algorithm/library used for comparing images.

  `"pixelmatch"` is the only built-in comparator, but you can use custom ones by [registering them in the config file](/config/browser/expect#browser-expect-tomatchscreenshot-comparators).

* `comparatorOptions: object`

  These options allow changing the behavior of the comparator. What properties
  can be set depends on the chosen comparator algorithm.

  Vitest has set default values out of the box, but they can be overridden.

  * [`"pixelmatch"` options](#pixelmatch-comparator-options)

  ::: warning
  **Always explicitly set `comparatorName` to get proper type inference for
  `comparatorOptions`**.

  Without it, TypeScript won't know which options are valid:

  ```ts
  // ❌ TypeScript can't infer the correct options
  await expect.element(button).toMatchScreenshot({
    comparatorOptions: {
      // might error when new comparators are added
      allowedMismatchedPixelRatio: 0.01,
    },
  })

  // ✅ TypeScript knows these are pixelmatch options
  await expect.element(button).toMatchScreenshot({
    comparatorName: 'pixelmatch',
    comparatorOptions: {
      allowedMismatchedPixelRatio: 0.01,
    },
  })
  ```

  :::

* `screenshotOptions: object`

  The same options allowed by
  [`locator.screenshot()`](/api/browser/locators.html#screenshot), except for:

  * `'base64'`
  * `'path'`
  * `'save'`
  * `'type'`

* `timeout: number = 5_000`

  Time to wait until a stable screenshot is found.

  Setting this value to `0` disables the timeout, but if a stable screenshot
  can't be determined the process will not end.

#### `"pixelmatch"` comparator options

The `"pixelmatch"` comparator uses [`@blazediff/core`](https://blazediff.dev/docs/core) under the hood. The following options are available when using it:

* `allowedMismatchedPixelRatio: number | undefined = undefined`

  The maximum allowed ratio of differing pixels between the captured screenshot
  and the reference image.

  Must be a value between `0` and `1`.

  For example, `allowedMismatchedPixelRatio: 0.02` means the test will pass
  if up to 2% of pixels differ, but fail if more than 2% differ.

* `allowedMismatchedPixels: number | undefined = undefined`

  The maximum number of pixels that are allowed to differ between the captured
  screenshot and the stored reference image.

  If set to `undefined`, any non-zero difference will cause the test to fail.

  For example, `allowedMismatchedPixels: 10` means the test will pass if 10 or
  fewer pixels differ, but fail if 11 or more differ.

* `threshold: number = 0.1`

  Acceptable perceived color difference between the same pixel in two images.

  Value ranges from `0` (strict) to `1` (very lenient). Lower values mean small
  differences will be detected.

  The comparison uses the [YIQ color space](https://en.wikipedia.org/wiki/YIQ).

* `includeAA: boolean = false`

  If `true`, disables detection and ignoring of anti-aliased pixels.

* `alpha: number = 0.1`

  Blending level of unchanged pixels in the diff image.

  Ranges from `0` (white) to `1` (original brightness).

* `aaColor: [r: number, g: number, b: number] = [255, 255, 0]`

  Color used for anti-aliased pixels in the diff image.

* `diffColor: [r: number, g: number, b: number] = [255, 0, 0]`

  Color used for differing pixels in the diff image.

* `diffColorAlt: [r: number, g: number, b: number] | undefined = undefined`

  Optional alternative color for dark-on-light differences, to help show what's
  added vs. removed.

  If not set, `diffColor` is used for all differences.

* `diffMask: boolean = false`

  If `true`, shows only the diff as a mask on a transparent background, instead
  of overlaying it on the original image.

  Anti-aliased pixels won't be shown (if detected).

::: warning
When both `allowedMismatchedPixels` and `allowedMismatchedPixelRatio` are set,
the more restrictive value is used.

For example, if you allow 100 pixels or 2% ratio, and your image has 10,000
pixels, the effective limit would be 100 pixels instead of 200.
:::

---

---
url: /api/assert-type.md
---
# assertType

::: warning
During runtime this function doesn't do anything. To [enable typechecking](/guide/testing-types#run-typechecking), don't forget to pass down `--typecheck` flag.
:::

* **Type:** `<T>(value: T): void`

You can use this function as an alternative for [`expectTypeOf`](/api/expect-typeof) to easily assert that the argument type is equal to the generic provided.

```ts
import { assertType } from 'vitest'

function concat(a: string, b: string): string
function concat(a: number, b: number): number
function concat(a: string | number, b: string | number): string | number

assertType<string>(concat('a', 'b'))
assertType<number>(concat(1, 2))
// @ts-expect-error wrong types
assertType(concat('a', 2))
```

---

---
url: /config/attachmentsdir.md
---
