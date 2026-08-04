---
name: lit-docs-25
description: "Lit (renderer web components) — vendor doc 25/30 (packages)"
type: reference
---

## Passing data across the tree

Properties down and events up is a good rule to start with. But what if you need to exchange data between two components that don't have a direct descendant relationship? For example, two components that are siblings in the shadow tree?

One solution to this problem is to use the _mediator pattern_. In the mediator pattern, peer components don't communicate with each other directly. Instead, interactions are _mediated_ by a third party.

A simple way to implement the mediator pattern is by having the owning component handle events from its children, and in turn update the state of its children as necessary by passing changed data back down the tree. By adding a mediator, you can pass data across the tree using the familiar events-up, properties-down principle.

In the following example, the mediator element listens for events from the input and button elements in its shadow DOM. It controls the enabled state of the button so the user can only click **Submit** when there's text in the input.

{% playground-example "v3-docs/composition/mediator-pattern" "mediator-element.ts" %}

Other mediator patterns include flux/Redux-style patterns where a store mediates changes and updates components via subscriptions. Having components directly subscribe to changes can help avoid needing every parent to pass along all data required by its children.

## Light DOM children

In addition to the nodes in your shadow DOM, you can render child nodes provided by the component user, like the standard `<select>` element can take a set of `<option>` elements as children and render them as menu items.

Child nodes are sometimes referred to as "light DOM" to distinguish them from the component's shadow DOM. For example:

```html
<top-bar>
  <icon-button icon="menu" slot="nav-button"></icon-button>
  <span slot="title">Fuzzy</span>
</top-bar>
```


Here the `top-bar` element has two light DOM children supplied by the user: a navigation button, and a title.

Interacting with light DOM children is different from interacting with nodes in the shadow DOM. Nodes in a component's shadow DOM are managed by the component, and shouldn't be accessed from outside the component. Light DOM children are managed from outside the component, but can be accessed by the component as well. The component's user can add or remove light DOM children at any time, so the component can't assume a static set of child nodes.

The component has control over whether and where the child nodes are rendered, using the `<slot>` element in its shadow DOM. And it can receive notifications when child nodes are added and removed by listening for the `slotchange` event.

For more information, see the sections on [rendering children with slots](/docs/v3/components/shadow-dom/#slots) and [accessing slotted children](/docs/v3/components/shadow-dom/#accessing-slotted-children).


_Meerkat photo by [Anggit Rizkianto](https://unsplash.com/@anggit_mr) on [Unsplash](https://unsplash.com/photos/x3-OP_X0aH0)._


<!-- source: packages/lit-dev-content/site/docs/v3/composition/controllers.md -->

---
title: Reactive Controllers
eleventyNavigation:
  parent: Composition
  key: Controllers
  order: 4
versionLinks:
  v2: composition/controllers/
---

A reactive controller is an object that can hook into a component's [reactive update cycle](/docs/v3/components/lifecycle/#reactive-update-cycle). Controllers can bundle state and behavior related to a feature, making it reusable across multiple component definitions.

You can use controllers to implement features that require their own state and access to the component's lifecycle, such as:

* Handling global events like mouse events
* Managing asynchronous tasks like fetching data over the network
* Running animations


Reactive controllers allow you to build components by composing smaller pieces that aren't themselves components. They can be thought of as reusable, partial component definitions, with their own identity and state.

{% playground-ide "v3-docs/controllers/overview" "clock-controller.ts" %}

Reactive controllers are similar in many ways to class mixins. The main difference is that they have their own identity and don't add to the component's prototype, which helps contain their APIs and lets you use multiple controller instances per host component. See [Controllers and mixins](/docs/v3/composition/overview/#controllers-and-mixins) for more details.

## Using a controller

Each controller has its own creation API, but typically you will create an instance and store it with the component:

```ts
class MyElement extends LitElement {
  private clock = new ClockController(this, 1000);
}
```

The component associated with a controller instance is called the host component.

The controller instance registers itself to receive lifecycle callbacks from the host component, and triggers a host update when the controller has new data to render. This is how the `ClockController` example periodically renders the current time.

A controller will typically expose some functionality to be used in the host's `render()` method. For example, many controllers will have some state, like a current value:

```ts
  render() {
    return html`
      <div>Current time: ${this.clock.value}</div>
    `;
  }
```

Since each controller has it's own API, refer to specific controller documentation on how to use them.

## Writing a controller

A reactive controller is an object associated with a host component, which implements one or more host lifecycle callbacks or interacts with its host. It can be implemented in a number of ways, but we'll focus on using JavaScript classes, with constructors for initialization and methods for lifecycles.

### Controller initialization

A controller registers itself with its host component by calling `host.addController(this)`. Usually a controller stores a reference to its host component so that it can interact with it later.

{% switchable-sample %}

```ts
class ClockController implements ReactiveController {
  private host: ReactiveControllerHost;

  constructor(host: ReactiveControllerHost) {
    // Store a reference to the host
    this.host = host;
    // Register for lifecycle updates
    host.addController(this);
  }
}
```

```js
class ClockController {
  constructor(host) {
    // Store a reference to the host
    this.host = host;
    // Register for lifecycle updates
    host.addController(this);
  }
}
```

{% endswitchable-sample %}

You can add other constructor parameters for one-time configuration.

{% switchable-sample %}

```ts
class ClockController implements ReactiveController {
  private host: ReactiveControllerHost;
  timeout: number

  constructor(host: ReactiveControllerHost, timeout: number) {
    this.host = host;
    this.timeout = timeout;
    host.addController(this);
  }
```

```js
class ClockController {
  constructor(host, timeout) {
    this.host = host;
    this.timeout = timeout;
    host.addController(this);
  }
```

{% endswitchable-sample %}


Once your controller is registered with the host component, you can add lifecycle callbacks and other class fields and methods to the controller to implement the desired state and behavior.
