---
name: lit-docs-09
description: "Lit (renderer web components) — vendor doc 09/30 (packages)"
type: reference
---

## Providing good TypeScript typings {#typescript-typings}

TypeScript will infer the class of an HTML element returned from certain DOM
APIs based on the tag name. For example, `document.createElement('img')` returns
an `HTMLImageElement` instance with a `src: string` property.

Custom elements can get this same treatment by adding to the
`HTMLElementTagNameMap` as follows:

```ts
@customElement('my-element')
export class MyElement extends LitElement {
  @property({type: Number})
  aNumber: number = 5;
  /* ... */
}

declare global {
  interface HTMLElementTagNameMap {
    "my-element": MyElement;
  }
}
```

By doing this, the following code properly type-checks:

```ts
const myElement = document.createElement('my-element');
myElement.aNumber = 10;
```

We recommend adding an `HTMLElementTagNameMap` entry for all elements authored
in TypeScript, and ensuring you publish your `.d.ts` typings in your npm
package.


<!-- source: packages/lit-dev-content/site/docs/v3/components/events.md -->

---
title: Events
eleventyNavigation:
  key: Events
  parent: Components
  order: 7
versionLinks:
  v1: components/events/
  v2: components/events/
---

Events are the standard way that elements communicate changes. These changes typically occur due to user interaction. For example, a button dispatches a click event when a user clicks on it; an input dispatches a change event when the user enters a value in it.

In addition to these standard events that are automatically dispatched, Lit elements can dispatch custom events. For example, a menu element might dispatch an event to indicate the selected item changed; a popup element might dispatch an event when the popup opens or closes.

Any Javascript code, including Lit elements themselves, can listen for and take action based on events. For example, a toolbar element might filter a list when a menu item is selected; a login element might process a login when it handles a click on the login button.

## Listening to events

In addition to the standard `addEventListener` API, Lit introduces a declarative way to add event listeners.

### Adding event listeners in the element template

You can use `@` expressions in your template to add event listeners to elements in your component's template. Declarative event listeners are added when the template is rendered.

{% playground-example "v3-docs/components/events/child/" "my-element.ts" %}

#### Customizing event listener options {#event-options-decorator}

If you need to customize the event options used for a declarative event listener (like `passive` or `capture`), you can specify these on the listener using the `@eventOptions` decorator. The object passed to `@eventOptions` is passed as the `options` parameter to `addEventListener`.

```js
import {LitElement, html} from 'lit';
import {eventOptions} from 'lit/decorators.js';
//...
@eventOptions({passive: true})
private _handleTouchStart(e) { console.log(e.type) }
```

<div class="alert alert-info">

**Using decorators.** Decorators are a proposed JavaScript feature, so you’ll need to use a compiler like Babel or TypeScript to use decorators. See [Enabling decorators](/docs/v3/components/decorators/#enabling-decorators) for details.

</div>

If you're not using decorators, you can customize event listener options by passing an object to the event listener expression. The object must have a `handleEvent()` method and can include any the options that would normally appear in the `options` argument to `addEventListener()`.

[comment]: <> (The `raw` macro is necessary to prevent the double handlebar in the code sample from messing with the liquid templating syntax)
{% raw %}

```js
render() {
  return html`<button @click=${{handleEvent: () => this.onClick(), once: true}}>click</button>`
}
```

{% endraw %}

### Adding event listeners to the component or its shadow root

To be notified of an event dispatched from the component's slotted children as well as children rendered into shadow DOM via the component template, you can add a listener to the component itself using the standard `addEventListener` DOM method. See [EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) on MDN for full details.

The component constructor is a good place to add event listeners on the component.

```js
constructor() {
  super();
  this.addEventListener('click', (e) => console.log(e.type, e.target.localName));
}
```

Adding event listeners to the component itself is a form of event delegation and can be done to reduce code or improve performance. See [event delegation](#event-delegation) for details. Typically when this is done, the event's `target` property is used to take action based on which element fired the event.

However, events fired from the component's shadow DOM are retargeted when heard by an event listener on the component. This means the event target is the component itself. See [Working with events in shadow DOM](#shadowdom) for more information.

Retargeting can interfere with event delegation, and to avoid it, event listeners can be added to the component's shadow root itself. Since the `shadowRoot` is not available in the `constructor`, event listeners can be added in the `createRenderRoot` method as follows. Please note that it's important to make sure to return the shadow root from the `createRenderRoot` method.

{% playground-example "v3-docs/components/events/host/" "my-element.ts" %}

### Adding event listeners to other elements

If your component adds an event listener to anything except itself or its templated DOM – for example, to `Window`, `Document`, or some element in the main DOM – you should add the listener in `connectedCallback` and remove it in `disconnectedCallback`.

*   Removing the event listener in `disconnectedCallback` ensures that any memory allocated by your component will be cleaned up when your component is destroyed or disconnected from the page.

*   Adding the event listener in `connectedCallback` (instead of, for example, the constructor or `firstUpdated`) ensures that your component will re-create its event listener if it is disconnected and subsequently reconnected to DOM.

```js
connectedCallback() {
  super.connectedCallback();
  window.addEventListener('resize', this._handleResize);
}
disconnectedCallback() {
  window.removeEventListener('resize', this._handleResize);
  super.disconnectedCallback();
}
```

See the MDN documentation on using custom elements [lifecycle callbacks](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks) for more information on `connectedCallback` and `disconnectedCallback`.

### Optimizing for performance

Adding event listeners is extremely fast and typically not a performance concern. However, for components that are used in high frequency and need a lot of event listeners, you can optimize first render performance by reducing the number of listeners used via [event delegation](#event-delegation) and adding listeners [asynchronously](#async-events) after rendering.
