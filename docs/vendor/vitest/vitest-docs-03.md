---
name: vitest-docs-03
description: "vitest (test runner) — vendor doc 03/48 (vitest.dev)"
type: reference
---

### Roles and Accessible Names

For example:

```html
<button>Submit</button>
<h1>Welcome</h1>
<a href="/">Home</a>
<input aria-label="Email" />
```

```yaml
- button "Submit"
- heading "Welcome" [level=1]
- link "Home"
- textbox "Email"
```

The role usually comes from the element's native semantics, though it can also be defined with ARIA. The accessible name is computed from text content, associated labels, `aria-label`, `aria-labelledby`, and related naming rules.

For a closer look at how names are computed, see [Accessible Name and Description Computation](https://w3c.github.io/accname/).

Some content appears in the snapshot as a text node instead of a role-based element:

```html
<span>Hello world</span>
```

```yaml
- text: Hello world
```

Text values are always serialized on a single line after whitespace normalization. For example:

```html
<p>
Line 1
Line 2<br />Line 3
Line 4
</p>
```

```yaml
- paragraph: Line 1 Line 2 Line 3 Line 4
```

### Children

Child elements appear nested under their parent:

```html
<ul>
  <li>First</li>
  <li>Second</li>
  <li>Third</li>
</ul>
```

```yaml
- list:
    - listitem: First
    - listitem: Second
    - listitem: Third
```

If the parent has an accessible name, the snapshot includes it before the nested children:

```html
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

```yaml
- navigation "Main":
    - link "Home"
    - link "About"
```

If an element only contains a single text child and has no other properties, the text is rendered inline:

```html
<p>Hello world</p>
```

```yaml
- paragraph: Hello world
```

### Attributes

ARIA states and properties appear in brackets:

| HTML                                                                   | Snapshot                                  |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `<input type="checkbox" checked aria-label="Agree">`                   | `- checkbox "Agree" [checked]`            |
| `<input type="checkbox" aria-checked="mixed" aria-label="Select all">` | `- checkbox "Select all" [checked=mixed]` |
| `<button aria-disabled="true">Submit</button>`                         | `- button "Submit" [disabled]`            |
| `<button aria-expanded="true">Menu</button>`                           | `- button "Menu" [expanded]`              |
| `<h2>Title</h2>`                                                       | `- heading "Title" [level=2]`             |
| `<button aria-pressed="true">Bold</button>`                            | `- button "Bold" [pressed]`               |
| `<button aria-pressed="mixed">Bold</button>`                           | `- button "Bold" [pressed=mixed]`         |
| `<option selected>English</option>`                                    | `- option "English" [selected]`           |

Attributes only appear when they are active. A button that is not disabled simply has no `[disabled]` attribute — there is no `[disabled=false]`.

### Pseudo-Attributes

Some DOM properties that aren't part of ARIA but are useful for testing are exposed with a `/` prefix:

#### `/url:`

Links include their URL:

```html
<a href="/">Home</a>
```

```yaml
- link "Home":
    - /url: /
```

#### `/placeholder:`

Textboxes can include their placeholder text:

```html
<input aria-label="Email" placeholder="user@example.com" />
```

```yaml
- textbox "Email":
    - /placeholder: user@example.com
```

::: tip When does `/placeholder:` appear?

The `/placeholder:` pseudo-attribute only appears when the placeholder text is **different from the accessible name**. When an input has a placeholder but no `aria-label` or associated `<label>`, the browser uses the placeholder as the accessible name. In that case, the placeholder information is already in the name and is not duplicated.

* When placeholder is the accessible name:

```html
<input placeholder="Search" />
```

```yaml
- textbox "Search"
```

* When placeholder differs from the accessible name:

```html
<input placeholder="Search" aria-label="Search products" />
```

```yaml
- textbox "Search products":
    - /placeholder: Search
```

:::

## Matching

### Regular Expressions

Use regex patterns to match names flexibly:

```html
<h1>Welcome, Alice</h1>
<a href="https://example.com/profile/123">Profile</a>
```

```yaml
- heading /Welcome, .*/
- link "Profile":
    - /url: /https:\/\/example\.com\/.*/
```

Regex also works in pseudo-attribute values:

```html
<input aria-label="Search" placeholder="Type to search..." />
```

```yaml
- textbox "Search":
    - /placeholder: /Type .*/
```

::: warning Escaping backslashes in regex patterns
Snapshots are stored as JavaScript strings — in backtick-delimited template literals for inline snapshots and in `.snap` files. Because of this, backslashes need to be **doubled** when you hand-edit a snapshot to add a regex pattern.

For example, to match one or more digits with `\d+`:

```ts
// ✅ Correct — double backslash
await expect.element(button).toMatchAriaInlineSnapshot(`
  - button: /item \\d+/
`)

// ❌ Wrong — single backslash is consumed by JS, regex sees "d+" instead of "\d+"
await expect.element(button).toMatchAriaInlineSnapshot(`
  - button: /item \d+/
`)
```

This applies to both inline snapshots and `.snap` files. When Vitest **auto-generates** or **updates** a snapshot, escaping is handled automatically — you only need to worry about this when hand-editing regex patterns.
:::

### Child Matching

The `/children` directive controls how a node's children are compared against the template. There are three modes:

#### Partial Matching (default)

By default (no `/children` directive), templates use **contain** semantics — extra children in the actual tree are allowed as long as all template children appear as an ordered subsequence. This is the same as `/children: contain`.

```html
<main>
  <h1>Welcome</h1>
  <p>Some intro text</p>
  <button>Get Started</button>
</main>
```

```ts
// This passes — the template children are a subset of the actual children
await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
  - main:
    - heading "Welcome" [level=1]
`)
```

This is useful for focused, resilient tests that don't break when unrelated content is added.

#### Exact Matching (`/children: equal`)

Requires that the node's immediate children match the template exactly — same count, same order. No extra children are allowed at this level.

```html
<ul aria-label="Features">
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

```ts
// This FAILS — the list has 3 items but the template only lists 2
await expect.element(page.getByRole('list')).toMatchAriaInlineSnapshot(`
  - list "Features":
    - /children: equal
    - listitem: Feature A
    - listitem: Feature B
`)
```

```ts
// This PASSES — all 3 items are listed
await expect.element(page.getByRole('list')).toMatchAriaInlineSnapshot(`
  - list "Features":
    - /children: equal
    - listitem: Feature A
    - listitem: Feature B
    - listitem: Feature C
`)
```

The strict matching only applies at the level where `/children` is placed. Descendants of each `listitem` still use the default contain semantics.
