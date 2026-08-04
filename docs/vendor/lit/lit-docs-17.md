---
name: lit-docs-17
description: "Lit (renderer web components) — vendor doc 17/30 (packages)"
type: reference
---

## What happens when properties change {#when-properties-change}

A property change can trigger a reactive update cycle, which causes the component to re-render its template.

When a property changes, the following sequence occurs:

1.  The property's setter is called.
1.  The setter calls the component's `requestUpdate` method.
1.  The property's old and new values are compared.
    -  By default Lit uses a strict inequality test to determine if the value has changed (that is `newValue !== oldValue`).
    -  If the property has a `hasChanged` function, it's called with the property's old and new values.
1.  If the property change is detected, an update is scheduled asynchronously. If an update is already scheduled, only a single update is executed.
1.  The component's `update` method is called, reflecting changed properties to attributes and re-rendering the component's templates.

Note that if you mutate an object or array property, it won't trigger an update, because the object itself hasn't changed. For more information, see [Mutating object and array properties](#mutating-properties).

There are many ways to hook into and modify the reactive update cycle. For more information, see [Reactive update cycle](/docs/v3/components/lifecycle/#reactive-update-cycle).

For more information about property change detection, see [Customizing change detection](#haschanged).

### Mutating object and array properties {#mutating-properties}

Mutating an object or array doesn't change the object reference, so it won't trigger an update. You can handle object and array properties in one of two ways:

-   **Immutable data pattern.** Treat objects and arrays as immutable. For example, to remove an item from `myArray`, construct a new array:

    ```js
    this.myArray = this.myArray.filter((_, i) => i !== indexToRemove);
    ```

    While this example is simple, it's often helpful to use a library like [Immer](https://immerjs.github.io/immer/) to manage immutable data. This can help avoid tricky boilerplate code when setting deeply nested objects.

-   **Manually triggering an update.** Mutate the data and call `requestUpdate()` to trigger an update directly. For example:

    ```js
    this.myArray.splice(indexToRemove, 1);
    this.requestUpdate();
    ```

    When called with no arguments, `requestUpdate()` schedules an update, without calling a `hasChanged()` function. But note that `requestUpdate()` only causes the _current_ component to update. That is, if a component uses the code shown above, **and** the component passes `this.myArray` to a subcomponent, the subcomponent will detect that the array reference hasn't changed, so it won't update.

**In general, using top-down data flow with immutable objects is best for most applications.** It ensures that every component that needs to render a new value does (and does so as efficiently as possible, since parts of the data tree that didn't change won't cause components that rely on them to update).

Mutating data directly and calling `requestUpdate()` should be considered an advanced use case. In this case, you (or some other system) need to identify all the components that use the mutated data and call `requestUpdate()` on each one. When those components are spread across an application, this gets hard to manage. Not doing so robustly means that you might modify an object that's rendered in two parts of your application, but only have one part update.

In simple cases, when you know that a given piece of data is only used in a single component, it should be safe to mutate the data and call `requestUpdate()`, if you prefer.

## Attributes {#attributes}

While properties are great for receiving JavaScript data as input, attributes are the standard way HTML allows configuring elements from _markup_, without needing to use JavaScript to set properties. Providing both a property _and_ attribute interface for their reactive properties is a key way Lit components can be useful in a wide variety of environments, including those rendered without a client-side templating engine, such as static HTML pages served from CMSs.

By default, Lit sets up an observed attribute corresponding to each public reactive property, and updates the property when the attribute changes. Property values can also, optionally, be _reflected_ (written back to the attribute).

While element properties can be of any type, attributes are always strings. This impacts the [observed attributes](#observed-attributes) and [reflected attributes](#reflected-attributes) of non-string properties:

  * To **observe** an attribute (set a property from an attribute), the attribute value must be converted from a string to match the property type.

  * To **reflect** an attribute (set an attribute from a property), the property value must be converted to a string.

Boolean properties that expose an attribute should default to false. For more information, see [Boolean attributes](#boolean-attributes).

### Setting the attribute name {#observed-attributes}

By default, Lit creates a corresponding observed attribute for all public reactive properties. The name of the observed attribute is the property name, lowercased:

{% switchable-sample %}

```ts
// observed attribute name is "myvalue"
@property({ type: Number })
myValue = 0;
```

```js
// observed attribute name is "myvalue"
static properties = {
  myValue: { type: Number },
};

constructor() {
  super();
  this.myValue = 0;
}
```

{% endswitchable-sample %}

To create an observed attribute with a different name, set `attribute` to a string:

{% switchable-sample %}

```ts
// Observed attribute will be called my-name
@property({ attribute: 'my-name' })
myName = 'Ogden';
```

```js
// Observed attribute will be called my-name
static properties = {
  myName: { attribute: 'my-name' },
};

constructor() {
  super();
  this.myName = 'Ogden'
}
```

{% endswitchable-sample %}

To prevent an observed attribute from being created for a property, set `attribute` to `false`. The property will not be initialized from attributes in markup, and attribute changes won't affect it.

{% switchable-sample %}

```ts
// No observed attribute for this property
@property({ attribute: false })
myData = {};
```

```js
// No observed attribute for this property
static properties = {
  myData: { attribute: false },
};

constructor() {
  super();
  this.myData = {};
}
```

{% endswitchable-sample %}

Internal reactive state never has an associated attribute.

An observed attribute can be used to provide an initial value for a property from markup. For example:

```html
<my-element myvalue="99"></my-element>
```
