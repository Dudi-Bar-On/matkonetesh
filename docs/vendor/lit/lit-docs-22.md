---
name: lit-docs-22
description: "Lit (renderer web components) — vendor doc 22/30 (packages)"
type: reference
---

### Implementing `createRenderRoot`

The default implementation of `createRenderRoot` creates an open shadow root and adds to it any styles set in the `static styles` class field. For more information on styling see [Styles](/docs/v3/components/styles/).

To customize a component's render root, implement `createRenderRoot` and return the node you want the template to render into.

For example, to render the template into the main DOM tree as your element's children, implement `createRenderRoot` and return `this`.

<div class="alert alert-info">

**Rendering into children.** Rendering into children and not shadow DOM is generally not recommended. Your element will not have access to DOM or style scoping, and it will not be able to compose elements into its internal DOM.

</div>

{% playground-ide "v3-docs/components/shadowdom/renderroot/" %}


<!-- source: packages/lit-dev-content/site/docs/v3/components/styles.md -->

---
title: Styles
eleventyNavigation:
  key: Styles
  parent: Components
  order: 4
versionLinks:
  v1: components/styles/
  v2: components/styles/
---

Your component's template is rendered to its shadow root. The styles you add to your component are automatically _scoped_ to the shadow root and only affect elements in the component's shadow root.

Shadow DOM provides strong encapsulation for styling. If Lit did not use Shadow DOM, you would have to be extremely careful not to accidentally style elements outside of your component, either ancestors or children of your component. This might involve writing long, cumbersome to use class names. By using Shadow DOM, Lit ensures whatever selector you write only apply to elements in your Lit component's shadow root.

## Adding styles to your component {#add-styles}

You define scoped styles in the static `styles` class field using the tagged template literal `css` function. Defining styles this way results in the most optimal performance:

{% playground-example "v3-docs/components/style/basic" "my-element.ts" %}

The styles you add to your component are _scoped_ using shadow DOM. For a quick overview, see [Shadow DOM](#shadow-dom).

The value of the static `styles` class field can be:

*   A single tagged template literal.

    ```js
    static styles = css`...`;
    ```

*   An array of tagged template literals.

    ```js
    static styles = [ css`...`, css`...`];
    ```

The static `styles` class field is _almost always_ the best way to add styles to your component, but there are some use cases you can't handle this way—for example, customizing styles per instance. For alternate ways to add styles, see [Defining scoped styles in the template](#styles-in-the-template).


### Using expressions in static styles {#expressions}

Static styles apply to all instances of a component. Any expressions in CSS are evaluated **once**, then reused for all instances.

For tree-based or per-instance style customization, use CSS custom properties to allow elements to be [themed](#theming).

To prevent Lit components from evaluating potentially malicious code, the `css` tag only allows nested expressions that are themselves `css` tagged strings or numbers.

```js
const mainColor = css`red`;
...
static styles = css`
  div { color: ${mainColor} }
`;
```

This restriction exists to protect applications from security vulnerabilities whereby malicious styles, or even malicious code, can be injected from untrusted sources such as URL parameters or database values.

If you must use an expression in a `css` literal that is not itself a `css` literal, **and** you are confident that the expression is from a fully trusted source such as a constant defined in your own code, then you can wrap the expression with the `unsafeCSS` function:

```js
const mainColor = 'red';
...
static styles = css`
  div { color: ${unsafeCSS(mainColor)} }
`;
```

<div class="alert alert-info">

**Only use the `unsafeCSS` tag with trusted input.** Injecting unsanitized CSS is a security risk. For example, malicious CSS can "phone home" by adding an image URL that points to a third-party server.

</div>

### Inheriting styles from a superclass

Using an array of tagged template literals, a component can inherit the styles from a superclass, and add its own styles:

{% playground-ide "v3-docs/components/style/superstyles" %}

You can also use `super.styles` to reference the superclass's styles property in JavaScript. If you're using TypeScript, we recommend avoiding `super.styles` since the compiler doesn't always convert it correctly. Explicitly referencing the superclass, as shown in the example, avoids this issue.

When writing components intended to be subclassed in TypeScript, the `static styles` field should be explicitly typed as `CSSResultGroup` to allow flexibility for users to override `styles` with an array:

```ts
// Prevent typescript from narrowing the type of `styles` to `CSSResult`
// so that subclassers can assign e.g. `[SuperElement.styles, css`...`]`;
static styles: CSSResultGroup = css`...`;
```

### Sharing styles

You can share styles between components by creating a module that exports tagged styles:

```js
export const buttonStyles = css`
  .blue-button {
    color: white;
    background-color: blue;
  }
  .blue-button:disabled {
    background-color: grey;
  }`;
```

Your element can then import the styles and add them to its static `styles` class field:

```js
import { buttonStyles } from './button-styles.js';

class MyElement extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host { display: block;
        border: 1px solid black;
      }`
  ];
}
```

### Using unicode escapes in styles

CSS's unicode escape sequence is a backslash followed by four or six hex digits: for example, `\2022` for a bullet character. This similar to the format of JavaScript's deprecated _octal_ escape sequences, so using these sequences in a `css` tagged template literal causes an error.

There are two work-arounds for adding a unicode escape to your styles:

*   Add a second backslash (for example, `\\2022`).
*   Use the JavaScript escape sequence, starting with `\u` (for example, `\u2022`).

```js
static styles = css`
  div::before {
    content: '\u2022';
  }
```

## Shadow DOM styling overview {#shadow-dom}

This section gives a brief overview of shadow DOM styling.

Styles you add to a component can affect:

* [The shadow tree](#shadowroot) (your component's rendered template).
* [The component itself](#host).
* [The component's children](#slotted).


### Styling the shadow tree {#shadowroot}

Lit templates are rendered into a shadow tree by default. Styles scoped to an element's shadow tree don't affect the main document or other shadow trees. Similarly, with the exception of [inherited CSS properties](#inheritance), document-level styles don't affect the contents of a shadow tree.

When you use standard CSS selectors, they only match elements in your component's shadow tree. This means you can often use very simple selectors since you don't have to worry about them accidentally styling other parts of the page; for example: `input`, `*`, or `#my-element`.
