---
name: playwright-docs-13
description: "Playwright (GUI-walk driver) — vendor doc 13/30 (docs)"
type: reference
---

### Matching with regular expressions

Regular expressions allow flexible matching for elements with dynamic or variable text. Accessible names and text can
support regex patterns.

```html
<h1>Issues 12</h1>
```

```yaml title="aria snapshot"
- heading /Issues \d+/
```

## Generating snapshots

Creating aria snapshots in Playwright helps ensure and maintain your application's structure.
You can generate snapshots in various ways depending on your testing setup and workflow.

### Generating snapshots with the Playwright code generator

If you're using Playwright's [Code Generator](./codegen.md), generating aria snapshots is streamlined with its
interactive interface:

- **"Assert snapshot" Action**: In the code generator, you can use the "Assert snapshot" action to automatically create
a snapshot assertion for the selected elements. This is a quick way to capture the aria snapshot as part of your
recorded test flow.

- **"Aria snapshot" Tab**: The "Aria snapshot" tab within the code generator interface visually represents the
aria snapshot for a selected locator, letting you explore, inspect, and verify element roles, attributes, and
accessible names to aid snapshot creation and review.

### Updating snapshots with `@playwright/test` and the `--update-snapshots` flag
* langs: js

When using the Playwright test runner (`@playwright/test`), you can automatically update snapshots with the `--update-snapshots` flag, `-u` for short.

Running tests with the `--update-snapshots` flag will update snapshots that did not match. Matching snapshots will not be updated.

```bash
npx playwright test --update-snapshots
```

Updating snapshots is useful when application structure changes require new snapshots as a baseline. Note that Playwright will wait for the maximum expect timeout specified in the test runner configuration to ensure the page is settled before taking the snapshot. It might be necessary to adjust the `--timeout` if the test hits the timeout while generating snapshots.

#### Empty template for snapshot generation

Passing an empty string as the template in an assertion generates a snapshot on-the-fly:

```js
await expect(locator).toMatchAriaSnapshot('');
```

Note that Playwright will wait for the maximum expect timeout specified in the test runner configuration to ensure the
page is settled before taking the snapshot. It might be necessary to adjust the `--timeout` if the test hits the timeout
while generating snapshots.

#### Snapshot patch files

When updating snapshots, Playwright creates patch files that capture differences. These patch files can be reviewed,
applied, and committed to source control, allowing teams to track structural changes over time and ensure updates are
consistent with application requirements.

The way source code is updated can be changed using the `--update-source-method` flag. There are several options available:

- **"patch"** (default): Generates a unified diff file that can be applied to the source code using `git apply`.
- **"3way"**: Generates merge conflict markers in your source code, allowing you to choose whether to accept changes.
- **"overwrite"**: Overwrites the source code with the new snapshot values.

```bash
npx playwright test --update-snapshots --update-source-method=3way
```

#### Snapshots as separate files

To store your snapshots in a separate file, use the `toMatchAriaSnapshot` method with the `name` option, specifying a `.aria.yml` file extension.

```js
await expect(page.getByRole('main')).toMatchAriaSnapshot({ name: 'main.aria.yml' });
```

By default, snapshots from a test file `example.spec.ts` are placed in the `example.spec.ts-snapshots` directory. As snapshots should be the same across browsers, only one snapshot is saved even if testing with multiple browsers. Should you wish, you can customize the [snapshot path template](./api/class-testconfig#test-config-snapshot-path-template) using the following configuration:

```js
export default defineConfig({
  expect: {
    toMatchAriaSnapshot: {
      pathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
    },
  },
});
```

### Using [`method: Page.ariaSnapshot`] and [`method: Locator.ariaSnapshot`]

Methods [`method: Page.ariaSnapshot`] and [`method: Locator.ariaSnapshot`] allow you to programmatically create a YAML representation of accessible
elements within a locator's scope, especially helpful for generating snapshots dynamically during test execution.

**Example**:

```js
const snapshot = await page.ariaSnapshot();
console.log(snapshot);
```

```python sync
snapshot = page.aria_snapshot()
print(snapshot)
```

```python async
snapshot = await page.aria_snapshot()
print(snapshot)
```

```java
String snapshot = page.ariaSnapshot();
System.out.println(snapshot);
```

```csharp
var snapshot = await page.AriaSnapshotAsync();
Console.WriteLine(snapshot);
```

This command outputs the aria snapshot within the specified locator's scope in YAML format, which you can validate
or store as needed.

## Accessibility tree examples

### Headings with level attributes

Headings can include a `level` attribute indicating their heading level.

```html
<h1>Title</h1>
<h2>Subtitle</h2>
```

```yaml title="aria snapshot"
- heading "Title" [level=1]
- heading "Subtitle" [level=2]
```

### Text nodes

Standalone or descriptive text elements appear as text nodes.

```html
<div>Sample accessible name</div>
```

```yaml title="aria snapshot"
- text: Sample accessible name
```

### Inline multiline text

Multiline text, such as paragraphs, is normalized in the aria snapshot.

```html
<p>Line 1<br>Line 2</p>
```

```yaml title="aria snapshot"
- paragraph: Line 1 Line 2
```

### Links

Links display their text or composed content from pseudo-elements. The link’s destination may be matched using the
`/url` property.

```html
<a href="#more-info">Read more about Accessibility</a>
```

```yaml title="aria snapshot"
- link "Read more about Accessibility":
    - /url: "#more-info"
```

The value of `/url` may also be a regular expression:

```html
<a href="https://www.youtube.com/channel/UC46Zj8pDH5tDosqm1gd7WTg">YouTube channel</a>
```

```yaml title="aria snapshot"
- link:
  - /url: /https://www.youtube.com/channel/.*/
```

### Text boxes

Input elements of type `text` show their `value` attribute content.

```html
<input type="text" value="Enter your name">
```

```yaml title="aria snapshot"
- textbox: Enter your name
```

### Lists with items

Ordered and unordered lists include their list items.

```html
<ul aria-label="Main Features">
  <li>Feature 1</li>
  <li>Feature 2</li>
</ul>
```

```yaml title="aria snapshot"
- list "Main Features":
  - listitem: Feature 1
  - listitem: Feature 2
```

### Grouped elements

Groups capture nested elements, such as `<details>` elements with summary content.

```html
<details>
  <summary>Summary</summary>
  <p>Detail content here</p>
</details>
```

```yaml title="aria snapshot"
- group: Summary
```

### Attributes and states

Commonly used ARIA attributes, like `checked`, `disabled`, `expanded`, `invalid`, `level`, `pressed`, and `selected`, represent
control states.

#### Checkbox with `checked` attribute

```html
<input type="checkbox" checked>
```

```yaml title="aria snapshot"
- checkbox [checked]
```

#### Button with `pressed` attribute

```html
<button aria-pressed="true">Toggle</button>
```

```yaml title="aria snapshot"
- button "Toggle" [pressed=true]
```
