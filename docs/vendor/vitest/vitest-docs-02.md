---
name: vitest-docs-02
description: "vitest (test runner) — vendor doc 02/48 (vitest.dev)"
type: reference
---

## api.allowWrite 4.1.0 {#api-allowwrite}

* **Type:** `boolean`
* **Default:** `true` if not exposed to the network, `false` otherwise

Vitest server can save test files or snapshot files via the API. This allows anyone who can connect to the API the ability to run any arbitrary code on your machine.

::: danger SECURITY ADVICE
Vitest does not expose the API to the internet by default and only listens on `localhost`. However if `host` is manually exposed to the network, anyone who connects to it can run arbitrary code on your machine, unless `api.allowWrite` and `api.allowExec` are set to `false`.

If the host is set to anything other than `localhost` or `127.0.0.1`, Vitest will set `api.allowWrite` and `api.allowExec` to `false` by default. This means that any write operations (like changing the code in the UI) will not work. However, if you understand the security implications, you can override them.
:::

## api.allowExec 4.1.0 {#api-allowexec}

* **Type:** `boolean`
* **Default:** `true` if not exposed to the network, `false` otherwise

Allows running any test file via the API. See the security advice in [`api.allowWrite`](#api-allowwrite).

---

---
url: /guide/browser/aria-snapshots.md
---

# ARIA Snapshots experimental 4.1.4

ARIA snapshots let you test the accessibility structure of your pages. Instead of asserting against raw HTML or visual output, you assert against the accessibility tree — the same structure that screen readers and other assistive technologies use.

Given this HTML:

```html
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

You can assert its accessibility tree:

```ts
await expect.element(page.getByRole('navigation')).toMatchAriaInlineSnapshot(`
  - navigation "Main":
    - link "Home":
      - /url: /
    - link "About":
      - /url: /about
`)
```

This catches accessibility regressions: missing labels, broken roles, incorrect heading levels, and more — things that DOM snapshots would miss. Even if the underlying HTML structure changes, the assertion would not fail as long as content matches semantically.

## Snapshot Workflow

ARIA snapshots use the same Vitest snapshot workflow as other snapshot assertions. File snapshots, inline snapshots, `--update` / `-u`, watch mode updates, and CI snapshot behavior all work the same way.

See the main [Snapshot guide](/guide/snapshot) for the general snapshot workflow, update behavior, and review guidelines.

## Basic Usage

Given a page with this HTML:

```html
<form aria-label="Log In">
  <input aria-label="Email" />
  <input aria-label="Password" type="password" />
  <button>Submit</button>
</form>
```

### File Snapshots

Use `toMatchAriaSnapshot()` to store the snapshot in a `.snap` file alongside your test:

```ts [basic.test.ts]
import { expect, test } from 'vitest'

test('login form', async () => {
  await expect.element(page.getByRole('form')).toMatchAriaSnapshot()
})
```

On first run, Vitest generates a snapshot file entry:

```js [__snapshots__/basic.test.ts.snap]
// Vitest Snapshot ...

exports[`login form 1`] = `
- form "Log In":
  - textbox "Email"
  - textbox "Password"
  - button "Submit"
`
```

### Inline Snapshots

Use `toMatchAriaInlineSnapshot()` to store the snapshot directly in the test file:

```ts
import { expect, test } from 'vitest'

test('login form', async () => {
  await expect.element(page.getByRole('form')).toMatchAriaInlineSnapshot(`
    - form "Log In":
      - textbox "Email"
      - textbox "Password"
      - button "Submit"
  `)
})
```

## Browser Mode Retry Behavior

In [Browser Mode](/guide/browser/), `expect.element()` polls the DOM and waits for the accessibility tree to **stabilize** before evaluating the result. On each poll, the matcher re-queries the element and re-captures the accessibility tree. The snapshot is considered stable when two consecutive polls produce the same output.

```ts
await expect.element(page.getByRole('form')).toMatchAriaInlineSnapshot(`
  - form "Log In":
    - textbox "Email"
    - textbox "Password"
    - button "Submit"
`)
```

On first run or with `--update`, the stable result is written as the new snapshot.

When an existing snapshot is present, the matcher also checks whether the stable result matches. If it does not, polling resets and continues — giving the DOM time to reach the expected state. This handles cases like animations, async rendering, or delayed state updates where the tree may briefly stabilize in an intermediate state before settling into its final form.

## Preserving Hand-Edited Patterns

When you hand-edit a snapshot to use regex patterns, those patterns survive `--update`. Only the literal parts that changed are overwritten. This lets you write flexible assertions that don't break when content changes.

### Example

**Step 1.** Your shopping cart page renders this HTML:

```html
<h1>Your Cart</h1>
<ul aria-label="Cart Items">
  <li>Wireless Headphones — $79.99</li>
</ul>
<button>Checkout</button>
```

You run your test for the first time with `--update`. Vitest generates the snapshot:

```yaml
- heading "Your Cart" [level=1]
- list "Cart Items":
    - listitem: Wireless Headphones — $79.99
- button "Checkout"
```

**Step 2.** The item names and prices are seeded test data that may change. You hand-edit those lines to regex patterns, but keep the stable structure as literals:

```yaml
- heading "Your Cart" [level=1]
- list "Cart Items":
    - listitem: /.+ — \$\d+\.\d+/
- button "Checkout"
```

**Step 3.** Later, a developer renames the button from "Checkout" to "Place Order". Running `--update` updates that literal but preserves your regex patterns:

```yaml
- heading "Your Cart" [level=1]
- list "Cart Items":
    - listitem: /.+ — \$\d+\.\d+/
- button "Place Order"   👈 New snapshot updated with new string
```

The regex patterns you wrote in step 2 are preserved because they still match the actual content. Only the mismatched literal "Checkout" was updated to "Place Order".

## Snapshot Format

ARIA snapshots use a YAML-like syntax. Each line represents a node in the accessibility tree.

::: info
ARIA snapshot templates use a **subset of YAML** syntax. Only the features needed for accessibility trees are supported: scalar values, nested mappings via indentation, and sequences (`- item`). Advanced YAML features like anchors, tags, flow collections, and multi-line scalars are not supported.

Captured text is also whitespace-normalized before it is rendered into the snapshot. Newlines, `<br>` line breaks, tabs, and repeated whitespace collapse to single spaces, so multi-line DOM text is emitted as a single-line snapshot value.
:::

Each accessible element in the tree is represented as a YAML node:

```yaml
- role "name" [attribute=value]
```

* `role`: The ARIA role of the element, such as `heading`, `list`, `listitem`, or `button`
* `"name"`: The [accessible name](https://w3c.github.io/accname/), when present. Quoted strings match exact values, and `/patterns/` match regular expressions
* `[attribute=value]`: Accessibility states and properties such as `checked`, `disabled`, `expanded`, `level`, `pressed`, or `selected`

These values come from ARIA attributes and the browser's accessibility tree, including semantics inferred from native HTML elements.

Because ARIA snapshots reflect the browser's accessibility tree, content excluded from that tree, such as `aria-hidden="true"` or `display: none`, does not appear in the snapshot.
