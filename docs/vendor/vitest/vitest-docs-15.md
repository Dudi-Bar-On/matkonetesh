---
name: vitest-docs-15
description: "vitest (test runner) — vendor doc 15/48 (vitest.dev)"
type: reference
---

## toHaveClass

```ts
function toHaveClass(...classNames: string[], options?: { exact: boolean }): Promise<void>
function toHaveClass(...classNames: (string | RegExp)[]): Promise<void>
```

This allows you to check whether the given element has certain classes within
its `class` attribute. You must provide at least one class, unless you are
asserting that an element does not have any classes.

The list of class names may include strings and regular expressions. Regular
expressions are matched against each individual class in the target element, and
it is NOT matched against its full `class` attribute value as whole.

::: warning
Note that you cannot use `exact: true` option when only regular expressions are provided.
:::

```html
<button data-testid="delete-button" class="btn extra btn-danger">
  Delete item
</button>
<button data-testid="no-classes">No Classes</button>
```

```ts
const deleteButton = getByTestId('delete-button')
const noClasses = getByTestId('no-classes')

await expect.element(deleteButton).toHaveClass('extra')
await expect.element(deleteButton).toHaveClass('btn-danger btn')
await expect.element(deleteButton).toHaveClass(/danger/, 'btn')
await expect.element(deleteButton).toHaveClass('btn-danger', 'btn')
await expect.element(deleteButton).not.toHaveClass('btn-link')
await expect.element(deleteButton).not.toHaveClass(/link/)

// ⚠️ regexp matches against individual classes, not the whole classList
await expect.element(deleteButton).not.toHaveClass(/btn extra/)

// the element has EXACTLY a set of classes (in any order)
await expect.element(deleteButton).toHaveClass('btn-danger extra btn', {
  exact: true
})
// if it has more than expected it is going to fail
await expect.element(deleteButton).not.toHaveClass('btn-danger extra', {
  exact: true
})

await expect.element(noClasses).not.toHaveClass()
```

## toHaveFocus

```ts
function toHaveFocus(): Promise<void>
```

This allows you to assert whether an element has focus or not.

```html
<div><input type="text" data-testid="element-to-focus" /></div>
```

```ts
const input = page.getByTestId('element-to-focus')
input.element().focus()
await expect.element(input).toHaveFocus()
input.element().blur()
await expect.element(input).not.toHaveFocus()
```

## toHaveFormValues

```ts
function toHaveFormValues(expectedValues: Record<string, unknown>): Promise<void>
```

This allows you to check if a form or fieldset contains form controls for each given name, and having the specified value.

::: tip
It is important to stress that this matcher can only be invoked on a [form](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement) or a [fieldset](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFieldSetElement) element.

This allows it to take advantage of the [`.elements`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements) property in `form` and `fieldset` to reliably fetch all form controls within them.

This also avoids the possibility that users provide a container that contains more than one `form`, thereby intermixing form controls that are not related, and could even conflict with one another.
:::

This matcher abstracts away the particularities with which a form control value
is obtained depending on the type of form control. For instance, `<input>`
elements have a `value` attribute, but `<select>` elements do not. Here's a list
of all cases covered:

* `<input type="number">` elements return the value as a **number**, instead of
  a string.
* `<input type="checkbox">` elements:
  * if there's a single one with the given `name` attribute, it is treated as a
    **boolean**, returning `true` if the checkbox is checked, `false` if
    unchecked.
  * if there's more than one checkbox with the same `name` attribute, they are
    all treated collectively as a single form control, which returns the value
    as an **array** containing all the values of the selected checkboxes in the
    collection.
* `<input type="radio">` elements are all grouped by the `name` attribute, and
  such a group treated as a single form control. This form control returns the
  value as a **string** corresponding to the `value` attribute of the selected
  radio button within the group.
* `<input type="text">` elements return the value as a **string**. This also
  applies to `<input>` elements having any other possible `type` attribute
  that's not explicitly covered in different rules above (e.g. `search`,
  `email`, `date`, `password`, `hidden`, etc.)
* `<select>` elements without the `multiple` attribute return the value as a
  **string** corresponding to the `value` attribute of the selected `option`, or
  `undefined` if there's no selected option.
* `<select multiple>` elements return the value as an **array** containing all
  the values of the [selected options](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/selectedOptions).
* `<textarea>` elements return their value as a **string**. The value
  corresponds to their node content.

The above rules make it easy, for instance, to switch from using a single select
control to using a group of radio buttons. Or to switch from a multi select
control, to using a group of checkboxes. The resulting set of form values used
by this matcher to compare against would be the same.

```html
<form data-testid="login-form">
  <input type="text" name="username" value="jane.doe" />
  <input type="password" name="password" value="12345678" />
  <input type="checkbox" name="rememberMe" checked />
  <button type="submit">Sign in</button>
</form>
```

```ts
await expect.element(getByTestId('login-form')).toHaveFormValues({
  username: 'jane.doe',
  rememberMe: true,
})
```

## toHaveStyle

```ts
function toHaveStyle(css: string | Partial<CSSStyleDeclaration>): Promise<void>
```

This allows you to check if a certain element has some specific css properties
with specific values applied. It matches only if the element has *all* the
expected properties applied, not just some of them.

```html
<button
  data-testid="delete-button"
  style="display: none; background-color: red"
>
  Delete item
</button>
```

```ts
const button = getByTestId('delete-button')

await expect.element(button).toHaveStyle('display: none')
await expect.element(button).toHaveStyle({ display: 'none' })
await expect.element(button).toHaveStyle(`
  background-color: red;
  display: none;
`)
await expect.element(button).toHaveStyle({
  backgroundColor: 'red',
  display: 'none',
})
await expect.element(button).not.toHaveStyle(`
  background-color: blue;
  display: none;
`)
await expect.element(button).not.toHaveStyle({
  backgroundColor: 'blue',
  display: 'none',
})
```

This also works with rules that are applied to the element via a class name for
which some rules are defined in a stylesheet currently active in the document.
The usual rules of css precedence apply.
