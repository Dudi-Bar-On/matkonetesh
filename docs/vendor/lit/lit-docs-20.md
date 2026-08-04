---
name: lit-docs-20
description: "Lit (renderer web components) — vendor doc 20/30 (packages)"
type: reference
---

## Composing templates

You can compose Lit templates from other templates. The following example composes a template for a component called `<my-page>` from smaller templates for the page's header, footer, and main content:

{% playground-example "v3-docs/templates/compose" "my-page.ts" %}

In this example, the individual templates are defined as instance methods, so a subclass could extend this component and override one or more templates.

{% todo %}

Move example to composition section, add xref.

{% endtodo %}

You can also compose templates by importing other elements and using them in your template:

{% playground-ide "v3-docs/templates/composeimports" %}


## When templates render

A Lit component renders its template initially when it's added to the DOM on a page. After the initial render, any change to the component's reactive properties triggers an update cycle, re-rendering the component.

Lit batches updates to maximize performance and efficiency. Setting multiple properties at once triggers only one update, performed asynchronously at microtask timing.

During an update, only the parts of the DOM that change are re-rendered. Although Lit templates look like string interpolation, Lit parses and creates static HTML once, and then only updates changed values in expressions after that, making updates very efficient.

For more information about the update cycle, see [What happens when properties change](/docs/v3/components/properties/#when-properties-change).

## DOM encapsulation

Lit uses shadow DOM to encapsulate the DOM a component renders. Shadow DOM lets an element create its own, isolated DOM tree that's separate from the main document tree. It's a core feature of the web components specifications that enables interoperability, style encapsulation, and other benefits.

For more information about shadow DOM, see [Shadow DOM v1: Self-Contained Web Components
](https://developers.google.com/web/fundamentals/web-components/shadowdom) on Web Fundamentals.

For more information about working with shadow DOM in your component, see [Working with shadow DOM](/docs/v3/components/shadow-dom/).

## See also

* [Shadow DOM](/docs/v3/components/shadow-dom/)
* [Templates overview](/docs/v3/templates/overview/)
* [Template expressions](/docs/v3/templates/expressions/)


<!-- source: packages/lit-dev-content/site/docs/v3/components/shadow-dom.md -->

---
title: Working with Shadow DOM
eleventyNavigation:
  key: Shadow DOM
  parent: Components
  order: 6
versionLinks:
  v1: components/templates/#accessing-nodes-in-the-shadow-dom
  v2: components/shadow-dom/
---

Lit components use [shadow DOM](https://developers.google.com/web/fundamentals/web-components/shadowdom) to encapsulate their DOM. Shadow DOM provides a way to add a separate isolated and encapsulated DOM tree to an element. DOM encapsulation is the key to unlocking interoperability with any other code—including other web components or Lit components—functioning on the page.

Shadow DOM provides three benefits:

* DOM scoping. DOM APIs like `document.querySelector` won't find elements in the
  component's shadow DOM, so it's harder for global scripts to accidentally break your component.
* Style scoping. You can write encapsulated styles for your shadow DOM that don't
  affect the rest of the DOM tree.
* Composition. The component's shadow root, which contains its internal DOM, is separate from the component's children. You can choose how children are rendered in your component's internal DOM.

For more information on shadow DOM:

* [Shadow DOM v1: Self-Contained Web Components](https://developers.google.com/web/fundamentals/web-components/shadowdom) on Web Fundamentals.
* [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) on MDN.


<div class="alert alert-info">

**Older browsers.** On older browsers where native shadow DOM isn't available, the [web components polyfills](https://github.com/webcomponents/polyfills/tree/master/packages/webcomponentsjs) may be used. Please note that Lit's `polyfill-support` module must be loaded along with the web components polyfills. See [Requirements for legacy browsers](/docs/v3/tools/requirements/#building-for-legacy-browsers) for details.

</div>

## Accessing nodes in the shadow DOM


Lit renders components to its `renderRoot`, which is a shadow root by default. To find internal elements, you can use DOM query APIs, such as `this.renderRoot.querySelector()`.

The `renderRoot` should always be either a shadow root or an element, which share APIs like `.querySelectorAll()` and `.children`.

You can query internal DOM after component initial render (for example, in `firstUpdated`), or use a getter pattern:

```js
firstUpdated() {
  this.staticNode = this.renderRoot.querySelector('#static-node');
}

get _closeButton() {
  return this.renderRoot.querySelector('#close-button');
}
```

LitElement supplies a set of decorators that provide a shorthand way of defining getters like this.

### @query, @queryAll, and @queryAsync decorators

The `@query`, `@queryAll`, and `@queryAsync` decorators all provide a convenient way to access nodes in the internal component DOM.

<div class="alert alert-info">

**Using decorators.** Decorators are a proposed JavaScript feature, so you’ll need to use a compiler like Babel or TypeScript to use decorators. See [Using decorators](/docs/v3/components/decorators/) for details.

</div>

#### @query { #query }

Modifies a class property, turning it into a getter that returns a node from the render root. The optional second argument when true performs the DOM query only once and caches the result. This can be used as a performance optimization in cases when the node being queried will not change.

```js
import {LitElement, html} from 'lit';
import {query} from 'lit/decorators/query.js';

class MyElement extends LitElement {
  @query('#first')
  _first;

  render() {
    return html`
      <div id="first"></div>
      <div id="second"></div>
    `;
  }
}
```

This decorator is equivalent to:

```js
get _first() {
  return this.renderRoot?.querySelector('#first') ?? null;
}
```

#### @queryAll { #query-all }

Identical to `query` except that it returns all matching nodes, instead of a single node. It's the equivalent of calling `querySelectorAll`.

```js
import {LitElement, html} from 'lit';
import {queryAll} from 'lit/decorators/queryAll.js';

class MyElement extends LitElement {
  @queryAll('div')
  _divs;

  render() {
    return html`
      <div id="first"></div>
      <div id="second"></div>
    `;
  }
}
```

Here, `_divs` would return both `<div>` elements in the template. For TypeScript, the typing of a `@queryAll` property is `NodeListOf<HTMLElement>`. If you know exactly what kind of nodes you'll retrieve, the typing can be more specific:

```js
@queryAll('button')
_buttons!: NodeListOf<HTMLButtonElement>
```

The exclamation point (`!`) after `buttons` is TypeScript's [non-null assertion operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator). It tells the compiler to treat `buttons` as always being defined, never `null` or `undefined`.
