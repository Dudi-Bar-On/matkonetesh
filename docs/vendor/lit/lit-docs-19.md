---
name: lit-docs-19
description: "Lit (renderer web components) — vendor doc 19/30 (packages)"
type: reference
---

## Custom property accessors {#accessors}

By default, LitElement generates a getter/setter pair for all reactive properties. The setter is invoked whenever you set the property:

{% switchable-sample %}

```ts
// Declare a property
@property()
greeting: string = 'Hello';
...
// Later, set the property
this.greeting = 'Hola'; // invokes greeting's generated property accessor
```

```js
// Declare a property
static properties = {
  greeting: {},
}
constructor() {
  this.super();
  this.greeting = 'Hello';
}
...
// Later, set the property
this.greeting = 'Hola'; // invokes greeting's generated property accessor
```

{% endswitchable-sample %}

Generated accessors automatically call `requestUpdate()`, initiating an update if one has not already begun.

### Creating custom property accessors {#accessors-custom}

To specify how getting and setting works for a property, you can define your own getter/setter pair. For example:

{% switchable-sample %}

```ts
private _prop = 0;

@property()
set prop(val: number) {
  this._prop = Math.floor(val);
}

get prop() { return this._prop; }
```

```js
static properties = {
  prop: {},
};

_prop = 0;

set prop(val) {
  this._prop = Math.floor(val);
}

get prop() { return this._prop; }
```

{% endswitchable-sample %}

To use custom property accessors with the `@property` or `@state` decorators, put the decorator on the setter, as shown above. `@property` or `@state` decorated setters call `requestUpdate()`.

In most cases, **you do not need to create custom property accessors.** To compute values from existing properties, we recommend using the [`willUpdate`](/docs/v3/components/lifecycle/#willupdate) callback, which allows you to set values during the update cycle without triggering an additional update. To perform a custom action after the element updates, we recommend using the [`updated`](/docs/v3/components/lifecycle/#updated) callback. A custom setter can be used in rare cases when it's important to synchronously validate any value the user sets.

If your class defines its own accessors for a property, Lit will not overwrite them with generated accessors. If your class does not define accessors for a property, Lit will generate them, even if a superclass has defined the property or accessors.

### Prevent Lit from generating a property accessor {#accessors-noaccessor}

In rare cases, a subclass may need to change or add property options for a property that exists on its superclass.

To prevent Lit from generating a property accessor that overwrites the superclass's defined accessor, set `noAccessor` to `true` in the property declaration:

```js
static properties = {
  myProp: { type: Number, noAccessor: true }
};
```

You don't need to set `noAccessor` when defining your own accessors.

## Customizing change detection {#haschanged}

All reactive properties have a function, `hasChanged()`, which is called when the property is set.

`hasChanged` compares the property's old and new values, and evaluates whether or not the property has changed. If `hasChanged()` returns true, Lit starts an element update if one is not already scheduled. For more information on updates, see [Reactive update cycle](/docs/v3/components/lifecycle/#reactive-update-cycle) .

The default implementation of `hasChanged()` uses a strict inequality comparison: `hasChanged()` returns `true` if `newVal !== oldVal`.

To customize `hasChanged()` for a property, specify it as a property option:

{% switchable-sample %}

```ts
@property({
  hasChanged(newVal: string, oldVal: string) {
    return newVal?.toLowerCase() !== oldVal?.toLowerCase();
  }
})
myProp: string | undefined;
```

```js
static properties = {
  myProp: {
    hasChanged(newVal, oldVal) {
      return newVal?.toLowerCase() !== oldVal?.toLowerCase();
    }
  }
};
```

{% endswitchable-sample %}

In the following example, `hasChanged()` only returns true for odd values.

{% playground-example "properties/haschanged" "my-element.ts" %}


<!-- source: packages/lit-dev-content/site/docs/v3/components/rendering.md -->

---
title: Rendering
eleventyNavigation:
  key: Rendering
  parent: Components
  order: 2
versionLinks:
  v1: components/templates/
  v2: components/rendering/
---

Add a template to your component to define what it should render. Templates can include _expressions_, which are placeholders for dynamic content.

To define a template for a Lit component, add a `render()` method:

{% playground-example "v3-docs/templates/define" "my-element.ts" %}

Write your template in HTML inside a JavaScript [tagged template literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) using Lit's [`html`](/docs/v3/api/templates/#html) tag function.

Lit templates can include JavaScript _expressions_. You can use expressions to set text content, attributes, properties, and event listeners. The `render()` method can also include any JavaScript—for example, you can create local variables for use in expressions.

## Renderable values { #renderable-values }

Typically, the component's `render()` method returns a single `TemplateResult` object (the same type returned by the `html` tag function). However, it can return anything that Lit can render as the child of an HTML element:

*   Primitive values like string, number, or boolean.
*   `TemplateResult` objects created by the `html` function.
*   DOM Nodes.
*   The sentinel values [`nothing`](/docs/v3/templates/conditionals/#conditionally-rendering-nothing) and [`noChange`](/docs/v3/templates/custom-directives/#signaling-no-change).
*   Arrays or iterables of any of the supported types.

This is *almost identical* to the set of values that can be rendered to a Lit [child expression](/docs/v3/templates/expressions/#child-expressions). The one difference is that a child expression can render an `SVGTemplateResult`, returned by the [`svg`](/docs/v3/api/templates/#svg) function. This kind of template result can only be rendered as the descendant of an `<svg>` element.

## Writing a good render() method

To take best advantage of Lit's functional rendering model, your `render()` method should follow these guidelines:

* Avoid changing the component's state.
* Avoid producing any side effects.
* Use only the component's properties as input.
* Return the same result when given the same property values.

Following these guidelines keeps the template deterministic, and makes it easier to reason about the code.

In most cases you should avoid making DOM updates outside of `render()`. Instead, express the component's template as a function of its state, and capture its state in properties.

For example, if your component needs to update its UI when it receives an event, have the event listener set a reactive property that is used in `render()`, rather than manipulate the DOM directly.

For more information, see [Reactive properties](/docs/v3/components/properties/).
