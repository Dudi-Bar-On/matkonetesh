---
name: lit-docs-10
description: "Lit (renderer web components) — vendor doc 10/30 (packages)"
type: reference
---

#### Event delegation { #event-delegation }

Using event delegation can reduce the number of event listeners used and therefore improve performance. It is also sometimes convenient to centralize event handling to reduce code. Event delegation can only be use to handle events that `bubble`. See [Dispatching events](#dispatching-events) for details on bubbling.

Bubbling events can be heard on any ancestor element in the DOM. You can take advantage of this by adding a single event listener on an ancestor component to be notified of a bubbling event dispatched by any of its descendants in the DOM. Use the event's `target` property to take specific action based on the element that dispatched the event.

{% playground-example "v3-docs/components/events/delegation/" "my-element.ts" %}

#### Asynchronously adding event listeners { #async-events }

To add an event listener after rendering, use the `firstUpdated` method. This is a Lit lifecycle callback which runs after the component first updates and renders its templated DOM.

The `firstUpdated` callback fires after the first time your component has been updated and called its `render` method, but **before** the browser has had a chance to paint.

See [firstUpdated](/docs/v3/components/lifecycle/#firstupdated) in the Lifecycle documentation for more information.

To ensure the listener is added after the user can see the component, you can await a Promise that resolves after the browser paints.

```js
async firstUpdated() {
  // Give the browser a chance to paint
  await new Promise((r) => setTimeout(r, 0));
  this.addEventListener('click', this._handleClick);
}
```

### Understanding `this` in event listeners

Event listeners added using the declarative `@` syntax in the template are automatically _bound_ to the component.

Therefore, you can use `this` to refer to your component instance inside any declarative event handler:

```js
class MyElement extends LitElement {
  render() {
    return html`<button @click="${this._handleClick}">click</button>`;
  }
  _handleClick(e) {
    console.log(this.prop);
  }
}
```

When adding listeners imperatively with `addEventListener`, you'll want to use an arrow function so that `this` refers to the component:

```ts
export class MyElement extends LitElement {
  private _handleResize = () => {
    // `this` refers to the component
    console.log(this.isConnected);
  }

  constructor() {
    window.addEventListener('resize', this._handleResize);
  }
}
```

See the [documentation for `this` on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this) for more information.

### Listening to events fired from repeated templates

When listening to events on repeated items, it's often convenient to use [event delegation](#event-delegation) if the event bubbles. When an event does not bubble, a listener can be added on the repeated elements. Here's an example of both methods:

{% playground-example "v3-docs/components/events/list/" "my-element.ts" %}

### Removing event listeners

Passing `null`, `undefined` or `nothing` to an `@` expression will cause any existing listener to be removed.

## Dispatching events { #dispatching-events }

All DOM nodes can dispatch events using the `dispatchEvent` method. First, create an event instance, specifying the event type and options. Then pass it to `dispatchEvent` as follows:

```js
const event = new Event('my-event', {bubbles: true, composed: true});
myElement.dispatchEvent(event);
```

The `bubbles` option allows the event to flow up the DOM tree to ancestors of the dispatching element. It's important to set this flag if you want the event to be able to participate in [event delegation](#event-delegation).

The `composed` option is useful to set to allow the event to be dispatched above the shadow DOM tree in which the element exists.

See [Working with events in shadow DOM](#shadowdom) for more information.

See [EventTarget.dispatchEvent()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent) on MDN for a full description of dispatching events.

### When to dispatch an event

Events should be dispatched in response to user interaction or asynchronous changes in the component's state. They should generally **not** be dispatched in response to state changes made by the owner of the component via its property or attribute APIs. This is generally how native web platform elements work.

For example, when a user types a value into an `input` element a `change` event is dispatched, but if code sets the `input`'s `value` property, a `change` event is **not** dispatched.

Similarly, a menu component should dispatch an event when the user selects a menu item, but it should not dispatch an event if, for example, the menu's `selectedItem` property is set.

This typically means that a component should dispatch an event in response to another event to which it is listening.

{% playground-ide "v3-docs/components/events/dispatch/" "my-dispatcher.ts" %}

### Dispatching events after an element updates

Often, an event should be fired only after an element updates and renders. This might be necessary if an event is intended to communicate a change in rendered state based on user interaction. In this case, the component's `updateComplete` Promise can be awaited after changing state, but before dispatching the event.

{% playground-ide "v3-docs/components/events/update/" "my-dispatcher.ts" %}

### Using standard or custom events { #standard-custom-events }

Events can be dispatched either by constructing an `Event` or a `CustomEvent`. Either is a reasonable approach. When using a `CustomEvent`, any event data is passed in the event's `detail` property. When using an `Event`, an event subclass can be made and custom API attached to it.

See [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event) on MDN for details about constructing events.

#### Firing a custom event:

```js
const event = new CustomEvent('my-event', {
  detail: {
    message: 'Something important happened'
  }
});
this.dispatchEvent(event);
```

See the [MDN documentation on custom events](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) for more information.

#### Firing a standard event:

```js
class MyEvent extends Event {
  constructor(message) {
    super();
    this.type = 'my-event';
    this.message = message;
  }
}

const event = new MyEvent('Something important happened');
this.dispatchEvent(event);
```

## Working with events in shadow DOM {#shadowdom}

When using shadow DOM there are a few modifications to the standard event system that are important to understand. Shadow DOM exists primarily to provide a scoping mechanism in the DOM that encapsulates details about these "shadow" elements. As such, events in shadow DOM encapsulate certain details from outside DOM elements.
