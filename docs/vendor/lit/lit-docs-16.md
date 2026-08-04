---
name: lit-docs-16
description: "Lit (renderer web components) — vendor doc 16/30 (packages)"
type: reference
---

### Avoiding issues with class fields when declaring properties {#avoiding-issues-with-class-fields}

[Class fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields) have a problematic interaction with reactive properties. Class fields are defined on the element instance whereas reactive properties are defined as accessors on the element prototype. According to the rules of JavaScript, an instance property takes precedence over and effectively hides a prototype property. This means that reactive property accessors do not function when class fields are used such that setting the property won't trigger an element update.

```js
class MyElement extends LitElement {
  static properties = {foo: {type: String}}
  foo = 'Default'; // ❌ this will make `foo` not reactive
}
```

In **JavaScript**, you **must not use class fields** when declaring reactive properties. Instead, properties must be initialized in the element constructor:
```js
class MyElement extends LitElement {
  static properties = {
    foo: {type: String}
  }
  constructor() {
    super();
    this.foo = 'Default';
  }
}
```

Alternatively, you may use [standard decorators with Babel](/docs/v3/components/decorators/#decorators-babel) to declare reactive properties.
```ts
class MyElement extends LitElement {
  @property()
  accessor foo = 'Default';
}
```

For **TypeScript**, you **may use class fields** for declaring reactive properties as long as you use one of these patterns:
* Set the `useDefineForClassFields` compiler option to `false`. This is already the recommendation when [using decorators with TypeScript](/docs/v3/components/decorators/#decorators-typescript).
```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true, // If using decorators
    "useDefineForClassFields": false,
  }
}
```
```ts
class MyElement extends LitElement {
  static properties = {foo: {type: String}}
  foo = 'Default';

  @property()
  bar = 'Default';
}
```

* Add the `declare` keyword on the field, and put the field's initializer in the constructor.
```ts
class MyElement extends LitElement {
  declare foo: string;
  static properties = {foo: {type: String}}
  constructor() {
    super();
    this.foo = 'Default';
  }
}
```

* Add the `accessor` keyword on the field to use [auto-accessors](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#auto-accessors-in-classes).
```ts
class MyElement extends LitElement {
  static properties = {foo: {type: String}}
  accessor foo = 'Default';

  @property()
  accessor bar = 'Default';
}
```

### Property options

The options object can have the following properties:

<dl>
<dt>

`attribute`

</dt>
<dd>

Whether the property is associated with an attribute, or a custom name for the associated attribute. Default: true. If `attribute` is false, the `converter`, `reflect` and `type` options are ignored. For more information, see [Setting the attribute name](#observed-attributes).

</dd>
<dt>

`converter`

</dt>
<dd>

A [custom converter](#conversion-converter) for converting between properties and attributes. If unspecified, use the [default attribute converter](#conversion-type).

</dd>
<dt>

`hasChanged`

</dt>
<dd>

A function called whenever the property is set to determine if the property has changed, and should trigger an update. If unspecified, LitElement uses a strict inequality check (`newValue !== oldValue`) to determine whether the property value has changed.
For more information, see [Customizing change detection](#haschanged).

</dd>
<dt>

`noAccessor`

</dt>
<dd>

Set to true to avoid generating the default property accessors. This option is rarely necessary. Default: false. For more information, see [Preventing Lit from generating a property accessor](#accessors-noaccessor).

</dd>
<dt>

`reflect`

</dt>
<dd>

Whether property value is reflected back to the associated attribute. Default: false. For more information, see [Enabling attribute reflection](#reflected-attributes).

</dd>
<dt>

`state`

</dt>
<dd>

Set to true to declare the property as _internal reactive state_. Internal reactive state triggers updates like public reactive properties, but Lit doesn't generate an attribute for it, and users shouldn't access it from outside the component. Equivalent to using the `@state` decorator. Default: false. For more information, see [Internal reactive state](#internal-reactive-state).

</dd>
<dt>

`type`

</dt>
<dd>

When converting a string-valued attribute into a property, Lit's default attribute converter will parse the string into the type given, and vice-versa when reflecting a property to an attribute. If `converter` is set, this field is passed to the converter. If `type` is unspecified, the default converter treats it as `type: String`. See [Using the default converter](#conversion-type).

When using TypeScript, this field should generally match the TypeScript type declared for the field. However, the `type` option is used by the Lit's _runtime_ for string serialization/deserialization, and should not be confused with a _type-checking_ mechanism.

</dd>
<dt id="use-default">

`useDefault`

</dt>
<dd>

Set to true to prevent initial attribute reflection for the default value when `reflect` is set to true, and to reset the property to its default value when its corresponding attribute is removed.

The default value is the property's initial value set in the constructor or with an [auto-accessor](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#auto-accessors-in-classes). This value is retained in memory so it's a good practice to avoid setting `useDefault: true` for non-primitive Object/Array properties. For more information, see [Enabling attribute reflection](#reflected-attributes) and [Best practices when reflecting attributes](#best-practices-when-reflecting-attributes).

</dd>

Omitting the options object or specifying an empty options object is equivalent to specifying the default value for all options.

## Internal reactive state

*Internal reactive state* refers to reactive properties that are  not part of the component's public API. These state properties don't have corresponding attributes, and aren't intended to be used from outside the component. Internal reactive state should be set by the component itself.

Use the `@state` decorator to declare internal reactive state:

```ts
@state()
protected _active = false;
```

Using the static `properties` class field, you can declare internal reactive state by using the `state: true` option.

```js
static properties = {
  _active: {state: true}
};

constructor() {
  this._active = false;
}
```

Internal reactive state shouldn't be referenced from outside the component. In TypeScript, these properties should be marked as private or protected. We also recommend using a convention like a leading underscore (`_`) to identify private or protected properties for JavaScript users.

Internal reactive state works just like public reactive properties, except that there is no attribute associated with the property. **The only option you can specify for internal reactive state is the `hasChanged` function.**

The `@state` decorator can also serve as a hint to a code minifier that the property name can be changed during minification.
