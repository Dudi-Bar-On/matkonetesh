---
name: lit-docs-11
description: "Lit (renderer web components) — vendor doc 11/30 (packages)"
type: reference
---

### Understanding composed event dispatching {#shadowdom-composed}

By default, an event dispatched inside a shadow root will not be visible outside that shadow root. To make an event pass through shadow DOM boundaries, you must set the [`composed` property](https://developer.mozilla.org/en-US/docs/Web/API/Event/composed) to `true`. It's common to pair `composed` with `bubbles` so that all nodes in the DOM tree can see the event:

```js
_dispatchMyEvent() {
  let myEvent = new CustomEvent('my-event', {
    detail: { message: 'my-event happened.' },
    bubbles: true,
    composed: true });
  this.dispatchEvent(myEvent);
}
```

If an event is `composed` and does `bubble`, it can be received by all ancestors of the element that dispatches the event—including ancestors in outer shadow roots. If an event is `composed` but does not `bubble`, it can only be received on the element that dispatches the event and on the host element containing the shadow root.

Note that most standard user interface events, including all mouse, touch, and keyboard events, are both bubbling and composed. See the [MDN documentation on composed events](https://developer.mozilla.org/en-US/docs/Web/API/Event/composed) for more information.

### Understanding event retargeting {#shadowdom-retargeting}

[Composed](#shadowdom-composed) events dispatched from within a shadow root are retargeted, meaning that to any listener on an element hosting a shadow root or any of its ancestors, they appear to come from the hosting element. Since Lit components render into shadow roots, all composed events dispatched from inside a Lit component appear to be dispatched by the Lit component itself. The event's `target` property is the Lit component.

```html
<my-element onClick="(e) => console.log(e.target)"></my-element>
```

```js
render() {
  return html`
    <button id="mybutton" @click="${(e) => console.log(e.target)}">
      click me
    </button>`;
}
```

In advanced cases where it is required to determine the origin of an event, use the `event.composedPath()` API. This method returns an array of all the nodes traversed by the event dispatch, including those within shadow roots. Because this breaks encapsulation, care should be taken to avoid relying on implementation details that may be exposed.  Common use cases include determining if the element clicked was an anchor tag, for purposes of client-side routing.

```js
handleMyEvent(event) {
  console.log('Origin: ', event.composedPath()[0]);
}
```
See the [MDN documentation on composedPath](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath) for more information.

## Communicating between the event dispatcher and listener

Events exist primarily to communicate changes from the event dispatcher to the event listener, but events can also be used to communicate information from the listener back to the dispatcher.

One way you can do this is to expose API on events which listeners can use to customize component behavior. For example, a listener can set a property on a custom event's detail property which the dispatching component then uses to customize behavior.

Another way to communicate between the dispatcher and listener is via the `preventDefault()` method. It can be called to indicate the event's standard action should not occur. When the listener calls `preventDefault()`, the event's `defaultPrevented` property becomes true. This flag can then be used by the listener to customize behavior.

Both of these techniques are used in the following example:

{% playground-ide "v3-docs/components/events/comm/" "my-listener.ts" %}


<!-- source: packages/lit-dev-content/site/docs/v3/components/lifecycle.md -->

---
title: Lifecycle
eleventyNavigation:
  key: Lifecycle
  parent: Components
  order: 5
versionLinks:
  v1: components/lifecycle/
  v2: components/lifecycle/
---

Lit components use the standard custom element lifecycle methods. In addition Lit introduces a reactive update cycle that renders changes to DOM when reactive properties change.

## Standard custom element lifecycle { #custom-element-lifecycle }
Lit components are standard custom elements and inherit the custom element lifecycle methods. For information about the custom element lifecycle, see [Using the lifecycle callbacks](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#using_the_lifecycle_callbacks) on MDN.

<div class="alert alert-info">

If you need to customize any of the standard custom element lifecycle methods, make sure to call the `super` implementation (such as `super.connectedCallback()`) so the standard Lit functionality is maintained.

</div>

### constructor() {#constructor}

Called when an element is created. Also, it’s invoked when an existing element is upgraded, which happens when the definition for a custom element is loaded after the element is already in the DOM.

#### Lit behavior

Requests an asynchronous update using the `requestUpdate()` method, so when a Lit component gets upgraded, it performs an update immediately.

Saves any properties already set on the element. This ensures values set before upgrade are maintained and correctly override defaults set by the component.

#### Use cases

Perform one time initialization tasks that must be done before the first [update](#reactive-update-cycle). For example, when not using decorators, default values for properties can be set in the constructor, as shown in [Declaring properties in a static properties field](/docs/v3/components/properties/#declaring-properties-in-a-static-properties-field).

```js
constructor() {
  super();
  this.foo = 'foo';
  this.bar = 'bar';
}
```
### connectedCallback() {#connectedcallback}

Invoked when a component is added to the document's DOM.

#### Lit behavior

Lit initiates the first element update cycle after the element is connected. In preparation for rendering, Lit also ensures the `renderRoot` (typically, its `shadowRoot`) is created.

Once an element has connected to the document at least once, component updates will proceed regardless of the connection state of the element.

#### Use cases

In `connectedCallback()` you should setup tasks that should only occur when the element is connected to the document. The most common of these is adding event listeners to nodes external to the element, like a keydown event handler added to the window. Typically, anything done in `connectedCallback()` should be undone when the element is disconnected — for example, removing event listeners on window to prevent memory leaks.

```js
connectedCallback() {
  super.connectedCallback()
  window.addEventListener('keydown', this._handleKeydown);
}
```
### disconnectedCallback() {#disconnectedcallback}

Invoked when a component is removed from the document's DOM.

#### Lit behavior

Pauses the [reactive update cycle](#reactive-update-cycle). It is resumed when the element is connected.
