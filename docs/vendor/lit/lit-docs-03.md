---
name: lit-docs-03
description: "Lit (renderer web components) — vendor doc 03/30 (packages)"
type: reference
---

## Open WC project generator

The Open WC project has a [project generator](https://open-wc.org/docs/development/generator/) that can scaffold out an application project using Lit.


<!-- source: packages/lit-dev-content/site/docs/v3/components/overview.md -->

---
title: Components overview
eleventyNavigation:
  key: Overview
  parent: Components
  order: 0
versionLinks:
  v1: components/templates/
  v2: components/overview/
---

A Lit component is a reusable piece of UI. You can think of a Lit component as a container that has some state and that displays a UI based on its state. It can also react to user input, fire events—anything you'd expect a UI component to do. And a Lit component is an HTML element, so it has all of the standard element APIs.

Creating a Lit component involves a number of concepts:

 *   [Defining a component](/docs/v3/components/defining/). A Lit component is implemented as a *custom element*, registered  with the browser.

 *   [Rendering](/docs/v3/components/rendering/). A component has *render method* that's called to render the component's contents. In the render method, you define a *template* for the component.

*   [Reactive properties](/docs/v3/components/properties/). Properties hold the state of the component. Changing one or more of the components' _reactive properties_ triggers an update cycle, re-rendering the component.

*   [Styles](/docs/v3/components/styles/). A component can define _encapsulated styles_ to control its own appearance.

*   [Lifecycle](/docs/v3/components/lifecycle/). Lit defines a set of callbacks that you can override to hook into the component's lifecycle—for example, to run code when the element's added to a page, or whenever the component updates.

Here's a sample component:

{% playground-example "v3-docs/components/overview/simple-greeting" "simple-greeting.ts" %}

<div code-language="ts">

{% aside "info"%}

This example uses TypeScript decorators.

See the [Decorators](/docs/v3/components/decorators) documentation for more information on configuring TypeScript for decorators.

{% endaside %}

</div>


<!-- source: packages/lit-dev-content/site/docs/v3/composition/overview.md -->

---
title: Composition overview
eleventyNavigation:
  parent: Composition
  key: Overview
  order: 1
versionLinks:
  v2: composition/overview/
---

Composition is a strategy for managing complexity and organizing code into reusable pieces. Lit provides a few options for composition and code reuse:

*   Component composition.
*   Reactive controllers.
*   Class mixins.

[_Component composition_](/docs/v3/composition/component-composition/) is the process of assembling complex components from simpler components. A component can use subcomponents in its template. Components can use standard DOM mechanisms to communicate: setting properties on subcomponents, and listening for events from subcomponents.

Although component composition is the default way to think about breaking a complex Lit project down into smaller units, there are two other notable code patterns useful for factoring your Lit code:

[_Reactive controllers_](/docs/v3/composition/controllers/) are objects that can hook into the update lifecycle of a Lit component, encapsulating state and behavior related to a feature into a separate unit of code.

[_Class mixins_](/docs/v3/composition/mixins/) let you write reusable partial component definitions and "mix them in" to a component's inheritance chain.

Both mixins and reactive controllers let you factor component logic related to a given feature into a reusable unit. See the next section for a comparison of controllers and mixins.

## Controllers and mixins

Controllers and class mixins are very similar in some ways. They both can hook into a host component's lifecycle, maintain state, and trigger host updates.

The primary difference between controllers and mixins is their relationship with the component. A component has a "has-a" relationship with a reactive controller, since it owns the controller. A component has an "is-a" relationship with a mixin, since the component is an instance of the mixin class.

A reactive controller is a separate object owned by a component. The controller can access methods and fields on the component, and the component can access methods and fields on the controller. But the controller can't (easily) be accessed by someone using the component, unless the component exposes a public API to it. The controller's lifecycle methods are called _before_ the corresponding lifecycle method on the component.

A mixin, on the other hand, becomes part of the component's prototype chain. Any public fields or methods defined by the mixin are part of the component's API. And because a mixin is part of the prototype chain, your component has some control of when the mixin's lifecycle callbacks are called.

In general, if you're trying to decide whether to package a feature as a controller or a mixin, you should choose a controller _unless_ the feature requires one of the following:

*   Adding public API to the component.
*   Very granular access to the component lifecycle.


<!-- source: packages/lit-dev-content/site/docs/v3/localization/overview.md -->

---
title: Localization
eleventyNavigation:
  key: Overview
  parent: Localization
  order: 1
versionLinks:
  v2: localization/overview/
---

Localization is the process of supporting multiple languages and regions in your
apps and components. Lit has first-party support for localization through the
`@lit/localize` library, which has a number of advantages that can make it a
good choice over third-party localization libraries:

- Native support for expressions and HTML markup inside localized templates. No
  need for a new syntax and interpolation runtime for variable substitution—just
  use the templates you already have.

- Automatic re-rendering of Lit components when the locale switches.

- Only 1.27 KiB (minified + compressed) of extra JavaScript.

- Optionally compile for each locale, reducing extra JavaScript to 0 KiB.

## Installation

Install the `@lit/localize` client library and the `@lit/localize-tools`
command-line interface.

```sh
npm i @lit/localize
npm i -D @lit/localize-tools
```

## Quick start

1. Wrap a string or template in the `msg` function
   ([details](#making-strings-and-templates-localizable)).
2. Create a `lit-localize.json` config file ([details](#config-file)).
3. Run `lit-localize extract` to generate an XLIFF file ([details](#extracting-messages)).
4. Edit the generated XLIFF file to add a `<target>` translation tag
   ([details](#translation-with-xliff)).
5. Run `lit-localize build` to output a localized version of your strings and
   templates ([details](#output-modes)).
