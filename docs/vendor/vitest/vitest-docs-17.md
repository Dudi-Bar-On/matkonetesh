---
name: vitest-docs-17
description: "vitest (test runner) — vendor doc 17/48 (vitest.dev)"
type: reference
---

## toBePartiallyChecked

```typescript
function toBePartiallyChecked(): Promise<void>
```

This allows you to check whether the given element is partially checked. It
accepts an `input` of type `checkbox` and elements with a `role` of `checkbox`
with a `aria-checked="mixed"`, or `input` of type `checkbox` with
`indeterminate` set to `true`

```html
<input type="checkbox" aria-checked="mixed" data-testid="aria-checkbox-mixed" />
<input type="checkbox" checked data-testid="input-checkbox-checked" />
<input type="checkbox" data-testid="input-checkbox-unchecked" />
<div role="checkbox" aria-checked="true" data-testid="aria-checkbox-checked" />
<div
  role="checkbox"
  aria-checked="false"
  data-testid="aria-checkbox-unchecked"
/>
<input type="checkbox" data-testid="input-checkbox-indeterminate" />
```

```ts
const ariaCheckboxMixed = getByTestId('aria-checkbox-mixed')
const inputCheckboxChecked = getByTestId('input-checkbox-checked')
const inputCheckboxUnchecked = getByTestId('input-checkbox-unchecked')
const ariaCheckboxChecked = getByTestId('aria-checkbox-checked')
const ariaCheckboxUnchecked = getByTestId('aria-checkbox-unchecked')
const inputCheckboxIndeterminate = getByTestId('input-checkbox-indeterminate')

await expect.element(ariaCheckboxMixed).toBePartiallyChecked()
await expect.element(inputCheckboxChecked).not.toBePartiallyChecked()
await expect.element(inputCheckboxUnchecked).not.toBePartiallyChecked()
await expect.element(ariaCheckboxChecked).not.toBePartiallyChecked()
await expect.element(ariaCheckboxUnchecked).not.toBePartiallyChecked()

inputCheckboxIndeterminate.element().indeterminate = true
await expect.element(inputCheckboxIndeterminate).toBePartiallyChecked()
```

## toHaveRole

```ts
function toHaveRole(role: ARIARole): Promise<void>
```

This allows you to assert that an element has the expected [role](https://www.w3.org/TR/html-aria/#docconformance).

This is useful in cases where you already have access to an element via some query other than the role itself, and want to make additional assertions regarding its accessibility.

The role can match either an explicit role (via the `role` attribute), or an implicit one via the [implicit ARIA semantics](https://www.w3.org/TR/html-aria/#docconformance).

```html
<button data-testid="button">Continue</button>
<div role="button" data-testid="button-explicit">Continue</button>
<button role="switch button" data-testid="button-explicit-multiple">Continue</button>
<a href="/about" data-testid="link">About</a>
<a data-testid="link-invalid">Invalid link<a/>
```

```ts
await expect.element(getByTestId('button')).toHaveRole('button')
await expect.element(getByTestId('button-explicit')).toHaveRole('button')
await expect.element(getByTestId('button-explicit-multiple')).toHaveRole('button')
await expect.element(getByTestId('button-explicit-multiple')).toHaveRole('switch')
await expect.element(getByTestId('link')).toHaveRole('link')
await expect.element(getByTestId('link-invalid')).not.toHaveRole('link')
await expect.element(getByTestId('link-invalid')).toHaveRole('generic')
```

::: warning
Roles are matched literally by string equality, without inheriting from the ARIA role hierarchy. As a result, querying a superclass role like `checkbox` will not include elements with a subclass role like `switch`.

Also note that unlike `testing-library`, Vitest ignores all custom roles except the first valid one, following Playwright's behaviour:

```jsx
<div data-testid="switch" role="switch alert"></div>

await expect.element(getByTestId('switch')).toHaveRole('switch') // ✅
await expect.element(getByTestId('switch')).toHaveRole('alert') // ❌
```

:::

## toHaveSelection

```ts
function toHaveSelection(selection?: string): Promise<void>
```

This allows to assert that an element has a
[text selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection).

This is useful to check if text or part of the text is selected within an
element. The element can be either an input of type text, a textarea, or any
other element that contains text, such as a paragraph, span, div etc.

::: warning
The expected selection is a string, it does not allow to check for
selection range indices.
:::

```html
<div>
  <input type="text" value="text selected text" data-testid="text" />
  <textarea data-testid="textarea">text selected text</textarea>
  <p data-testid="prev">prev</p>
  <p data-testid="parent">
    text <span data-testid="child">selected</span> text
  </p>
  <p data-testid="next">next</p>
</div>
```

```ts
getByTestId('text').element().setSelectionRange(5, 13)
await expect.element(getByTestId('text')).toHaveSelection('selected')

getByTestId('textarea').element().setSelectionRange(0, 5)
await expect.element('textarea').toHaveSelection('text ')

const selection = document.getSelection()
const range = document.createRange()
selection.removeAllRanges()
selection.empty()
selection.addRange(range)

// selection of child applies to the parent as well
range.selectNodeContents(getByTestId('child').element())
await expect.element(getByTestId('child')).toHaveSelection('selected')
await expect.element(getByTestId('parent')).toHaveSelection('selected')

// selection that applies from prev all, parent text before child, and part child.
range.setStart(getByTestId('prev').element(), 0)
range.setEnd(getByTestId('child').element().childNodes[0], 3)
await expect.element(queryByTestId('prev')).toHaveSelection('prev')
await expect.element(queryByTestId('child')).toHaveSelection('sel')
await expect.element(queryByTestId('parent')).toHaveSelection('text sel')
await expect.element(queryByTestId('next')).not.toHaveSelection()

// selection that applies from part child, parent text after child and part next.
range.setStart(getByTestId('child').element().childNodes[0], 3)
range.setEnd(getByTestId('next').element().childNodes[0], 2)
await expect.element(queryByTestId('child')).toHaveSelection('ected')
await expect.element(queryByTestId('parent')).toHaveSelection('ected text')
await expect.element(queryByTestId('prev')).not.toHaveSelection()
await expect.element(queryByTestId('next')).toHaveSelection('ne')
```
