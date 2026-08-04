---
name: lit-docs-18
description: "Lit (renderer web components) — vendor doc 18/30 (packages)"
type: reference
---

### Using the default converter {#conversion-type}

Lit has a default converter that handles `String`, `Number`, `Boolean`, `Array`, and `Object` property types.

To use the default converter, specify the `type` option in your property declaration:

{% switchable-sample %}

```ts
// Use the default converter
@property({ type: Number })
count = 0;
```

```js
// Use the default converter
static properties = {
  count: { type: Number },
};

constructor() {
  super();
  this.count = 0;
}
```

{% endswitchable-sample %}

If you don't specify a type _or_ a custom converter for a property, it behaves as if you'd specified `type: String`.

The tables below shows how the default converter handles conversion for each type.

**From attribute to property**

| Type    | Conversion |
|:--------|:-----------|
| `String`  | If the element has the corresponding attribute, set the property to the attribute value. |
| `Number`  | If the element has the corresponding attribute, set the property to `Number(attributeValue)`. |
| `Boolean` | If the element has the corresponding attribute, set the property to true.<br>If not, set the property to false. |
| `Object`, `Array` | If the element has the corresponding attribute, set the property value to `JSON.parse(attributeValue)`. |

For any case except `Boolean`, if the element doesn't have the corresponding attribute, the property keeps its default value, or `undefined` if no default is set.

**From property to attribute**

| Type    | Conversion |
|:--------|:-----------|
| `String`, `Number` | If property is defined and non-null, set the attribute to the property value.<br>If property is null or undefined, remove the attribute. |
| `Boolean` | If property is truthy, create the attribute and set its value to an empty string. <br>If property is falsy, remove the attribute |
| `Object`, `Array` | If property is defined and non-null, set the attribute to `JSON.stringify(propertyValue)`.<br>If property is null or undefined, remove the attribute. |


### Providing a custom converter {#conversion-converter}

You can specify a custom property converter in your property declaration with the `converter` option:

```js
myProp: {
  converter: // Custom property converter
}
```

`converter` can be an object or a function. If it is an object, it can have keys for `fromAttribute` and `toAttribute`:

```js
prop1: {
  converter: {
    fromAttribute: (value, type) => {
      // `value` is a string
      // Convert it to a value of type `type` and return it
    },
    toAttribute: (value, type) => {
      // `value` is of type `type`
      // Convert it to a string and return it
    }
  }
}
```

If `converter` is a function, it is used in place of `fromAttribute`:

```js
myProp: {
  converter: (value, type) => {
    // `value` is a string
    // Convert it to a value of type `type` and return it
  }
}
```

If no `toAttribute` function is supplied for a reflected attribute, the attribute is set to the property value using the default converter.

If `toAttribute` returns `null` or `undefined`, the attribute is removed.

### Boolean attributes {#boolean-attributes}

For a boolean property to be configurable from an attribute, **it must default to false**. If it defaults to true, you cannot set it to false from markup, since the presence of the attribute, with or without a value, equates to true. This is the standard behavior for attributes in the web platform.

If this behavior doesn't fit your use case, there are a couple of options:

- Change the property name so it defaults to false. For example, the web platform uses the `disabled` attribute (defaults to false), not `enabled`.

- Use a string-valued or number-valued attribute instead.

### Enabling attribute reflection {#reflected-attributes}

Setting `reflect` to true configures a property so that whenever it changes, its value is reflected to its [corresponding attribute](#observed-attributes). Reflected attributes are useful for serializing element state and because they are visible to CSS and DOM APIs like `querySelector`.

Setting `useDefault` to true prevents the property's default value from initially reflecting to its [corresponding attribute](#observed-attributes). All subsequent changes are reflected; and if the attribute is removed, the property is reset to its default value. 

This matches web platform behavior for attributes like `id`. The default value of an element's `id` property is `''` (an empty string) and initially it does not have an `id` attribute, but if the `id` property is set (even to an empty string), the appropirate `id` attribute is reflected. If the `id` attribute is removed, the element's `id` property is set back to its initial value of `''`.

For example:

```js
// Value of property "active" will reflect to attribute "active"
active: {reflect: true}
// Value of property "variant" will reflect except that the "variant"
// attribute will not be iniitally set to the property's default value.
variant: {reflect: true, useDefault: true}
```

When the property changes, Lit sets the corresponding attribute value as described in [Using the default converter](#conversion-type) or [Providing a custom converter](#conversion-converter).

{% playground-example "properties/attributereflect" "my-element.ts" %}

<div class="alert alert-info">

**Lit tracks reflection state during updates.** You may have realized that if property changes are reflected to an attribute and attribute changes update the property, it has the potential to create an infinite loop. However, Lit tracks when properties and attributes are set specifically to prevent this from happening

</div>

### Best practices when reflecting attributes {#best-practices-when-reflecting-attributes}

To ensure elements behave as expected and perform well, try to follow these best practices when reflecting attributes:

* Attributes should generally be considered input to the element from its owner, rather than under control of the element itself, so reflecting properties to attributes should be done sparingly. Consider instead using the [`:state` pseudo selector](https://wicg.github.io/custom-state-pseudo-class/) and the [Accessibility Object Model](https://wicg.github.io/aom/spec/) where possible.

* Reflecting properties should typically also set `useDefault: true` since this keeps the element from spontaneously spawning attributes that the user didn't set, and helps match expected platform behavior.

* Reflecting properties of type object or array is not recommended. This can cause large objects to serialize to the DOM which can result in poor performance and consume excess memory when `useDefault` is used.
  
* The property decorator does not alter any values assigned to the reactive property, which is considered a best practice for custom accessors. Sometimes native elements restrict properties to certain valid values, for instance, and if an invalid value is assigned to a property, the property will be set to a default instead. `useDefault: true` does not do this - it only restores the default when the attribute is removed. If you'd like to alter the property value on property assignments, define and decorate a custom property setter.
