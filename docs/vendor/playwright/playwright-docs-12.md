---
name: playwright-docs-12
description: "Playwright (GUI-walk driver) — vendor doc 12/30 (docs)"
type: reference
---

### Snapshot testing
Snapshot testing captures a “snapshot” or representation of the entire
state of an element, component, or data at a given moment, which is then saved for future
comparisons. When re-running tests, the current state is compared to the snapshot, and if there
are differences, the test fails. This approach is especially useful for complex or dynamic
structures, where manually asserting each detail would be too time-consuming. Snapshot testing
is broader and more holistic than assertion testing, allowing you to track more complex changes over time.

**Advantages**
- **Simplifies complex outputs**: For example, testing a UI component's rendered output can be tedious with traditional assertions. Snapshots capture the entire output for easy comparison.
- **Quick Feedback loop**: Developers can easily spot unintended changes in the output.
- **Encourages consistency**: Helps maintain consistent output as code evolves.

**Disadvantages**
- **Over-Reliance**: It can be tempting to accept changes to snapshots without fully understanding
  them, potentially hiding bugs.
- **Granularity**: Large snapshots may be hard to interpret when differences arise, especially
  if minor changes affect large portions of the output.
- **Suitability**: Not ideal for highly dynamic content where outputs change frequently or
  unpredictably.

### When to use

- **Snapshot testing** is ideal for:
  - UI testing of whole pages and components.
  - Broad structural checks for complex UI components.
  - Regression testing for outputs that rarely change structure.

- **Assertion testing** is ideal for:
  - Core logic validation.
  - Computed value testing.
  - Fine-grained tests requiring precise conditions.

By combining snapshot testing for broad, structural checks and assertion testing for specific functionality, you can achieve a well-rounded testing strategy.

## Aria snapshots

In Playwright, aria snapshots provide a YAML representation of the accessibility tree of a page.
These snapshots can be stored and compared later to verify if the page structure remains consistent or meets defined
expectations.

The YAML format describes the hierarchical structure of accessible elements on the page, detailing **roles**, **attributes**, **values**, and **text content**.
The structure follows a tree-like syntax, where each node represents an accessible element, and indentation indicates
nested elements.

Each accessible element in the tree is represented as a YAML node:

```yaml
- role "name" [attribute=value]
```

- **role**: Specifies the ARIA or HTML role of the element (e.g., `heading`, `list`, `listitem`, `button`).
- **"name"**: Accessible name of the element. Quoted strings indicate exact values, `/patterns/` are used for regular expression.
- **[attribute=value]**: Attributes and values, in square brackets, represent specific ARIA attributes, such
  as `checked`, `disabled`, `expanded`, `invalid`, `level`, `pressed`, or `selected`.

These values are derived from ARIA attributes or calculated based on HTML semantics. To inspect the accessibility tree
structure of a page, use the [Chrome DevTools Accessibility Tab](https://developer.chrome.com/docs/devtools/accessibility/reference#tab).


## Snapshot matching

The [`method: PageAssertions.toMatchAriaSnapshot`] assertion method in Playwright compares the accessible
structure of the page with a predefined aria snapshot template, helping validate the page's state against
testing requirements. You can also use [`method: LocatorAssertions.toMatchAriaSnapshot`] to match a specific part of the page.

For the following DOM:

```html
<h1>title</h1>
```

You can match it using the following snapshot template:

```js
await expect(page).toMatchAriaSnapshot(`
  - heading "title"
`);
```

```python sync
expect(page).to_match_aria_snapshot("""
  - heading "title"
""")
```

```python async
await expect(page).to_match_aria_snapshot("""
  - heading "title"
""")
```

```java
assertThat(page).matchesAriaSnapshot("""
  - heading "title"
""");
```

```csharp
await Expect(page).ToMatchAriaSnapshotAsync(@"
  - heading ""title""
");
```

When matching, the snapshot template is compared to the current accessibility tree of the page:

* If the tree structure matches the template, the test passes; otherwise, it fails, indicating a mismatch between
  expected and actual accessibility states.
* The comparison is case-sensitive and collapses whitespace, so indentation and line breaks are ignored.
* The comparison is order-sensitive, meaning the order of elements in the snapshot template must match the order in the
  page's accessibility tree.


### Partial matching

You can perform partial matches on nodes by omitting attributes or accessible names, enabling verification of specific
parts of the accessibility tree without requiring exact matches. This flexibility is helpful for dynamic or irrelevant
attributes.

```html
<button>Submit</button>
```

```yaml title="aria snapshot"
- button
```

In this example, the button role is matched, but the accessible name ("Submit") is not specified, allowing the test to
pass regardless of the button's label.

<hr/>

For elements with ARIA attributes like `checked` or `disabled`, omitting these attributes allows partial matching,
focusing solely on role and hierarchy.

```html
<input type="checkbox" checked>
```

```yaml title="aria snapshot (partial match)"
- checkbox
```

In this partial match, the `checked` attribute is ignored, so the test will pass regardless of the checkbox state.

<hr/>

Similarly, you can partially match children in lists or groups by omitting specific list items or nested elements.

```html
<ul>
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

```yaml title="aria snapshot (partial match)"
- list
  - listitem: Feature B
```

Partial matches let you create flexible snapshot tests that verify essential page structure without enforcing
specific content or attributes.

### Strict matching

By default, a template containing the subset of children will be matched:

```html
<ul>
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

```yaml title="aria snapshot (partial match)"
- list
  - listitem: Feature B
```


The `/children` property can be used to control how child elements are matched:
- `contain` (default): Matches if all specified children are present in order
- `equal`: Matches if the children exactly match the specified list in order
- `deep-equal`: Matches if the children exactly match the specified list in order, including nested children

```html
<ul>
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

Following snapshot will fail due to Feature C not being in the template:

```yaml title="aria snapshot"
- list
  - /children: equal
  - listitem: Feature A
  - listitem: Feature B
```

#### Setting `children` mode globally

Instead of adding a `/children` property to every snapshot, you can set the default children matching mode for all
`toMatchAriaSnapshot` calls in the configuration file:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    toMatchAriaSnapshot: {
      children: 'equal',
    },
  },
});
```

Individual snapshots can still override the global setting by including an explicit `/children` property in the template.
