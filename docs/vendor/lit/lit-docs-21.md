---
name: lit-docs-21
description: "Lit (renderer web components) — vendor doc 21/30 (packages)"
type: reference
---

#### @queryAsync { #query-async }

Similar to `@query`, except that instead of returning a node directly, it returns a `Promise` that resolves to that node after any pending element render is completed. Code can use this instead of waiting for the `updateComplete` promise.

This is useful, for example, if the node returned by `@queryAsync` can change as a result of another property change.

## Rendering children with slots {#slots}

Your component may accept children (like a `<ul>` element can have `<li>` children).

```html
<my-element>
  <p>A child</p>
</my-element>
```
By default, if an element has a shadow tree, its children don't render at all.

To render children, your template needs to include one or more [`<slot>` elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot), which act as placeholders for child nodes.

### Using the slot element

To render an element's children, create a `<slot>` for them in the element's template. The children aren't _moved_ in the DOM tree, but they're rendered _as if_ they were children of the `<slot>`. For example:

{% playground-ide "v3-docs/components/shadowdom/slots/" %}

### Using named slots

To assign a child to a specific slot, ensure that the child's `slot` attribute matches the slot's `name` attribute:

* **Named slots only accept children with a matching `slot` attribute.**

  For example, `<slot name="one"></slot>` only accepts children with the attribute `slot="one"`.

* **Children with a `slot` attribute will only be rendered in a slot with a matching `name` attribute.**

  For example, `<p slot="one">...</p>` will only be placed in `<slot name="one"></slot>`.

{% playground-ide "v3-docs/components/shadowdom/namedslots/" %}

### Specifying slot fallback content {#fallback}

You can specify fallback content for a slot. The fallback content is shown when no child is assigned to the slot.

```html
<slot>I am fallback content</slot>
```

<div class="alert alert-info">

**Rendering fallback content.** If any child nodes are assigned to a slot, its fallback content doesn't render. A default slot with no name accepts any child nodes. It won't render fallback content even if the only assigned nodes are text nodes containing whitespace, for example `<example-element> </example-element>`. When using a Lit expression as a child of a custom element, make sure to use a non-rendering value when appropriate so that any slot fallback content is rendered. See [removing child content](/docs/v3/templates/expressions/#removing-child) for more information.

</div>

## Accessing slotted children { #accessing-slotted-children }

To access children assigned to slots in your shadow root, you can use the standard `slot.assignedNodes` or `slot.assignedElements` methods with the `slotchange` event.

For example, you can create a getter to access assigned elements for a particular slot:

```js
get _slottedChildren() {
  const slot = this.shadowRoot.querySelector('slot');
  return slot.assignedElements({flatten: true});
}
```

{% aside "info" %}

The elements are assigned only after the slot is rendered.

If you need to access assigned elements at startup, you need to wait for `firstUpdated` or `updated`. If you want to access assigned elements when your render changes, you can use `slotchange`.

{% endaside %}

You can use the `slotchange` event to take action when nodes are first assigned or change.
The following example extracts the text content of all of the slotted children.

```js
handleSlotchange(e) {
  const childNodes = e.target.assignedNodes({flatten: true});
  // ... do something with childNodes ...
  this.allText = childNodes.map((node) => {
    return node.textContent ? node.textContent : ''
  }).join('');
}

render() {
  return html`<slot @slotchange=${this.handleSlotchange}></slot>`;
}
```

For more information, see [HTMLSlotElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement) on MDN.

### @queryAssignedElements and @queryAssignedNodes decorators { #query-assigned-nodes }

`@queryAssignedElements` and `@queryAssignedNodes` convert a class property into a getter that returns the result of calling
[`slot.assignedElements`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedElements) or [`slot.assignedNodes`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedNodes) respectively on a given slot in the component's shadow tree.
Use these to query the elements or nodes assigned to a given slot.

Both accept an optional object with the following properties:

| Property       | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `flatten` | Boolean specifying whether to flatten the assigned nodes by replacing any child `<slot>` elements with their assigned nodes. |
| `slot` | Slot name specifying the slot to query. Leave undefined to select the default slot. |
| `selector` (`queryAssignedElements` only) | If specified, only return assigned elements that match this CSS selector. |

Deciding which decorator to use depends on whether you want to query for text nodes assigned to the slot, or only element nodes. This decision is specific to your use case.

<div class="alert alert-info">

**Using decorators.** Decorators are a proposed JavaScript feature, so you’ll need to use a compiler like Babel or TypeScript to use decorators. See [Using decorators](/docs/v3/components/decorators/) for details.

</div>

```ts
@queryAssignedElements({slot: 'list', selector: '.item'})
_listItems!: Array<HTMLElement>;

@queryAssignedNodes({slot: 'header', flatten: true})
_headerNodes!: Array<Node>;
```

The examples above are equivalent to the following code:

```js
get _listItems() {
  const slot = this.shadowRoot.querySelector('slot[name=list]');
  return slot.assignedElements().filter((node) => node.matches('.item'));
}

get _headerNodes() {
  const slot = this.shadowRoot.querySelector('slot[name=header]');
  return slot.assignedNodes({flatten: true});
}
```

## Customizing the render root {#renderroot}

Each Lit component has a **render root**—a DOM node that serves as a container for its internal DOM.

By default, LitElement creates an open `shadowRoot` and renders inside it, producing the following DOM structure:

```html
<my-element>
  #shadow-root
    <p>child 1</p>
    <p>child 2</p>
```

There are two ways to customize the render root used by LitElement:

* Setting `shadowRootOptions`.
* Implementing the `createRenderRoot` method.

### Setting `shadowRootOptions`

The simplest way to customize the render root is to set the `shadowRootOptions` static property. The default implementation of `createRenderRoot` passes `shadowRootOptions` as the options argument to `attachShadow` when creating the component's shadow root. It can be set to customize any options allowed in the [ShadowRootInit](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow#parameters) dictionary, for example `mode` and `delegatesFocus`.

```js
class DelegatesFocus extends LitElement {
  static shadowRootOptions = {...LitElement.shadowRootOptions, delegatesFocus: true};
}
```

See [Element.attachShadow()](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow) on MDN for more information.
