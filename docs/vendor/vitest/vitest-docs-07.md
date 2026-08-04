---
name: vitest-docs-07
description: "vitest (test runner) — vendor doc 07/48 (vitest.dev)"
type: reference
---

## match

* **Type:** `(value: string, regexp: RegExp, message?: string) => void`

Asserts that `value` matches the regular expression `regexp`.

```ts
import { assert, test } from 'vitest'

test('assert.match', () => {
  assert.match('foobar', /^foo/, 'regexp matches')
})
```

## notMatch

* **Type:** `(value: string, regexp: RegExp, message?: string) => void`

Asserts that `value` does not matches the regular expression `regexp`.

```ts
import { assert, test } from 'vitest'

test('assert.notMatch', () => {
  assert.notMatch('foobar', /^foo/, 'regexp does not match')
})
```

## property

* **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property`

```ts
import { assert, test } from 'vitest'

test('assert.property', () => {
  assert.property({ tea: { green: 'matcha' } }, 'tea')
  assert.property({ tea: { green: 'matcha' } }, 'toString')
})
```

## notProperty

* **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property`

```ts
import { assert, test } from 'vitest'

test('assert.notProperty', () => {
  assert.notProperty({ tea: { green: 'matcha' } }, 'coffee')
})
```

## propertyVal

* **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property` with a value given by `value`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notPropertyVal', () => {
  assert.propertyVal({ tea: 'is good' }, 'tea', 'is good')
})
```

## notPropertyVal

* **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property` with a value given by `value`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notPropertyVal', () => {
  assert.notPropertyVal({ tea: 'is good' }, 'tea', 'is bad')
  assert.notPropertyVal({ tea: 'is good' }, 'coffee', 'is good')
})
```

## deepPropertyVal

* **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property` with a value given by `value`. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.deepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' })
})
```

## notDeepPropertyVal

* **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property` with a value given by `value`. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' })
  assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' })
  assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' })
})
```

## nestedProperty

* **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property`, which can be a string using dot- and bracket-notation for nested reference.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.nestedProperty({ tea: { green: 'matcha' } }, 'tea.green')
})
```

## notNestedProperty

* **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property`, which can be a string using dot- and bracket-notation for nested reference.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.notNestedProperty({ tea: { green: 'matcha' } }, 'tea.oolong')
})
```

## nestedPropertyVal

* **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` has a property named by `property` with value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.nestedPropertyVal', () => {
  assert.nestedPropertyVal({ tea: { green: 'matcha' } }, 'tea.green', 'matcha')
})
```

## notNestedPropertyVal

* **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` does not have a property named by `property` with value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notNestedPropertyVal', () => {
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'tea.green', 'konacha')
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'coffee.green', 'matcha')
})
```

## deepNestedPropertyVal

* **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` has a property named by `property` with a value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a deep equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notNestedPropertyVal', () => {
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'tea.green', 'konacha')
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'coffee.green', 'matcha')
})
```

## notDeepNestedPropertyVal

* **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` does not have a property named by `property` with value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepNestedPropertyVal', () => {
  assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { oolong: 'yum' })
  assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { matcha: 'yuck' })
  assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.black', { matcha: 'yum' })
})
```

## lengthOf

* **Type:** `<T extends { readonly length?: number | undefined } | { readonly size?: number | undefined }>(object: T, length: number, message?: string) => void`

Asserts that `object` has a `length` or `size` with the expected value.

```ts
import { assert, test } from 'vitest'

test('assert.lengthOf', () => {
  assert.lengthOf([1, 2, 3], 3, 'array has length of 3')
  assert.lengthOf('foobar', 6, 'string has length of 6')
  assert.lengthOf(new Set([1, 2, 3]), 3, 'set has size of 3')
  assert.lengthOf(new Map([['a', 1], ['b', 2], ['c', 3]]), 3, 'map has size of 3')
})
```
