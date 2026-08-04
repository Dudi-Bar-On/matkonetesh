---
name: lit-docs-15
description: "Lit (renderer web components) — vendor doc 15/30 (packages)"
type: reference
---

#### static addInitializer() {#addInitializer}

`addInitializer()` allows code that has access to a Lit class definition to run code when instances of the class are constructed.

This is very useful when writing custom decorators. Decorators are run at class definition time, and can do things like replace field and method definitions. If they also need to do work when an instance is created, they must call `addInitializer()`. It will be common to use this to add a [reactive controller](/docs/v3/composition/controllers/) so decorators can hook into the component lifecycle:

{% switchable-sample %}

```ts
// A TypeScript decorator
const myDecorator = (proto: ReactiveElement, key: string) => {
  const ctor = proto.constructor as typeof ReactiveElement;

  ctor.addInitializer((instance: ReactiveElement) => {
    // This is run during construction of the element
    new MyController(instance);
  });
};
```

```js
// A Babel "Stage 2" decorator
const myDecorator = (descriptor) => {
  ...descriptor,
  finisher(ctor) {
    ctor.addInitializer((instance) => {
      // This is run during construction of the element
      new MyController(instance);
    });
  },
};
```

{% endswitchable-sample %}


Decorating a field will then cause each instance to run an initializer
that adds a controller:

```ts
class MyElement extends LitElement {
  @myDecorator foo;
}
```

Initializers are stored per-constructor. Adding an initializer to a
subclass does not add it to a superclass. Since initializers are run in
constructors, initializers will run in order of the class hierarchy,
starting with superclasses and progressing to the instance's class.

#### addController() {#addController}

`addController()` adds a reactive controller to a Lit component so that the component invokes the controller's lifecycle callbacks. See the [Reactive Controller](/docs/v3/composition/controllers/) docs for more information.

#### removeController() {#removeController}

`removeController()` removes a reactive controller so it no longer receives lifecycle callbacks from this component.

## Server-side reactive update cycle {#server-reactive-update-cycle}

<div class="alert alert-info">

Lit's [server-side rendering package](/docs/v3/ssr/overview/) is currently under active development so the following information is subject to change.

</div>

Not all of the update cycle is called when rendering Lit on the server. The following methods are called on the server.

<img class="centered-image" src="/images/docs/components/update-server.jpg">

<p><!-- Add some space --></p>


<!-- source: packages/lit-dev-content/site/docs/v3/components/properties.md -->

---
title: Reactive properties
eleventyNavigation:
  key: Reactive properties
  parent: Components
  order: 3
versionLinks:
  v1: components/properties/
  v2: components/properties/
---

Lit components receive input and store their state as JavaScript class fields or properties. *Reactive properties* are properties that can trigger the reactive update cycle when changed, re-rendering the component, and optionally be read or written to attributes.

{% switchable-sample %}

```ts
class MyElement extends LitElement {
  @property()
  name?: string;
}
```

```js
class MyElement extends LitElement {
  static properties = {
    name: {},
  };
}
```

{% endswitchable-sample %}

Lit manages your reactive properties and their corresponding attributes. In particular:

*   **Reactive updates**. Lit generates a getter/setter pair for each reactive property. When a reactive property changes, the component schedules an update.
*   **Attribute handling**. By default, Lit sets up an observed attribute corresponding to the property, and updates the property when the attribute changes. Property values can also, optionally, be _reflected_ back to the attribute.
*   **Superclass properties**. Lit automatically applies property options declared by a superclass. You don't need to redeclare properties unless you want to change options.
*   **Element upgrade**. If a Lit component is defined after the element is already in the DOM, Lit handles upgrade logic, ensuring that any properties set on an element before it was upgraded trigger the correct reactive side effects when the element upgrades.

## Public properties and internal state

Public properties are part of the component's public API. In general, public properties—especially public reactive properties—should be treated as _input_.

The component shouldn't change its own public properties, except in response to user input. For example, a menu component might have a public `selected` property that can be initialized to a given value by the owner of the element, but that is updated by the component itself when the user selects an item. In these instances, the component should dispatch an event to indicate to the component's owner that the `selected` property changed. See [Dispatching events](/docs/v3/components/events/#dispatching-events) for more details.

Lit also supports _internal reactive state_. Internal reactive state refers to reactive properties that _aren't_ part of the component's API. These properties don't have a corresponding attribute, and are typically marked protected or private in TypeScript.

{% switchable-sample %}

```ts
@state()
private _counter = 0;
```

```js
static properties = {
  _counter: {state: true}
};

constructor() {
  super();
  this._counter = 0;
}
```

{% endswitchable-sample %}

The component manipulates its own internal reactive state.
In some cases, internal reactive state may be initialized from public properties—for example, if there is an expensive transformation between the user-visible property and the internal state.

As with public reactive properties, updating internal reactive state triggers an update cycle. For more information, see [Internal reactive state](#internal-reactive-state).

## Public reactive properties {#declare}

Declare your element's public reactive properties using decorators or the static `properties` field.

In either case, you can pass an options object to configure features for the property.

### Declaring properties with decorators {#declare-with-decorators}

Use the `@property` decorator with a class field declaration to declare a reactive property.

```ts
class MyElement extends LitElement {
  @property({type: String})
  mode?: string;

  @property({attribute: false})
  data = {};
}
```

The argument to the `@property`  decorators is an [options object](#property-options). Omitting the argument is equivalent to specifying the default value for all options.

<div class="alert alert-info">

**Using decorators.** Decorators are a proposed JavaScript feature, so you'll need to use a compiler like Babel or the TypeScript compiler to use decorators. See [Enabling decorators](/docs/v3/components/decorators/#enabling-decorators) for details.

</div>

### Declaring properties in a static properties class field

To declare properties in a static `properties` class field:

```js
class MyElement extends LitElement {
  static properties = {
    mode: {type: String},
    data: {attribute: false},
  };

  constructor() {
    super();
    this.data = {};
  }
}
```

An empty option object is equivalent to specifying the default value for all options.
