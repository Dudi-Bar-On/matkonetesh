---
name: lit-docs-08
description: "Lit (renderer web components) — vendor doc 08/30 (packages)"
type: reference
---

#### Migrating TypeScript experimental decorators to standard decorators { #migrating-typescript-standard-decorators }

Lit decorators are designed to support [standard decorator syntax](#standard-decorators) (using `accessor` on class field decorators) with TypeScript's experimental decorator mode.

This allows incremental migration off of experimental decorators starting with the addition of the `accessor` keyword to decorated properties without a change of behavior. Once all decorated class field use the `accessor` keyword, you can change your compiler options to complete the migration to standard decorators:

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": false, // default for TypeScript 5.0 and up
    "useDefineForClassFields": true, // default when "target" is "ES2022" or higher
  }
}
```

Note: The `accessor` keyword was introduced in TypeScript 4.9 and standard decorators with metadata require TypeScript ≥5.2.

### Using decorators with Babel { #decorators-babel }

[Babel](https://babeljs.io/docs/en/) supports standard decorators with the [`@babel/plugin-proposal-decorators`](https://babeljs.io/docs/en/babel-plugin-proposal-decorators) plugin as of version 7.23. Babel does not support TypeScript experimental decorators, so you must use Lit decorators with [standard decorator syntax](#standard-decorators) using the `accessor` keyword on decorated class fields.

Enable decorators by adding [`@babel/plugin-proposal-decorators`](https://babeljs.io/docs/en/babel-plugin-proposal-decorators) with these Babel configuration settings:

```json
// babel.config.json
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", {"version": "2023-05"}]
  ]
}
```

Note: Lit decorators only work with `"version": "2023-05"`. Other versions, including the formerly supported `"2018-09"`, are not supported.

## Decorator versions

Decorators are a [stage 3 proposal](https://github.com/tc39/proposal-decorators) for addition to the ECMAScript standard. Compilers like [Babel](https://babeljs.io/) and [TypeScript](https://www.typescriptlang.org/) support decorators, though no browsers have implemented them yet. Lit decorators work with Babel and TypeScript, and will work in browsers when they implement them natively.

{% aside "info" %}

What does stage 3 mean?

It means that the specification text is complete, and ready for browsers to implement. Once the specification has been implemented in multiple browsers, it can move to the final stage, stage 4, and be added to the ECMAScript standard. A stage 3 proposal will only change if critical issues are discovered during implementation.

{% endaside %}

### Earlier decorator proposals

Before the TC39 proposal reached stage 3, compilers implemented earlier versions of the decorator specification.

Most notable of these is [TypeScript's _experimental decorators_](https://www.typescriptlang.org/docs/handbook/decorators.html) which Lit has supported since its inception and is our current recommendation for use.

Babel has also supported different versions of the specification over time as can be seen from the [`"version"` option of the decorator plugin](https://babeljs.io/docs/babel-plugin-proposal-decorators#version). In the past, Lit 2 has supported the `"2018-09"` version for Babel users but that has now been dropped in favor of the _standard_ `"2023-05"` version described below.

### Standard decorators { #standard-decorators }

_Standard decorators_ is the version of decorators that has reached Stage 3 consensus at TC39, the body that defines ECMAScript/JavaScript.

Standard decorators are supported in TypeScript and Babel, with native browser coming in the near future.

The biggest difference between standard decorators and experimental decorators is that, for performance reasons, standard decorators cannot change the _kind_ of a class member – fields, accessors, and methods – being decorated and replaced, and will only produce the same kind of member.

Since many Lit decorators generate accessors, this means that the decorators need to be applied to accessors, not class fields.

To make this convenient, the standard decorator specification adds the `accessor` keyword to declare "auto-accessors":

```ts
class MyClass {
  accessor foo = 42;
}
```

Auto-accessors create a getter and setter pair that read and write from a private field. Decorators can then wrap these getters and setters.

Lit decorators that work on class fields with experimental decorators – such as `@property()`, `@state()`, `@query()`, etc. – must be applied to accessors or auto-accessors with standard decorators:

```ts
@customElement('my-element')
export class MyElement extends LitElement {

  @property()
  accessor greeting = 'Welcome';

}
```

### Compiler output considerations

Compiler output for standard decorators is unfortunately large due to the need to generate the accessors, private storage, and other objects that are part of the decorators API.

So we recommend that users who wish to use decorators, if possible, use TypeScript experimental decorators for now.

In the future the Lit team plans on adding decorator transforms to our optional Lit Compiler in order to compile standard decorators to a more compact compiler output. Native browser support will also eliminate the need for any compiler transforms at all.


<!-- source: packages/lit-dev-content/site/docs/v3/components/defining.md -->

---
title: Defining a component
eleventyNavigation:
  key: Defining
  parent: Components
  order: 1
versionLinks:
  v1: components/templates/
  v2: components/defining/
---

Define a Lit component by creating a class extending `LitElement` and registering your class with the browser:

```ts
@customElement('simple-greeting')
export class SimpleGreeting extends LitElement { /* ... */ }
```

The `@customElement` decorator is shorthand for calling [`customElements.define`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define), which registers a custom element class with the browser and associates it with an element name (in this case, `simple-greeting`).

If you're using JavaScript, or if you're not using decorators, you can call `define()` directly:

```js
export class SimpleGreeting extends LitElement { /* ... */  }
customElements.define('simple-greeting', SimpleGreeting);
```

## A Lit component is an HTML element

When you define a Lit component, you're defining a [custom HTML element](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements). So you can use the new element like you'd use any built-in element:

```html
<simple-greeting name="Markup"></simple-greeting>
```

```js
const greeting = document.createElement('simple-greeting');
```

The `LitElement` base class is a subclass of `HTMLElement`, so a Lit component inherits all of the standard `HTMLElement` properties and methods.

Specifically, `LitElement` inherits from `ReactiveElement`, which implements reactive properties, and in turn inherits from `HTMLElement`.

<img alt="Inheritance diagram showing LitElement inheriting from ReactiveElement, which in turn inherits from HTMLElement. LitElement is responsible for templating; ReactiveElement is responsible for managing reactive properties and attributes; HTMLElement is the standard DOM interface shared by all native HTML elements and custom elements." class="centered-image" src="/images/docs/components/lit-element-inheritance.png">
