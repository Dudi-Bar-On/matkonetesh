---
name: lit-docs-30
description: "Lit (renderer web components) — vendor doc 30/30 (packages)"
type: reference
---

### `createContext()`

Creates a typed Context object

**Import**:

```ts
import {createContext} from '@lit/context';
```

**Signature**:

```ts
function createContext<ValueType, K = unknown>(key: K): Context<K, ValueType>;
```


Contexts are compared with with strict equality.

If you want two separate `createContext()` calls to referrer to the same context, then use a key that will by equal under strict equality like a string for `Symbol.for()`:

```ts
// true
createContext('my-context') === createContext('my-context')
// true
createContext(Symbol.for('my-context')) === createContext(Symbol.for('my-context'))
```

If you want a context to be unique so that it's guaranteed to not collide with other contexts, use a key that's unique under strict equality, like a `Symbol()` or object.:

```ts
// false
createContext(Symbol('my-context')) === createContext(Symbol('my-context'))
// false
createContext({}) === createContext({})
```

The `ValueType` type parameter is the type of value that can be provided by this context. It's uses to provide accurate types in the other context APIs.

### `@provide()`

A property decorator that adds a ContextProvider controller to the component making it respond to any `context-request` events from its children consumer.

**Import**:

```ts
import {provide} from '@lit/context';
```

**Signature**:

```ts
@provide({context: Context})
```

### `@consume()`

A property decorator that adds a ContextConsumer controller to the component which will retrieve a value for the property via the Context protocol.

**Import**:

```ts
import {consume} from '@lit/context';
```

**Signature**:

```ts
@consume({context: Context, subscribe?: boolean})
```

`subscribe` is `false` by default. Set it to `true` to subscribe to updates to the context provided value.

### `ContextProvider`

A ReactiveController which adds context provider behavior to a custom element by listening to `context-request` events.

**Import**:

```ts
import {ContextProvider} from '@lit/context';
```

**Constructor**:

```ts
ContextProvider(
  host: ReactiveElement,
  options: {
    context: T,
    initialValue?: ContextType<T>
  }
)
```

**Members**

- `setValue(v: T, force = false): void`

    Sets the value provided, and notifies any subscribed consumers of the new value if the value changed. `force` causes a notification even if the value didn't change, which can be useful if an object had a deep property change.


### `ContextConsumer`

A ReactiveController which adds context consuming behavior to a custom element by dispatching `context-request` events.

**Import**:

```ts
import {ContextConsumer} from '@lit/context';
```

**Constructor**:
```ts
ContextConsumer(
  host: HostElement,
  options: {
    context: C,
    callback?: (value: ContextType<C>, dispose?: () => void) => void,
    subscribe?: boolean = false
  }
)
```

**Members**

- `value: ContextType<C>`

   The current value for the context.

When the host element is connected to the document it will emit a `context-request` event with its context key. When the context request is satisfied the controller will invoke the callback, if present, and trigger a host update so it can respond to the new value.

It will also call the dispose method given by the provider when the host element is disconnected.

### `ContextRoot`

A ContextRoot can be used to gather unsatisfied context requests and re-dispatch them when new providers which satisfy matching context keys are available. This allows providers to be added to a DOM tree, or upgraded, after the consumers.

**Import**:

```ts
import {ContextRoot} from '@lit/context';
```

**Constructor**:
```ts
ContextRoot()
```

**Members**

- `attach(element: HTMLElement): void`

    Attaches the ContextRoot to this element and starts listening to `context-request` events.

- `detach(element: HTMLElement): void`

    Detaches the ContextRoot from this element, stops listening to `context-request` events.

### `ContextEvent`

The event fired by consumers to request a context value. The API and behavior of this event is specified by the [Context Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md).

**Import**:

```ts
import {ContextEvent} from '@lit/context';
```

The `context-request` bubbles and is composed.

**Members**

- `readonly context: C`

    The context object this event is requesting a value for

- `readonly contextTarget: Element`

    The DOM element that initiated the context request

- `readonly callback: ContextCallback<ContextType<C>>`

    The function to call to provide a context value

- `readonly subscribe?: boolean`

    Whether the consumers wants to subscribe to new context values

### `ContextCallback`

A callback which is provided by a context requester and is called with the value satisfying the request.

This callback can be called multiple times by context providers as the requested value is changed.

**Import**:

```ts
import {type ContextCallback} from '@lit/context';
```

**Signature**:

```ts
type ContextCallback<ValueType> = (
  value: ValueType,
  unsubscribe?: () => void
) => void;
```
