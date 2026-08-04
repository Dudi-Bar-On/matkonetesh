---
name: vitest-docs-06
description: "vitest (test runner) — vendor doc 06/48 (vitest.dev)"
type: reference
---

## include

* **Type:**
  * `(haystack: string, needle: string, message?: string) => void`
  * `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
  * `<T extends object>(haystack: WeakSet<T>, needle: T, message?: string) => void`
  * `<T>(haystack: T, needle: Partial<T>, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a value in an array, a substring in a string, or a subset of properties in an object.

```ts
import { assert, test } from 'vitest'

test('assert.include', () => {
  assert.include([1, 2, 3], 2, 'array contains value')
  assert.include('foobar', 'foo', 'string contains substring')
  assert.include({ foo: 'bar', hello: 'universe' }, { foo: 'bar' }, 'object contains property')
})
```

## notInclude

* **Type:**
  * `(haystack: string, needle: string, message?: string) => void`
  * `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
  * `<T extends object>(haystack: WeakSet<T>, needle: T, message?: string) => void`
  * `<T>(haystack: T, needle: Partial<T>, message?: string) => void`

Asserts that `haystack` does not include `needle`. It can be used to assert the absence of a value in an array, a substring in a string, or a subset of properties in an object.

```ts
import { assert, test } from 'vitest'

test('assert.notInclude', () => {
  assert.notInclude([1, 2, 3], 4, 'array doesn\'t contain 4')
  assert.notInclude('foobar', 'baz', 'foobar doesn\'t contain baz')
  assert.notInclude({ foo: 'bar', hello: 'universe' }, { foo: 'baz' }, 'object doesn\'t contain property')
})
```

## deepInclude

* **Type:**
* `(haystack: string, needle: string, message?: string) => void`
* `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
* `<T>(haystack: T, needle: T extends WeakSet<any> ? never : Partial<T>, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a value in an array or a subset of properties in an object. Deep equality is used.

```ts
import { assert, test } from 'vitest'

const obj1 = { a: 1 }
const obj2 = { b: 2 }

test('assert.deepInclude', () => {
  assert.deepInclude([obj1, obj2], { a: 1 })
  assert.deepInclude({ foo: obj1, bar: obj2 }, { foo: { a: 1 } })
})
```

## notDeepInclude

* **Type:**
  * `(haystack: string, needle: string, message?: string) => void`
  * `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
  * `<T>(haystack: T, needle: T extends WeakSet<any> ? never : Partial<T>, message?: string) => void`

Asserts that `haystack` does not include `needle`. It can be used to assert the absence of a value in an array or a subset of properties in an object. Deep equality is used.

```ts
import { assert, test } from 'vitest'

const obj1 = { a: 1 }
const obj2 = { b: 2 }

test('assert.notDeepInclude', () => {
  assert.notDeepInclude([obj1, obj2], { a: 10 })
  assert.notDeepInclude({ foo: obj1, bar: obj2 }, { foo: { a: 10 } })
})
```

## nestedInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object. Enables the use of dot- and bracket-notation for referencing nested properties. ‘\[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.nestedInclude', () => {
  assert.nestedInclude({ '.a': { b: 'x' } }, { '\\.a.[b]': 'x' })
  assert.nestedInclude({ a: { '[b]': 'x' } }, { 'a.\\[b\\]': 'x' })
})
```

## notNestedInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` does not include `needle`. Can be used to assert the inclusion of a subset of properties in an object. Enables the use of dot- and bracket-notation for referencing nested properties. ‘\[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.nestedInclude', () => {
  assert.notNestedInclude({ '.a': { b: 'x' } }, { '\\.a.b': 'y' })
  assert.notNestedInclude({ a: { '[b]': 'x' } }, { 'a.\\[b\\]': 'y' })
})
```

## deepNestedInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object while checking for deep equality. Enables the use of dot- and bracket-notation for referencing nested properties. ‘\[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.deepNestedInclude', () => {
  assert.deepNestedInclude({ a: { b: [{ x: 1 }] } }, { 'a.b[0]': { x: 1 } })
  assert.deepNestedInclude({ '.a': { '[b]': { x: 1 } } }, { '\\.a.\\[b\\]': { x: 1 } })
})
```

## notDeepNestedInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` not includes `needle`. Can be used to assert the absence of a subset of properties in an object while checking for deep equality. Enables the use of dot- and bracket-notation for referencing nested properties. ‘\[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepNestedInclude', () => {
  assert.notDeepNestedInclude({ a: { b: [{ x: 1 }] } }, { 'a.b[0]': { y: 1 } })
  assert.notDeepNestedInclude({ '.a': { '[b]': { x: 1 } } }, { '\\.a.\\[b\\]': { y: 2 } })
})
```

## ownInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object while ignoring inherited properties.

```ts
import { assert, test } from 'vitest'

test('assert.ownInclude', () => {
  assert.ownInclude({ a: 1 }, { a: 1 })
})
```

## notOwnInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the absence of a subset of properties in an object while ignoring inherited properties.

```ts
import { assert, test } from 'vitest'

const obj1 = {
  b: 2
}

const obj2 = object.create(obj1)
obj2.a = 1

test('assert.notOwnInclude', () => {
  assert.notOwnInclude(obj2, { b: 2 })
})
```

## deepOwnInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object while ignoring inherited properties and checking for deep equality.

```ts
import { assert, test } from 'vitest'

test('assert.deepOwnInclude', () => {
  assert.deepOwnInclude({ a: { b: 2 } }, { a: { b: 2 } })
})
```

## notDeepOwnInclude

* **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` not includes `needle`. Can be used to assert the absence of a subset of properties in an object while ignoring inherited properties and checking for deep equality.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepOwnInclude', () => {
  assert.notDeepOwnInclude({ a: { b: 2 } }, { a: { c: 3 } })
})
```
