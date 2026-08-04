---
name: lit-docs-12
description: "Lit (renderer web components) — vendor doc 12/30 (packages)"
type: reference
---

#### Use cases

This callback is the main signal to the element that it may no longer be used; as such, `disconnectedCallback()` should ensure that nothing is holding a reference to the element (such as event listeners added to nodes external to the element), so that it is free to be garbage collected. Because elements may be re-connected after being disconnected, as in the case of an element moving in the DOM or caching, any such references or listeners may need to be re-established via `connectedCallback()` so that the element continues functioning as expected in these scenarios. For example, remove event listeners to nodes external to the element, like a keydown event handler added to the window.

```js
disconnectedCallback() {
  super.disconnectedCallback()
  window.removeEventListener('keydown', this._handleKeydown);
}
```

<div class="alert alert-info">

**No need to remove internal event listeners.** You don't need to remove event listeners added on the component's own DOM—including those added declaratively in your template. Unlike external event listeners, these won't prevent the component from being garbage collected.

</div>

### attributeChangedCallback() { %attributeChangedCallback }

Invoked when one of the element’s `observedAttributes` changes.

#### Lit behavior

Lit uses this callback to sync changes in attributes to reactive properties. Specifically, when an attribute is set, the corresponding property is set. Lit also automatically sets up the element’s `observedAttributes` array to match the component’s list of reactive properties.

#### Use cases

You rarely need to implement this callback.

### adoptedCallback() {#adoptedcallback}

Invoked when a component is moved to a new document.

<div class="alert alert-info">

Be aware that `adoptedCallback` is not polyfilled.

</div>

#### Lit behavior

Lit has no default behavior for this callback.

#### Use cases

This callback should only be used for advanced use cases when the element behavior should change when it changes documents.

## Reactive update cycle { #reactive-update-cycle }

In addition to the standard custom element lifecycle, Lit components also implement a reactive update cycle.

The reactive update cycle is triggered when a reactive property changes or when the `requestUpdate()` method is explicitly called. Lit performs updates asynchronously so property changes are batched — if more properties change after an update is requested, but before the update starts, all of the changes are captured in the same update.

Updates happen at microtask timing, which means they occur before the browser paints the next frame to the screen. See [Jake Archibald's article](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/) on microtasks for more information about browser timing.

At a high level, the reactive update cycle is:

1. An update is scheduled when one or more properties change or when `requestUpdate()` is called.
1. The update is performed prior to the next frame being painted.
    1. Reflecting attributes are set.
    1. The component’s render method is called to update its internal DOM.
1. The update is completed and the `updateComplete` promise is resolved.

In more detail, it looks like this:

**Pre-Update**

<img class="centered-image" src="/images/docs/components/update-1.jpg">

<p><img class="centered-image" src="/images/docs/components/update-2.jpg"></p>

**Update**

<img class="centered-image" src="/images/docs/components/update-3.jpg">

**Post-Update**

<img class="centered-image" src="/images/docs/components/update-4.jpg">

### The changedProperties map {#changed-properties}

Many reactive update methods receive a `Map` of changed properties. The `Map` keys are the property names and its values are the **previous** property values. You can always find the current property values using <code>this.<var>property</var></code> or <code>this[<var>property</var>]</code>.

#### TypeScript types for changedProperties

If you're using TypeScript and you want strong type checking for the `changedProperties` map, you can use `PropertyValues<this>`, which infers the correct type for each property name. 

```ts
import {LitElement, html, PropertyValues} from 'lit';
...
  shouldUpdate(changedProperties: PropertyValues<this>) {
    ...
  }
```

If you're less concerned with strong typing—or you're only checking the property names, not the previous values—you could use a less restrictive type like `Map<string, any>`.

Note that `PropertyValues<this>` doesn't recognize `protected` or `private` properties. If you're checking any `protected` or `private` properties, you'll need to use a less restrictive type.

#### Changing properties during an update {#changing-properties-during-an-update}

Changing a property *during* the update  (up to and including the `render()` method) updates the `changedProperties` map, but **doesn't** trigger a new update. Changing a property _after_ `render()` (for example, in the `updated()` method) triggers a new update cycle, and the changed property is added to a new `changedProperties` map to be used for the next cycle.

### Triggering an update {#reactive-update-cycle-triggering}

An update is triggered when a reactive property changes or the `requestUpdate()` method is called. Since updates are performed asynchronously, any and all changes that occur before the update is performed result in only a **single update**.

#### hasChanged() {#haschanged}

Called when a reactive property is set. By default `hasChanged()` does a strict equality check and if it returns `true`, an update is scheduled. See [configuring `hasChanged()`](/docs/v3/components/properties/#haschanged) for more information.

#### requestUpdate() {#requestUpdate}

Call `requestUpdate()` to schedule an explicit update. This can be useful if you need the element to update and render when something not related to a property changes. For example, a timer component might call `requestUpdate()` every second.

```js
connectedCallback() {
  super.connectedCallback();
  this._timerInterval = setInterval(() => this.requestUpdate(), 1000);
}

disconnectedCallback() {
  super.disconnectedCallback();
  clearInterval(this._timerInterval);
}
```

The list of properties that have changed is stored in a `changedProperties` map that’s passed to subsequent lifecycle methods. The map keys are the property names and its values are the previous property values.

Optionally, you can pass a property name and a previous value when calling `requestUpdate()`, which will be stored in the `changedProperties` map. This can be useful if you implement a custom getter and setter for a property. See [Reactive properties](/docs/v3/components/properties/) for more information about implementing custom getters and setters.

```js
  this.requestUpdate('state', this._previousState);
```

### Performing an update {#reactive-update-cycle-performing}

When an update is performed, the `performUpdate()` method is called. This method calls a number of other lifecycle methods.

Any changes that would normally trigger an update which occur **while** a component is updating do **not schedule a new update**. This is done so that property values can be computed during the update process. Properties changed during the update **are reflected in the `changedProperties` map**, so subsequent lifecycle methods can act on the changes.
