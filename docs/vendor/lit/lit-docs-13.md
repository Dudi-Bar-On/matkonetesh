---
name: lit-docs-13
description: "Lit (renderer web components) — vendor doc 13/30 (packages)"
type: reference
---

#### shouldUpdate() {#shouldupdate}

Called to determine whether an update cycle is required.

| | |
|-|-|
| Arguments | `changedProperties`: `Map` with keys that are the names of changed properties and  values that are the corresponding previous values. |
| Updates | No. Property changes inside this method do not trigger an element update. |
| Call super? | Not necessary. |
| Called on server? | No. |

If `shouldUpdate()` returns `true`, which it does by default, then the update proceeds normally. If it returns `false`, the rest of the update cycle will not be called but the `updateComplete` Promise is still resolved.

You can implement `shouldUpdate()` to specify which property changes should cause updates. Use the map of `changedProperties` to compare current and previous values.

{% switchable-sample %}

```ts
shouldUpdate(changedProperties: Map<string, any>) {
  // Only update element if prop1 changed.
  return changedProperties.has('prop1'); 
}
```

```js
shouldUpdate(changedProperties) {
  // Only update element if prop1 changed.
  return changedProperties.has('prop1');
}
```

{% endswitchable-sample %}

#### willUpdate() {#willupdate}

Called before `update()` to compute values needed during the update.

| | |
|-|-|
| Arguments |  `changedProperties`: `Map` with keys that are the names of changed properties and values that are the corresponding previous values. |
| Updates? | No. Property changes inside this method do not trigger an element update. |
| Call super? | Not necessary. |
| Called on server? | Yes. |

Implement `willUpdate()` to compute property values that depend on other properties and are used in the rest of the update process.

{% switchable-sample %}

```ts
willUpdate(changedProperties: PropertyValues<this>) {
  // only need to check changed properties for an expensive computation.
  if (changedProperties.has('firstName') || changedProperties.has('lastName')) {
    this.sha = computeSHA(`${this.firstName} ${this.lastName}`);
  }
}

render() {
  return html`SHA: ${this.sha}`;
}
```

```js
willUpdate(changedProperties) {
  // only need to check changed properties for an expensive computation.
  if (changedProperties.has('firstName') || changedProperties.has('lastName')) {
    this.sha = computeSHA(`${this.firstName} ${this.lastName}`);
  }
}

render() {
  return html`SHA: ${this.sha}`;
}
```

{% endswitchable-sample %}

#### update() {#update}

Called to update the component's DOM.

| | |
|-|-|
| Arguments | `changedProperties`: `Map` with keys that are the names of changed properties and  values that are the corresponding previous values. |
| Updates? | No. Property changes inside this method do not trigger an element update. |
| Call super? | Yes. Without a super call, the element’s attributes and template will not update. |
| Called on server? | No. |

Reflects property values to attributes and calls `render()` to update the component’s internal DOM.

Generally, you should not need to implement this method.

#### render() {#render}

Called by `update()` and should be implemented to return a renderable result (such as a `TemplateResult`) used to render the component's DOM.

| | |
|-|-|
| Arguments | None. |
| Updates? | No. Property changes inside this method do not trigger an element update. |
| Call super? | Not necessary. |
| Called on server? | Yes. |

The `render()` method has no arguments, but typically it references component properties. See [Rendering](/docs/v3/components/rendering/) for more information.

```js
render() {
  const header = `<header>${this.header}</header>`;
  const content = `<section>${this.content}</section>`;
  return html`${header}${content}`;
}
```

### Completing an update {#reactive-update-cycle-completing}

After `update()` is called to render changes to the component's DOM, you can perform actions on the component's DOM using these methods.

#### firstUpdated() {#firstupdated}

Called after the component's DOM has been updated the first time, immediately before [`updated()`](#updated) is called.

| | |
|-|-|
| Arguments | `changedProperties`: `Map` with keys that are the names of changed properties and  values that are the corresponding previous values. |
| Updates? | Yes. Property changes inside this method schedule a new update cycle. |
| Call super? | Not necessary. |
| Called on server? | No. |

Implement `firstUpdated()` to perform one-time work after the component's DOM has been created. Some examples might include focusing a particular rendered element or adding a [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) or [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) to an element.

```js
firstUpdated() {
  this.renderRoot.getElementById('my-text-area').focus();
}
```

#### updated() {#updated}

Called whenever the component’s update finishes and the element's DOM has been updated and rendered.

| | |
|-|-|
| Arguments | `changedProperties`: `Map` with keys that are the names of changed properties and  values that are the corresponding previous values. |
| Updates? | Yes. Property changes inside this method trigger an element update. |
| Call super? | Not necessary. |
| Called on server? | No. |

Implement `updated()` to perform tasks that use element DOM after an update. For example, code that performs animation may need to measure the element DOM.

{% switchable-sample %}

```ts
updated(changedProperties: Map<string, any>) {
  if (changedProperties.has('collapsed')) {
    this._measureDOM();
  }
}
```

```js
updated(changedProperties) {
  if (changedProperties.has('collapsed')) {
    this._measureDOM();
  }
}
```

{% endswitchable-sample %}
