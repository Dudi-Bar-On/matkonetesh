---
name: lit-docs-24
description: "Lit (renderer web components) — vendor doc 24/30 (packages)"
type: reference
---

### CSS inheritance {#inheritance}

CSS inheritance lets parent and host elements propagate certain CSS properties to their descendants.

Not all CSS properties inherit. Inherited CSS properties include:

* `color`
* `font-family` and other `font-*` properties
* All CSS custom properties (`--*`)

See [CSS Inheritance on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/inheritance) for more information.

You can use CSS inheritance to set styles on an ancestor element that are inherited by its descendants:

```html
<style>
html {
  color: green;
}
</style>
<my-element>
  #shadow-root
    Will be green
</my-element>
```

### CSS custom properties {#customprops}

All CSS custom properties (<code>--<var>custom-property-name</var></code>) inherit. You can use this to make your component's styles configurable from outside.

The following component sets its background color to a CSS variable. The CSS variable uses the value of `--my-background` if it's been set by a selector matching an ancestor in the DOM tree, and otherwise defaults to `yellow`:

```js
class MyElement extends LitElement {
  static styles = css`
    :host {
      background-color: var(--my-background, yellow);
    }
  `;
  render() {
    return html`<p>Hello world</p>`;
  }
}
```

Users of this component can set the value of `--my-background`, using the `my-element` tag as a CSS selector:

```html
<style>
  my-element {
    --my-background: rgb(67, 156, 144);
  }
</style>
<my-element></my-element>
```

`--my-background` is configurable per instance of `my-element`:

```html
<style>
  my-element {
    --my-background: rgb(67, 156, 144);
  }
  my-element.stuff {
    --my-background: #111111;
  }
</style>
<my-element></my-element>
<my-element class="stuff"></my-element>
```

See [CSS Custom Properties on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) for more information.


<!-- source: packages/lit-dev-content/site/docs/v3/composition/component-composition.md -->

---
title: Component composition
eleventyNavigation:
  parent: Composition
  key: Component composition
  order: 2
versionLinks:
  v2: composition/component-composition/
---

The most common way to handle complexity and factor Lit code into separate units is _component composition_: that is, the process of building a large, complex component out of smaller, simpler components. Imagine you've been tasked with implementing a screen of UI:

![Screenshot of an application that displays a set of animal photos. The application has a top bar with a title ("Fuzzy") and a menu button. A left menu drawer is open, showing a set of options.](/images/docs/composition/fuzzy-screenshot.png)


You can probably identify the areas which will involve some complexity to implement. Chances are, those could be components.

By isolating the complexity into specific components, you make the job much simpler, and you can then compose these components together to create the overall design.

For example, the fairly simple screenshot above involves a number of possible components: a top bar, a menu button,  a drawer with menu items for navigating the current section; and a main content area. Each of these could be represented by a component. A complex component, like a drawer with a navigation menu, might be broken into many smaller components: the drawer itself, a button to open and close the drawer, the menu, individual menu items.

Lit lets you compose by adding elements to your template—whether those are built-in HTML elements or custom elements.

```js
render() {
  return html`
    <top-bar>
      <icon-button icon="menu" slot="nav-button"></icon-button>
      <span slot="title">Fuzzy</span>
    </top-bar>
    `;
}
```

##  What makes a good component

When deciding how to break up functionality, there are several things that help identify when to make a new component. A piece of UI may be a good candidate for a component if one or more of the following applies:

*   It has its own state.
*   It has its own template.
*   It's used in more than one place, either in this component or in multiple components.
*   It focuses on doing one thing well.
*   It has a well-defined API.

Reusable controls like buttons, checkboxes, and input fields can make great components. But more complex UI pieces like drawers and carousels are also great candidates for componentization.


##  Passing data up and down the tree

When exchanging data with subcomponents, the general rule is to follow the model of the DOM: _properties down_, _events up_.

*   Properties down. Setting properties on a subcomponent is usually preferable to calling methods on the subcomponent. It's easy to set properties in Lit templates and other declarative template systems.

*   Events up. In the web platform, firing events is the default method for elements to send information up the tree, often in response to user interactions. This lets the host component respond to the event, or transform or re-fire the event for ancestors farther up the tree.

A few implications of this model:

*   A component should be the source of truth for the subcomponents in its shadow DOM. Subcomponents shouldn't set properties or call methods on their host component.

*   If a component changes a public property on itself, it should fire an event to notify components higher in the tree. Generally these changes will be the result of user actions—like pressing a button or selecting a menu item. Think of the native `input` element, which fires an event when the user changes the value of the input.

Consider a menu component that includes a set of menu items and exposes `items` and `selectedItem` properties as part of its public API. Its DOM structure might look like this:


![A hierarchy of DOM nodes representing a menu. The top node, my-menu, has a ShadowRoot, which contains three my-item elements.](/images/docs/composition/composition-menu-component.png){.light-bg}

When the user selects an item, the `my-menu` element should update its `selectedItem` property. It should also fire an event to notify any owning component that the selection has changed. The complete sequence would be something like this:

- The user interacts with an item, causing an event to fire (either a standard event like `click`, or some event specific to the `my-item` component).
- The `my-menu` element gets the event, and updates its `selectedItem` property. It may also change some state so that the selected item is highlighted.
- The `my-menu` element fires a semantic event indicating that the selection has changed. This event might be called `selected-item-changed`, for example. Since this event is part of the API for `my-menu`, it should be semantically meaningful in that context.

For more information on dispatching and listening for events, see [Events](/docs/v3/components/events/).
