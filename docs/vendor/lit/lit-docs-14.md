---
name: lit-docs-14
description: "Lit (renderer web components) — vendor doc 14/30 (packages)"
type: reference
---

#### updateComplete {#updatecomplete}

The `updateComplete` promise resolves when the element has finished updating. Use `updateComplete` to wait for an update. The resolved value is a boolean indicating if the element has finished updating. It will be `true` if there are no pending updates after the update cycle has finished.

When an element updates, it may cause its children to update as well. By default, the `updateComplete` promise resolves when the element's update has completed, but does not wait for any children to have completed their updates. This behavior may be customized by overriding [`getUpdateComplete`](#getUpdateComplete).

There are several use cases for needing to know when an element's update has completed:

1. **Tests** When writing tests you can await the `updateComplete` promise before making assertions about a component’s DOM. If the assertions depend on updates completing for the component's entire descendant tree, awaiting `requestAnimationFrame` is often a better choice, since Lit's default scheduling uses the browser's microtask queue, which is emptied prior to animation frames. This ensures all pending Lit updates on the page have completed before the `requestAnimationFrame` callback.

2. **Measurement** Some components may need to measure DOM in order to implement certain layouts. While it is always better to implement layouts using pure CSS rather than JavaScript-based measurement, sometimes CSS limitations make this unavoidable. In very simple cases, and if you're measuring Lit or ReactiveElement components, it may be sufficient to await `updateComplete` after state changes and before measuring. However, because `updateComplete` does not await the update of all descendants, we recommend using [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) as a more robust way to trigger measurement code when layouts change.

3. **Events** It is a good practice to dispatch events from components after rendering has completed, so that the event's listeners see the fully rendered state of the component. To do so, you can await the `updateComplete` promise before firing the event.

    ```js
    async _loginClickHandler() {
      this.loggedIn = true;
      // Wait for `loggedIn` state to be rendered to the DOM
      await this.updateComplete;
      this.dispatchEvent(new Event('login'));
    }
    ```

The `updateComplete` promise rejects if there's an unhandled error during the update cycle. For more information, see [Handling errors in the update cycle](#errors-in-the-update-cycle).

### Handling errors in the update cycle {#errors-in-the-update-cycle}

If you have an uncaught exception in a lifecycle method like `render()` or `update()`, it  causes the `updateComplete` promise to reject.
If you have code in a lifecycle method that can throw an exception, it's good practice to put it inside a `try`/`catch` statement.

You may also want to use a `try`/`catch` if you're awaiting the `updateComplete` promise:

```js
try {
  await this.updateComplete;
} catch (e) {
  /* handle error */
}
```

In some cases, code may throw in unexpected places. As a fallback, you can add a handler for `window.onunhandledrejection` to catch these issues. For example, you could use this report errors back to a backend service to help diagnose issues that are hard to reproduce.

```js
window.onunhandledrejection = function(e) {
  /* handle error */
}
```

### Implementing additional customization {#reactive-update-cycle-customizing}

This section covers some less-common methods for customizing the update cycle.

#### scheduleUpdate() {#scheduleupdate}

Override `scheduleUpdate()` to customize the timing of the update. `scheduleUpdate()` is called when an update is about to be performed, and by default it calls `performUpdate()` immediately. Override it to defer the update—this technique can be used to unblock the main rendering/event thread. 

For example, the following code schedules the update to occur after the next frame paints, which can reduce jank if the update is expensive:

{% switchable-sample %}

```ts
protected override async scheduleUpdate(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  super.scheduleUpdate();
}
```

```js
async scheduleUpdate() {
  await new Promise((resolve) => setTimeout(resolve));
  super.scheduleUpdate();
}
```

{% endswitchable-sample %}

If you override `scheduleUpdate()`, it's your responsibility to call `super.scheduleUpdate()` to perform the pending update.

{% aside "info" %}

Async function optional.

This example shows an [async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) which _implicitly_ returns a promise. You can also write `scheduleUpdate()` as a function that _explictly_ returns a `Promise`. In either case, the **next** update doesn't start until the promise returned by `scheduleUpdate()` resolves. 

{% endaside %}


#### performUpdate()  {#performupdate}

Implements the reactive update cycle, calling the other methods, like `shouldUpdate()`, `update()`, and `updated()`.

Call `performUpdate()` to immediately process a pending update. This should generally not be needed, but it can be done in rare cases when you need to update synchronously. (If there is no update pending, you can call `requestUpdate()` followed by `performUpdate()` to force a synchronous update.)

{% aside "info" %}

Use `scheduleUpdate()` to customize scheduling.

If you want to customize how updates are scheduled, override `scheduleUpdate()`. Previously, we recommended overriding `performUpdate()` for this purpose. That continues to work, but it makes it more difficult to call `performUpdate()` to process a pending update synchronously. 

{% endaside %}

#### hasUpdated  {#hasupdated}

The `hasUpdated` property returns true if the component has updated at least once. You can use `hasUpdated` in any of the lifecycle methods to perform work only if the component has not yet updated.


#### getUpdateComplete() {#getUpdateComplete}

To await additional conditions before fulfilling the `updateComplete` promise, override the `getUpdateComplete()` method. For example, it may be useful to await the update of a child element. First await `super.getUpdateComplete()`, then any subsequent state.

<div class="alert alert-info">

It's recommended to override the `getUpdateComplete()` method instead of the `updateComplete` getter to ensure compatibility with users who are using TypeScript's ES5 output (see [TypeScript#338](https://github.com/microsoft/TypeScript/issues/338)).

</div>

```js
class MyElement extends LitElement {
  async getUpdateComplete() {
    const result = await super.getUpdateComplete();
    await this._myChild.updateComplete;
    return result;
  }
}
```

## External lifecycle hooks: controllers and decorators

In addition to component classes implementing lifecycle callbacks, external code, such as [decorators](/docs/v3/components/decorators/) may need to hook into a component's lifecycle.

Lit offers two concepts for external code to integrate with the reactive update lifecycle: `static addInitializer()` and `addController()`:
