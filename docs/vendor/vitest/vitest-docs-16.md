---
name: vitest-docs-16
description: "vitest (test runner) — vendor doc 16/48 (vitest.dev)"
type: reference
---

## toHaveTextContent

```ts
function toHaveTextContent(
  text: string | RegExp,
  options?: { normalizeWhitespace: boolean }
): Promise<void>
```

This allows you to check whether the given node has a text content or not. This
supports elements, but also text nodes and fragments.

When a `string` argument is passed through, it will perform a partial
case-sensitive match to the node content.

To perform a case-insensitive match, you can use a `RegExp` with the `/i`
modifier.

If you want to match the whole content, you can use a `RegExp` to do it.

```html
<span data-testid="text-content">Text Content</span>
```

```ts
const element = getByTestId('text-content')

await expect.element(element).toHaveTextContent('Content')
// to match the whole content
await expect.element(element).toHaveTextContent(/^Text Content$/)
// to use case-insensitive match
await expect.element(element).toHaveTextContent(/content$/i)
await expect.element(element).not.toHaveTextContent('content')
```

## toHaveValue

```ts
function toHaveValue(value: string | string[] | number | null): Promise<void>
```

This allows you to check whether the given form element has the specified value.
It accepts `<input>`, `<select>` and `<textarea>` elements with the exception of
`<input type="checkbox">` and `<input type="radio">`, which can be meaningfully
matched only using [`toBeChecked`](#tobechecked) or
[`toHaveFormValues`](#tohaveformvalues).

It also accepts elements with roles `meter`, `progressbar`, `slider` or
`spinbutton` and checks their `aria-valuenow` attribute (as a number).

For all other form elements, the value is matched using the same algorithm as in
[`toHaveFormValues`](#tohaveformvalues) does.

```html
<input type="text" value="text" data-testid="input-text" />
<input type="number" value="5" data-testid="input-number" />
<input type="text" data-testid="input-empty" />
<select multiple data-testid="select-number">
  <option value="first">First Value</option>
  <option value="second" selected>Second Value</option>
  <option value="third" selected>Third Value</option>
</select>
```

```ts
const textInput = getByTestId('input-text')
const numberInput = getByTestId('input-number')
const emptyInput = getByTestId('input-empty')
const selectInput = getByTestId('select-number')

await expect.element(textInput).toHaveValue('text')
await expect.element(numberInput).toHaveValue(5)
await expect.element(emptyInput).not.toHaveValue()
await expect.element(selectInput).toHaveValue(['second', 'third'])
```

## toHaveDisplayValue

```typescript
function toHaveDisplayValue(
  value: string | RegExp | (string | RegExp)[]
): Promise<void>
```

This allows you to check whether the given form element has the specified
displayed value (the one the end user will see). It accepts `<input>`,
`<select>` and `<textarea>` elements with the exception of
`<input type="checkbox">` and `<input type="radio">`, which can be meaningfully
matched only using [`toBeChecked`](#tobechecked) or
[`toHaveFormValues`](#tohaveformvalues).

```html
<label for="input-example">First name</label>
<input type="text" id="input-example" value="Luca" />

<label for="textarea-example">Description</label>
<textarea id="textarea-example">An example description here.</textarea>

<label for="single-select-example">Fruit</label>
<select id="single-select-example">
  <option value="">Select a fruit...</option>
  <option value="banana">Banana</option>
  <option value="ananas">Ananas</option>
  <option value="avocado">Avocado</option>
</select>

<label for="multiple-select-example">Fruits</label>
<select id="multiple-select-example" multiple>
  <option value="">Select a fruit...</option>
  <option value="banana" selected>Banana</option>
  <option value="ananas">Ananas</option>
  <option value="avocado" selected>Avocado</option>
</select>
```

```ts
const input = page.getByLabelText('First name')
const textarea = page.getByLabelText('Description')
const selectSingle = page.getByLabelText('Fruit')
const selectMultiple = page.getByLabelText('Fruits')

await expect.element(input).toHaveDisplayValue('Luca')
await expect.element(input).toHaveDisplayValue(/Luc/)
await expect.element(textarea).toHaveDisplayValue('An example description here.')
await expect.element(textarea).toHaveDisplayValue(/example/)
await expect.element(selectSingle).toHaveDisplayValue('Select a fruit...')
await expect.element(selectSingle).toHaveDisplayValue(/Select/)
await expect.element(selectMultiple).toHaveDisplayValue([/Avocado/, 'Banana'])
```

## toBeChecked

```ts
function toBeChecked(): Promise<void>
```

This allows you to check whether the given element is checked. It accepts an
`input` of type `checkbox` or `radio` and elements with a `role` of `checkbox`,
`radio` or `switch` with a valid `aria-checked` attribute of `"true"` or
`"false"`.

```html
<input type="checkbox" checked data-testid="input-checkbox-checked" />
<input type="checkbox" data-testid="input-checkbox-unchecked" />
<div role="checkbox" aria-checked="true" data-testid="aria-checkbox-checked" />
<div
  role="checkbox"
  aria-checked="false"
  data-testid="aria-checkbox-unchecked"
/>

<input type="radio" checked value="foo" data-testid="input-radio-checked" />
<input type="radio" value="foo" data-testid="input-radio-unchecked" />
<div role="radio" aria-checked="true" data-testid="aria-radio-checked" />
<div role="radio" aria-checked="false" data-testid="aria-radio-unchecked" />
<div role="switch" aria-checked="true" data-testid="aria-switch-checked" />
<div role="switch" aria-checked="false" data-testid="aria-switch-unchecked" />
```

```ts
const inputCheckboxChecked = getByTestId('input-checkbox-checked')
const inputCheckboxUnchecked = getByTestId('input-checkbox-unchecked')
const ariaCheckboxChecked = getByTestId('aria-checkbox-checked')
const ariaCheckboxUnchecked = getByTestId('aria-checkbox-unchecked')
await expect.element(inputCheckboxChecked).toBeChecked()
await expect.element(inputCheckboxUnchecked).not.toBeChecked()
await expect.element(ariaCheckboxChecked).toBeChecked()
await expect.element(ariaCheckboxUnchecked).not.toBeChecked()

const inputRadioChecked = getByTestId('input-radio-checked')
const inputRadioUnchecked = getByTestId('input-radio-unchecked')
const ariaRadioChecked = getByTestId('aria-radio-checked')
const ariaRadioUnchecked = getByTestId('aria-radio-unchecked')
await expect.element(inputRadioChecked).toBeChecked()
await expect.element(inputRadioUnchecked).not.toBeChecked()
await expect.element(ariaRadioChecked).toBeChecked()
await expect.element(ariaRadioUnchecked).not.toBeChecked()

const ariaSwitchChecked = getByTestId('aria-switch-checked')
const ariaSwitchUnchecked = getByTestId('aria-switch-unchecked')
await expect.element(ariaSwitchChecked).toBeChecked()
await expect.element(ariaSwitchUnchecked).not.toBeChecked()
```
