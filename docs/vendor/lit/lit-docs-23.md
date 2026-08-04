---
name: lit-docs-23
description: "Lit (renderer web components) — vendor doc 23/30 (packages)"
type: reference
---

### Styling the component itself {#host}

You can style the component itself using special `:host` selectors. (The element that owns, or "hosts" a shadow tree is called the _host element_.)

To create default styles for the host element, use the `:host` CSS pseudo-class and `:host()` CSS pseudo-class function.

*   `:host` selects the host element.
*   <code>:host(<var>selector</var>)</code> selects the host element, but only if the host element matches _selector_.

{% playground-example "v3-docs/components/style/host" "my-element.ts" %}

Note that the host element can be affected by styles from outside the shadow tree, as well, so you should consider the styles you set in `:host` and `:host()` rules as _default styles_ that can be overridden by the user. For example:

```css
my-element {
  display: inline-block;
}
```

### Styling the component's children {#slotted}

Your component may accept children (like a `<ul>` element can have `<li>` children). To render children, your template needs to include one or more `<slot>` elements, as described in [Render children with the slot element](/docs/v3/components/shadow-dom/#slots).

The `<slot>` element acts as a placeholder in a shadow tree where the host element's children are displayed.

Use the `::slotted()` CSS pseudo-element to select children that are included in your template via `<slot>`s.

*   `::slotted(*)` matches all slotted elements.
*   `::slotted(p)` matches slotted paragraphs.
*   `p ::slotted(*)` matches slotted elements where the `<slot>` is a descendant of a paragraph element.

{% playground-example "v3-docs/components/style/slottedselector" "my-element.ts" %}

Note that **only direct slotted children** can be styled with `::slotted()`.

```html
<my-element>
  <div>Stylable with ::slotted()</div>
</my-element>

<my-element>
  <div><p>Not stylable with ::slotted()</p></div>
</my-element>
```

Also, children can be styled from outside the shadow tree, so you should regard your `::slotted()` styles as default styles that can be overridden.

```css
my-element > div {
  /* Outside style targetting a slotted child can override ::slotted() styles */
}
```

<div class="alert alert-info">

**Limitations in the ShadyCSS polyfill around slotted content.** See the [ShadyCSS limitations](https://github.com/webcomponents/polyfills/tree/master/packages/shadycss#limitations) for details on how to use the `::slotted()` syntax in a polyfill-friendly way.

</div>

## Defining scoped styles in the template {#styles-in-the-template}

We recommend using the [static `styles` class field](#add-styles) for optimal performance.  However, sometimes you may want to define styles in the Lit template. There are two ways to add scoped styles in the template:

*   Add styles using a [`<style>` element](#style-element).
*   Add styles using an [external style sheet](#external-stylesheet) (not recommended).

Each of these techniques has its own set of advantages and drawbacks.

### In a style element {#style-element}

Typically, styles are placed in the [static `styles` class field](#add-styles); however, the element's static `styles` are evaluated **once per class**. Sometimes, you might need to customize styles **per instance**. For this, we recommend using CSS properties to create [themable elements](#theming). Alternatively, you can also include `<style>` elements in a Lit template. These are updated per instance.

```js
render() {
  return html`
    <style>
      /* updated per instance */
    </style>
    <div>template content</div>
  `;
}
```

<div class="alert alert-info">

**Limitations in the ShadyCSS polyfill around per instance styling.** Per instance styling is not supported using the ShadyCSS polyfill. See the [ShadyCSS limitations](https://github.com/webcomponents/polyfills/tree/master/packages/shadycss#limitations) for details.

</div>

#### Expressions and style elements

Using expressions inside style elements has some important limitations and performance issues.

```js
render() {
  return html`
    <style>
      :host {
        /* Warning: this approach has limitations & performance issues! */
        color: ${myColor}
      }
    </style>
    <div>template content</div>
  `;
}
```

<div class="alert alert-info">

**Limitations in the ShadyCSS polyfill around expressions.** Expressions in `<style>` elements won't update per instance in ShadyCSS, due to limitations of the ShadyCSS polyfill. In addition, `<style>` nodes may not be passed as expression values when using the ShadyCSS polyfill. See the [ShadyCSS limitations](https://github.com/webcomponents/polyfills/tree/master/packages/shadycss#limitations) for more information.

</div>

Evaluating an expression inside a `<style>` element is extremely inefficient. When any text inside a `<style>` element changes, the browser must re-parse the whole `<style>` element, resulting in unnecessary work.

To mitigate this cost, separate styles that require per-instance evaluation from those that don't.

```js
  static styles = css`/* ... */`;
  render() {
    const redStyle = html`<style> :host { color: red; } </style>`;
    return html`${this.red ? redStyle : ''}`

```

### Import an external stylesheet (not recommended) {#external-stylesheet}

While you can include an external style sheet in your template with a `<link>`, we do not recommend this approach. Instead, styles should be placed in the [static `styles` class field](#add-styles).

<div class="alert alert-info">

**External stylesheet caveats.**

*  The [ShadyCSS polyfill](https://github.com/webcomponents/polyfills/tree/master/packages/shadycss#limitations) doesn't support external style sheets.
*   External styles can cause a flash-of-unstyled-content (FOUC) while they load.
*   The URL in the `href` attribute is relative to the **main document**. This is okay if you're building an app and your asset URLs are well-known, but avoid using external style sheets when building a reusable element.

</div>

## Dynamic classes and styles

One way to make styles dynamic is to add expressions to the `class` or `style` attributes in your template.

Lit offers two directives, `classMap` and `styleMap`, to conveniently apply classes and styles in HTML templates.

For more information on these and other directives, see the documentation on [built-in directives](/docs/v3/templates/directives/).

To use `styleMap` and/or `classMap`:

1.  Import `classMap` and/or `styleMap`:

    ```js
    import { classMap } from 'lit/directives/class-map.js';
    import { styleMap } from 'lit/directives/style-map.js';
    ```

2.  Use `classMap` and/or `styleMap` in your element template:

{% playground-example "v3-docs/components/style/maps" "my-element.ts" %}

See [classMap](/docs/v3/templates/directives/#classmap) and [styleMap](/docs/v3/templates/directives/#stylemap) for more information.

## Theming {#theming}

By using [CSS inheritance](#inheritance) and [CSS variables and custom properties](#customprops) together, it's easy to create themable elements. By applying css selectors to customize CSS custom properties, tree-based and per-instance theming is straightforward to apply. Here's an example:

{% playground-example "v3-docs/components/style/theming" "my-element.ts" %}
