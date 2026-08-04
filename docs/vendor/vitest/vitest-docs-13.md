---
name: vitest-docs-13
description: "vitest (test runner) — vendor doc 13/48 (vitest.dev)"
type: reference
---

## toBeRequired

```ts
function toBeRequired(): Promise<void>
```

This allows you to check if a form element is currently required.

An element is required if it is having a `required` or `aria-required="true"` attribute.

```html
<input data-testid="required-input" required />
<input data-testid="aria-required-input" aria-required="true" />
<input data-testid="conflicted-input" required aria-required="false" />
<input data-testid="aria-not-required-input" aria-required="false" />
<input data-testid="optional-input" />
<input data-testid="unsupported-type" type="image" required />
<select data-testid="select" required></select>
<textarea data-testid="textarea" required></textarea>
<div data-testid="supported-role" role="tree" required></div>
<div data-testid="supported-role-aria" role="tree" aria-required="true"></div>
```

```ts
await expect.element(getByTestId('required-input')).toBeRequired()
await expect.element(getByTestId('aria-required-input')).toBeRequired()
await expect.element(getByTestId('conflicted-input')).toBeRequired()
await expect.element(getByTestId('aria-not-required-input')).not.toBeRequired()
await expect.element(getByTestId('optional-input')).not.toBeRequired()
await expect.element(getByTestId('unsupported-type')).not.toBeRequired()
await expect.element(getByTestId('select')).toBeRequired()
await expect.element(getByTestId('textarea')).toBeRequired()
await expect.element(getByTestId('supported-role')).not.toBeRequired()
await expect.element(getByTestId('supported-role-aria')).toBeRequired()
```

## toBeValid

```ts
function toBeValid(): Promise<void>
```

This allows you to check if the value of an element, is currently valid.

An element is valid if it has no [`aria-invalid` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) or an attribute value of "false". The result of [`checkValidity()`](https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation) must also be `true` if it's a form element.

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
await expect.element(getByTestId('no-aria-invalid')).toBeValid()
await expect.element(getByTestId('aria-invalid')).not.toBeValid()
await expect.element(getByTestId('aria-invalid-value')).not.toBeValid()
await expect.element(getByTestId('aria-invalid-false')).toBeValid()

await expect.element(getByTestId('valid-form')).toBeValid()
await expect.element(getByTestId('invalid-form')).not.toBeValid()
```

## toBeVisible

```ts
function toBeVisible(): Promise<void>
```

This allows you to check if an element is currently visible to the user.

Element is considered visible when it has non-empty bounding box and does not have `visibility:hidden` computed style.

Note that according to this definition:

* Elements of zero size **are not** considered visible.
* Elements with `display:none` **are not** considered visible.
* Elements with `opacity:0` **are** considered visible.

To check that at least one element from the list is visible, use `locator.first()`.

```ts
// A specific element is visible.
await expect.element(page.getByText('Welcome')).toBeVisible()

// At least one item in the list is visible.
await expect.element(page.getByTestId('todo-item').first()).toBeVisible()

// At least one of the two elements is visible, possibly both.
await expect.element(
  page.getByRole('button', { name: 'Sign in' })
    .or(page.getByRole('button', { name: 'Sign up' }))
    .first()
).toBeVisible()
```

## toBeInViewport 4.0.0 {#tobeinviewport}

```ts
function toBeInViewport(options: { ratio?: number }): Promise<void>
```

This allows you to check if an element is currently in viewport with [IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

You can pass `ratio` argument as option, which means the minimal ratio of the element should be in viewport. `ratio` should be in 0~1.

```ts
// A specific element is in viewport.
await expect.element(page.getByText('Welcome')).toBeInViewport()

// 50% of a specific element should be in viewport
await expect.element(page.getByText('To')).toBeInViewport({ ratio: 0.5 })

// Full of a specific element should be in viewport
await expect.element(page.getByText('Vitest')).toBeInViewport({ ratio: 1 })
```

## toContainElement

```ts
function toContainElement(element: HTMLElement | SVGElement | Locator | null): Promise<void>
```

This allows you to assert whether an element contains another element as a descendant or not.

```html
<span data-testid="ancestor"><span data-testid="descendant"></span></span>
```

```ts
const ancestor = getByTestId('ancestor')
const descendant = getByTestId('descendant')
const nonExistingElement = getByTestId('does-not-exist')

await expect.element(ancestor).toContainElement(descendant)
await expect.element(descendant).not.toContainElement(ancestor)
await expect.element(ancestor).not.toContainElement(nonExistingElement)
```

## toContainHTML

```ts
function toContainHTML(htmlText: string): Promise<void>
```

Assert whether a string representing a HTML element is contained in another element. The string should contain valid html, and not any incomplete html.

```html
<span data-testid="parent"><span data-testid="child"></span></span>
```

```ts
// These are valid usages
await expect.element(getByTestId('parent')).toContainHTML('<span data-testid="child"></span>')
await expect.element(getByTestId('parent')).toContainHTML('<span data-testid="child" />')
await expect.element(getByTestId('parent')).not.toContainHTML('<br />')

// These won't work
await expect.element(getByTestId('parent')).toContainHTML('data-testid="child"')
await expect.element(getByTestId('parent')).toContainHTML('data-testid')
await expect.element(getByTestId('parent')).toContainHTML('</span>')
```

::: warning
Chances are you probably do not need to use this matcher. We encourage testing from the perspective of how the user perceives the app in a browser. That's why testing against a specific DOM structure is not advised.

It could be useful in situations where the code being tested renders html that was obtained from an external source, and you want to validate that html code was used as intended.

It should not be used to check DOM structure that you control. Please, use [`toContainElement`](#tocontainelement) instead.
:::
