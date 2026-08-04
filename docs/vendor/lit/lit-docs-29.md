---
name: lit-docs-29
description: "Lit (renderer web components) — vendor doc 29/30 (packages)"
type: reference
---

#### Context equality

Context objects are used by providers to match a context request event to a value. Contexts are compared with strict equality (`===`), so a provider will only handle a context request if its context key equals the context key of the request.

This means that there are two main ways to create a context object:
1. With a value that is globally unique, like an object (`{}`)  or symbol (`Symbol()`)
2. With a value that is not globally unique, so that it can be equal under strict equality, like a string (`'logger'`) or _global_ symbol (`Symbol.for('logger')`).

If you want two _separate_ `createContext()` calls to refer to the same
context, then use a key that will be equal under strict equality like a
string:
```ts
// true
createContext('my-context') === createContext('my-context')
```

Beware though that two modules in your app could use the same context key to refer to different objects. To avoid unintended collisions you may want to use a relatively unique string, e.g. like `'console-logger'` instead of `'logger'`.

Usually it's best to use a globally unique context object. Symbols are one of the easiest ways to do this.

### Providing a context

There are two ways in `@lit/context` to provide a context value: the ContextProvider controller and the `@provide()` decorator.

#### `@provide()`

The `@provide()` decorator is the easiest way to provide a value if you're using decorators. It creates a ContextProvider controller for you.

Decorate a property with `@provide()` and give it the context key:
```ts
import {LitElement, html} from 'lit';
import {property} from 'lit/decorators.js';
import {provide} from '@lit/context';
import {myContext, MyData} from './my-context.js';

class MyApp extends LitElement {
  @provide({context: myContext})
  myData: MyData;
}
```

You can make the property also a reactive property with `@property()` or `@state()` so that setting it will update the provider element as well as context consumers.

```ts
  @provide({context: myContext})
  @property({attribute: false})
  myData: MyData;
```

Context properties are often intended to be private. You can make private properties reactive with `@state()`:

```ts
  @provide({context: myContext})
  @state()
  private _myData: MyData;
```

Making a context property public lets an element provide a public field to its child tree:

```ts
  html`<my-provider-element .myData=${someData}>`
```

#### ContextProvider

`ContextProvider` is a reactive controller that manages `context-request` event handlers for you.

```ts
import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {myContext} from './my-context.js';

export class MyApp extends LitElement {
  private _provider = new ContextProvider(this, {context: myContext});
}
```

ContextProvider can take an initial value as an option in the constructor:

```ts
  private _provider = new ContextProvider(this, {context: myContext, initialValue: myData});
```

Or you can call `setValue()`:
```ts
  this._provider.setValue(myData);
```

### Consuming a context

#### `@consume()` decorator

The `@consume()` decorator is the easiest way to consume a value if you're using decorators. It creates a ContextConsumer controller for you.

Decorate a property with `@consume()` and give it the context key:
```ts
import {LitElement, html} from 'lit';
import {consume} from '@lit/context';
import {myContext, MyData} from './my-context.js';

class MyElement extends LitElement {
  @consume({context: myContext})
  myData: MyData;
}
```

When this element is connected to the document, it will automatically fire a `context-request` event, get a provided value, assign it to the property, and trigger an update of the element.

#### ContextConsumer

ContextConsumer is a reactive controller that manages dispatching the `context-request` event for you. The controller will cause the host element to update when new values are provided. The provided value is then available at the `.value` property of the controller.

```ts
import {LitElement, property} from 'lit';
import {ContextConsumer} from '@lit/context';
import {myContext} from './my-context.js';

export class MyElement extends LitElement {
  private _myData = new ContextConsumer(this, {context: myContext});

  render() {
    const myData = this._myData.value;
    return html`...`;
  }
}
```

#### Subscribing to contexts

Consumers can subscribe to context values so that if a provider has a new value, it can give it to all subscribed consumers, causing them to update.

You can subscribe with the `@consume()` decorator:

```ts
  @consume({context: myContext, subscribe: true})
  myData: MyData;
```

and the ContextConsumer controller:

```ts
  private _myData = new ContextConsumer(this,
    {
      context: myContext,
      subscribe: true,
    }
  );
```

## Example Use Cases

### Current user, locale, etc.

The most common context use cases involve data that is global to a page and possibly only sparsely needed in components throughout the page. Without context it's possible that most or all components would need to accept and propagate reactive properties for the data.

### Services

App-global services, like loggers, analytics, data stores, can be provided by context. An advantage of context over importing from a common module are the late coupling and tree-scoping that context provides. Tests can easily provide mock services, or different parts of the page can be given different service instances.

### Themes

Themes are sets of styles that apply to the entire page or entire subtrees within the page - exactly the kind of scope of data that context provides.

One way of building a theme system would be to define a `Theme` type that containers can provide that holds named styles. Elements that want to apply a theme can consume the theme object and look up styles by name. Custom theme reactive controllers can wrap ContextProvider and ContextConsumer to reduce boilerplate.

### HTML-based plugins

Context can be used to pass data from a parent to its light DOM children. Since the parent does usually not create the light DOM children, it cannot leverage template-based data-binding to pass data to them, but it can listen to and respond to `context-request` events.

For example, consider a code editor element with plugins for different language modes. You can make a plain HTML system for adding features using context:

```html
<code-editor>
  <code-editor-javascript-mode></code-editor-javascript-mode>
  <code-editor-python-mode></code-editor-python-mode>
</code-editor>
```

In this case `<code-editor>` would provide an API for adding language modes via context, and plugin elements would consume that API and add themselves to the editor.

### Data formatters, link generators, etc.

Sometimes reusable components will need to format data or URLs in an application-specific way. For example, a documentation viewer that renders a link to another item. The component will not know the URL space of the application.

In these cases the component can depend on a context-provided function that will apply the application-specific formatting to the data or link.

## API

<div class="alert alert-info">

These API docs are a summary until generated API docs are available

</div>
