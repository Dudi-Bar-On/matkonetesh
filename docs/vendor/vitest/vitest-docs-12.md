---
name: vitest-docs-12
description: "vitest (test runner) — vendor doc 12/48 (vitest.dev)"
type: reference
---

# Assertion API

Vitest provides a wide range of DOM assertions out of the box forked from [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) library with the added support for locators and built-in retry-ability.

::: tip TypeScript Support
If you are using [TypeScript](/guide/browser/#typescript) or want to have correct type hints in `expect`, make sure you have `vitest/browser` referenced somewhere. If you never imported from there, you can add a `reference` comment in any file that's covered by your `tsconfig.json`:

```ts
/// <reference types="vitest/browser" />
```

:::

Tests in the browser might fail inconsistently due to their asynchronous nature. Because of this, it is important to have a way to guarantee that assertions succeed even if the condition is delayed (by a timeout, network request, or animation, for example). For this purpose, Vitest provides retriable assertions out of the box via the [`expect.poll`](/api/expect#poll) and `expect.element` APIs:

```ts
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('error banner is rendered', async () => {
  triggerError()

  // This creates a locator that will try to find the element
  // when any of its methods are called.
  // This call by itself doesn't check the existence of the element.
  const banner = page.getByRole('alert', {
    name: /error/i,
  })

  // Vitest provides `expect.element` with built-in retry-ability
  // It will repeatedly check that the element exists in the DOM and that
  // the content of `element.textContent` is equal to "Error!"
  // until all the conditions are met
  await expect.element(banner).toHaveTextContent('Error!')
})
```

We recommend to always use `expect.element` when working with `page.getBy*` locators to reduce test flakiness. Note that `expect.element` accepts a second option:

```ts
interface ExpectPollOptions {
  // The interval to retry the assertion for in milliseconds
  // Defaults to "expect.poll.interval" config option
  interval?: number
  // Time to retry the assertion for in milliseconds
  // Defaults to "expect.poll.timeout" config option
  timeout?: number
  // The message printed when the assertion fails
  message?: string
}
```

::: tip
`expect.element` is a shorthand for `expect.poll(() => element)` and works in exactly the same way.

`toHaveTextContent` and all other assertions are still available on a regular `expect` without a built-in retry-ability mechanism:

```ts
// will fail immediately if .textContent is not `'Error!'`
expect(banner).toHaveTextContent('Error!')
```

:::

## toBeDisabled

```ts
function toBeDisabled(): Promise<void>
```

Allows you to check whether an element is disabled from the user's perspective.

Matches if the element is a form control and the `disabled` attribute is specified on this element or the
element is a descendant of a form element with a `disabled` attribute.

Note that only native control elements such as HTML `button`, `input`, `select`, `textarea`, `option`, `optgroup`
can be disabled by setting "disabled" attribute. "disabled" attribute on other elements is ignored, unless it's a custom element.

```html
<button
  data-testid="button"
  type="submit"
  disabled
>
  submit
</button>
```

```ts
await expect.element(getByTestId('button')).toBeDisabled() // ✅
await expect.element(getByTestId('button')).not.toBeDisabled() // ❌
```

## toBeEnabled

```ts
function toBeEnabled(): Promise<void>
```

Allows you to check whether an element is not disabled from the user's perspective.

Works like [`not.toBeDisabled()`](#tobedisabled). Use this matcher to avoid double negation in your tests.

```html
<button
  data-testid="button"
  type="submit"
  disabled
>
  submit
</button>
```

```ts
await expect.element(getByTestId('button')).toBeEnabled() // ✅
await expect.element(getByTestId('button')).not.toBeEnabled() // ❌
```

## toBeEmptyDOMElement

```ts
function toBeEmptyDOMElement(): Promise<void>
```

This allows you to assert whether an element has no visible content for the user. It ignores comments but will fail if the element contains white-space.

```html
<span data-testid="not-empty"><span data-testid="empty"></span></span>
<span data-testid="with-whitespace"> </span>
<span data-testid="with-comment"><!-- comment --></span>
```

```ts
await expect.element(getByTestId('empty')).toBeEmptyDOMElement()
await expect.element(getByTestId('not-empty')).not.toBeEmptyDOMElement()
await expect.element(
  getByTestId('with-whitespace')
).not.toBeEmptyDOMElement()
```

## toBeInTheDocument

```ts
function toBeInTheDocument(): Promise<void>
```

Assert whether an element is present in the document or not.

```html
<svg data-testid="svg-element"></svg>
```

```ts
await expect.element(getByTestId('svg-element')).toBeInTheDocument()
await expect.element(getByTestId('does-not-exist')).not.toBeInTheDocument()
```

::: warning
This matcher does not find detached elements. The element must be added to the document to be found by `toBeInTheDocument`. If you desire to search in a detached element, please use: [`toContainElement`](#tocontainelement).
:::

## toBeInvalid

```ts
function toBeInvalid(): Promise<void>
```

This allows you to check if an element, is currently invalid.

An element is invalid if it has an [`aria-invalid` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) with no value or a value of `"true"`, or if the result of [`checkValidity()`](https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation) is `false`.

```html
<input data-testid="no-aria-invalid" />
<input data-testid="aria-invalid" aria-invalid />
<input data-testid="aria-invalid-value" aria-invalid="true" />
<input data-testid="aria-invalid-false" aria-invalid="false" />

<form data-testid="valid-form">
  <input />
</form>

<form data-testid="invalid-form">
  <input required />
</form>
```

```ts
await expect.element(getByTestId('no-aria-invalid')).not.toBeInvalid()
await expect.element(getByTestId('aria-invalid')).toBeInvalid()
await expect.element(getByTestId('aria-invalid-value')).toBeInvalid()
await expect.element(getByTestId('aria-invalid-false')).not.toBeInvalid()

await expect.element(getByTestId('valid-form')).not.toBeInvalid()
await expect.element(getByTestId('invalid-form')).toBeInvalid()
```
