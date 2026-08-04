---
name: lit-docs-28
description: "Lit (renderer web components) — vendor doc 28/30 (packages)"
type: reference
---

#### When a mixin does not add new public/protected API

If your mixin only overrides `LitElement` methods or properties and does not
add any new API of its own, you can simply cast the generated class to the super
class type `T` that was passed in:

```ts
export const MyMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  class MyMixinClass extends superClass {
    connectedCallback() {
      super.connectedCallback();
      this.doSomethingPrivate();
    }
    private doSomethingPrivate() {
      /* does not need to be part of the interface */
    }
  };
  // Cast return type to the superClass type passed in
  return MyMixinClass as T;
}
```

#### When a mixin adds new public/protected API

If your mixin does add new protected or public API that you need users to be
able to use on their class, you need to define the interface for the mixin
separately from the implementation, and cast the return type as the intersection
of your mixin interface and the super class type:

```ts
// Define the interface for the mixin
export declare class MyMixinInterface {
  highlight: boolean;
  protected renderHighlight(): unknown;
}

export const MyMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  class MyMixinClass extends superClass {
    @property() highlight = false;
    protected renderHighlight() {
      /* ... */
    }
  };
  // Cast return type to your mixin's interface intersected with the superClass type
  return MyMixinClass as Constructor<MyMixinInterface> & T;
}
```

### Applying decorators in mixins

Due to limitations of TypeScript's type system, decorators (such as
`@property()`) must be applied to a class declaration statement and not a class
expression.

In practice this means mixins in TypeScript need to declare a class
and then return it, rather than return a class expression directly from the
arrow function.

Supported:
```ts
export const MyMixin = <T extends LitElementConstructor>(superClass: T) => {
  // ✅ Defining a class in a function body, and then returning it
  class MyMixinClass extends superClass {
    @property()
    mode = 'on';
    /* ... */
  };
  return MyMixinClass;
}
```

Not supported:
```ts
export const MyMixin = <T extends LitElementConstructor>(superClass: T) =>
  // ❌ Returning class expression directly using arrow-function shorthand
  class extends superClass {
    @property()
    mode = 'on';
    /* ... */
  }
```


<!-- source: packages/lit-dev-content/site/docs/v3/data/context.md -->

---
title: Context
eleventyNavigation:
  key: Context
  parent: Managing Data
  order: 1
versionLinks:
  v2: data/context/
---

Context is a way of making data available to entire component subtrees without having to manually bind properties to every component. The data is "contextually" available, such that ancestor elements in between a provider of data and consumer of data aren't even aware of it.

Lit's context implementation is available in the `@lit/context` package:

```bash
npm i @lit/context
```

Context is useful for data that needs to be consumed by a wide variety and large number of components - things like an app's data store, the current user, a UI theme - or when data-binding isn't an option, such as when an element needs to provide data to its light DOM children.

Context is very similar to React's Context, or to dependency injection systems like Angular's, with some important differences that make Context work with the dynamic nature of the DOM, and enable interoperability across different web components libraries, frameworks and plain JavaScript.

## Example

Using context involves a _context object_ (sometimes called a key), a _provider_ and a _consumer_, which communicate using the context object.

Context definition (`logger-context.ts`):
```ts
import {createContext} from '@lit/context';
import type {Logger} from 'my-logging-library';
export type {Logger} from 'my-logging-library';
export const loggerContext = createContext<Logger>('logger');
```

Provider:
```ts
import {LitElement, property, html} from 'lit';
import {provide} from '@lit/context';

import {Logger} from 'my-logging-library';
import {loggerContext} from './logger-context.js';

@customElement('my-app')
class MyApp extends LitElement {

  @provide({context: loggerContext})
  logger = new Logger();

  render() {
    return html`...`;
  }
}
```

Consumer:
```ts
import {LitElement, property} from 'lit';
import {consume} from '@lit/context';

import {type Logger, loggerContext} from './logger-context.js';

export class MyElement extends LitElement {

  @consume({context: loggerContext})
  @property({attribute: false})
  public logger?: Logger;

  private doThing() {
    this.logger?.log('A thing was done');
  }
}
```

## Key Concepts

### Context Protocol
Lit's context is based on the [Context Community Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) by the W3C's [Web Components Community Group](https://www.w3.org/community/webcomponents/).

This protocol enables interoperability between elements (or even non-element code) regardless of how they were built. Via the context protocol, a Lit-based element can provide data to a consumer not built with Lit, or vice versa.

The Context Protocol is based on DOM events. A consumer fires a `context-request` event that carries the context key that it wants, and any element above it can listen for the `context-request` event and provide data for that context key.

`@lit/context` implements this event-based protocol and makes it available via a few reactive controllers and decorators.

### Context Objects

Contexts are identified by _context objects_ or _context keys_. They are objects that represent some potential data to be shared by the context object identity. You can think of them as similar to Map keys.

### Providers

Providers are usually elements (but can be any event handler code) that provide data for specific context keys.

### Consumers

Consumers request data for specific context keys.

### Subscriptions

When a consumer requests data for a context, it can tell the provider that it wants to _subscribe_ to changes in the context. If the provider has new data, the consumer will be notified and can automatically update.

## Usage

### Defining a context

Every usage of context must have a context object to coordinate the data request. This context object represents the identity and type of data that is provided.

Context objects are created with the `createContext()` function:

```ts
export const myContext = createContext(Symbol('my-context'));
```

It is recommended to put context objects in their own module so that they're importable independent of specific providers and consumers.

#### Context type-checking

`createContext()` takes any value and returns it directly. In TypeScript, the value is cast to a typed `Context` object, which carries the type of the context _value_ with it.

In case of a mistake like this:
```ts
const myContext = createContext<Logger>(Symbol('logger'));

class MyElement extends LitElement {
  @provide({context: myContext})
  name: string
}
```

TypeScript will warn that the type `string` is not assignable to the type `Logger`. Note that this check is currently only for public fields.

<!-- 
  TODO https://github.com/lit/lit/issues/3926 this will likely need to be updated once we move to standard decorators.
 -->
