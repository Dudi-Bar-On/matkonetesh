---
name: lit-docs-07
description: "Lit (renderer web components) — vendor doc 07/30 (packages)"
type: reference
---

## Standalone templating

You can also use Lit's templating library for standalone templating, outside of a Lit component. For details, see [Standalone lit-html templates](/docs/v3/libraries/standalone-templates).


<!-- source: packages/lit-dev-content/site/docs/v3/tools/overview.md -->

---
title: Tools and workflows overview
eleventyNavigation:
  key: Overview
  parent: Tools
  order: 1
versionLinks:
  v1: lit-html/tools/
  v2: tools/overview/
---

Lit components are written using plain JavaScript or TypeScript and run out-of-the box on modern browsers with minimal tooling, so you don't _need_ any Lit-specific compilers, tools, or workflows.

However, Lit uses very _modern_ web platform features, so it does require some tooling and polyfills to run on older browsers. Some tools also require configuration options to handle modern JavaScript. And, while Lit is "just JavaScript" there are some tools that make working with web components  much nicer.

The tools and workflows docs cover the different phases of development:

* [Requirements](/docs/v3/tools/requirements/): Common requirements for tools and browsers to work with Lit out of the box, as well as compiler options and polyfills required for legacy browsers.
* [Development](/docs/v3/tools/development/): Setting up your local development environment, including dev server, linting, formatting, syntax highlighting and type-checking.
* [Testing](/docs/v3/tools/testing/): Recommendations for testing Lit projects in modern and legacy browsers.
* [Publishing](/docs/v3/tools/publishing/): Guidelines for publishing your component packages to npm.
* [Building for production](/docs/v3/tools/production/): Building applications for production, including bundling, optimizations, and differential serving for modern and legacy browsers.
* [Starter Kits](/docs/v3/tools/starter-kits): Instructions on using our Lit component starter kits for JavaScript and TypeScript.
* [Adding Lit](/docs/v3/tools/adding-lit): Installing and adding Lit to an existing project.


<!-- source: packages/lit-dev-content/site/docs/v3/components/decorators.md -->

---
title: Decorators
eleventyNavigation:
  key: Decorators
  parent: Components
  order: 8
versionLinks:
  v1: components/decorators/
  v2: components/decorators/
---

Decorators are functions that can be used to declaratively annotate and modify the behavior of classes.

Lit provides a set of optional decorators that enable declarative APIs for things like registering elements, defining reactive properties and query properties, or adding event options to event handler methods.

For example, the `@customElement` and `@property()` decorators let you register a custom element and define a reactive property in a compact, declarative way:

```ts
@customElement('my-element')
export class MyElement extends LitElement {

  @property()
  greeting = 'Welcome';

}
```

{% aside "info" "no-header"%}

Lit supports two different versions of the JavaScript decorators proposal – an early version supported by TypeScript that we refer to as _experimental decorators_ and a new and final version we refer to as _standard decorators_.
 
There are some small differences in usage between the two proposals (standard decorators often require the `accessor` keyword). Our code samples are written for experimental decorators because we recommend them for production at the moment.
 
See [Decorator versions](#decorator-versions) for more details.

{% endaside %}

## Built-in decorators

| Decorator | Summary | More Info |
|-----------|---------|--------------|
| {% api-v3 "@customElement" "customElement" %} | Defines a custom element. | [Defining](/docs/v3/components/defining/) |
| {% api-v3 "@eventOptions" "eventOptions" %} | Adds event listener options. | [Events](/docs/v3/components/events/#event-options-decorator) |
| {% api-v3 "@property" "property" %} | Defines a public property. | [Properties](/docs/v3/components/properties/#declare-with-decorators) |
| {% api-v3 "@state" "state" %} | Defines a private state property | [Properties](/docs/v3/components/properties/#declare-with-decorators) |
| {% api-v3 "@query" "query" %} | Defines a property that returns an element in the component template. | [Shadow DOM](/docs/v3/components/shadow-dom/#query) |
| {% api-v3 "@queryAll" "queryAll" %} | Defines a property that returns a list of elements in the component template. | [Shadow DOM](/docs/v3/components/shadow-dom/#query-all) |
| {% api-v3 "@queryAsync" "queryAsync" %} | Defines a property that returns a promise that resolves to an element in the component template. | [Shadow DOM](/docs/v3/components/shadow-dom/#query-async) |
| {% api-v3 "@queryAssignedElements" "queryAssignedElements" %} | Defines a property that returns the child elements assigned to a specific slot. | [Shadow DOM](/docs/v3/components/shadow-dom/#query-assigned-nodes) |
| {% api-v3 "@queryAssignedNodes" "queryAssignedNodes" %} | Defines a property that returns the child nodes assigned to a specific slot. | [Shadow DOM](/docs/v3/components/shadow-dom/#query-assigned-nodes) |

## Importing decorators

You can import all of the Lit decorators via the `lit/decorators.js` module:

```js
import {customElement, property, eventOptions, query} from 'lit/decorators.js';
```

To reduce the amount of code needed to run the component, decorators can be imported individually into component code. All decorators are available at `lit/decorators/<decorator-name>.js`. For example,

```js
import {customElement} from 'lit/decorators/custom-element.js';
import {eventOptions} from 'lit/decorators/event-options.js';
```

## Enabling decorators { #enabling-decorators }

To use decorators, you need to build your code with a compiler such as [TypeScript](#decorators-typescript) or [Babel](#decorators-babel).

In the future when decorators are supported natively in browsers, this will no longer be necessary

### Using decorators with TypeScript { #decorators-typescript }

TypeScript supports both experimental decorators and standard decorators. We recommend that TypeScript developers use experimental decorators for now for [optimal compiler output](#compiler-output-considerations). If your project requires using standard decorators or setting `"useDefineForClassFields": true`, skip down to [migrating to standard decorators](#migrating-typescript-standard-decorators).

To use experimental decorators you must enable the `experimentalDecorators` compiler option.

You should also ensure that the `useDefineForClassFields` setting is `false`. This is only required when `target` is set to `ES2022` or greater, but it is recommended to explicitly set this to `false`. This is needed to [avoid issues with class fields when declaring properties](/docs/v3/components/properties/#avoiding-issues-with-class-fields).

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
  }
}
```

Enabling `emitDecoratorMetadata` is not required and not recommended.
