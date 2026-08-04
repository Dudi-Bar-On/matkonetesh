---
name: vitest-docs-11
description: "vitest (test runner) — vendor doc 11/48 (vitest.dev)"
type: reference
---

## doesNotIncrease

* **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` does not increases a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotIncrease', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 8 }
  assert.doesNotIncrease(fn, obj, 'val')
})
```

## increasesButNotBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` does not increases a numeric `object`'s `property` or a `modifier` return value by an `change`.

```ts
import { assert, test } from 'vitest'

test('assert.increasesButNotBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 15 };
  assert.increasesButNotBy(fn, obj, 'val', 10)
})
```

## decreases

* **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` decreases a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.decreases', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 5 };
  assert.decreases(fn, obj, 'val')
})
```

## decreasesBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` decreases a numeric `object`'s `property` or a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.decreasesBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val -= 5 };
  assert.decreasesBy(fn, obj, 'val', 5)
})
```

## doesNotDecrease

* **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` dose not decrease a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotDecrease', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 15 }
  assert.doesNotDecrease(fn, obj, 'val')
})
```

## doesNotDecreaseBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` does not decrease a numeric `object`'s `property` or a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotDecreaseBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 5 };
  assert.doesNotDecreaseBy(fn, obj, 'val', 1)
})
```

## decreasesButNotBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` does not decrease a numeric `object`'s `property` or a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.decreasesButNotBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 5 };
  assert.decreasesButNotBy(fn, obj, 'val', 1)
})
```

## ifError

* **Type:** `<T>(object: T, message?: string) => void`

Asserts if `object` is not a false value, and throws if it is a true value. This is added to allow for chai to be a drop-in replacement for Node’s assert class.

```ts
import { assert, test } from 'vitest'

test('assert.ifError', () => {
  const err = new Error('I am a custom error')
  assert.ifError(err) // Rethrows err!
})
```

## isExtensible

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `extensible`

Asserts that `object` is extensible (can have new properties added to it).

```ts
import { assert, test } from 'vitest'

test('assert.isExtensible', () => {
  assert.isExtensible({})
})
```

## isNotExtensible

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `notExtensible`

Asserts that `object` is not extensible (can not have new properties added to it).

```ts
import { assert, test } from 'vitest'

test('assert.isNotExtensible', () => {
  const nonExtensibleObject = Object.preventExtensions({})
  const sealedObject = Object.seal({})
  const frozenObject = Object.freeze({})

  assert.isNotExtensible(nonExtensibleObject)
  assert.isNotExtensible(sealedObject)
  assert.isNotExtensible(frozenObject)
})
```

## isSealed

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `sealed`

Asserts that `object` is sealed (cannot have new properties added to it and its existing properties cannot be removed).

```ts
import { assert, test } from 'vitest'

test('assert.isSealed', () => {
  const sealedObject = Object.seal({})
  const frozenObject = Object.seal({})

  assert.isSealed(sealedObject)
  assert.isSealed(frozenObject)
})
```

## isNotSealed

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `notSealed`

Asserts that `object` is not sealed (can have new properties added to it and its existing properties can be removed).

```ts
import { assert, test } from 'vitest'

test('assert.isNotSealed', () => {
  assert.isNotSealed({})
})
```

## isFrozen

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `frozen`

Asserts that object is frozen (cannot have new properties added to it and its existing properties cannot be modified).

```ts
import { assert, test } from 'vitest'

test('assert.isFrozen', () => {
  const frozenObject = Object.freeze({})
  assert.frozen(frozenObject)
})
```

## isNotFrozen

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `notFrozen`

Asserts that `object` is not frozen (can have new properties added to it and its existing properties can be modified).

```ts
import { assert, test } from 'vitest'

test('assert.isNotFrozen', () => {
  assert.isNotFrozen({})
})
```

## isEmpty

* **Type:** `<T>(target: T, message?: string) => void`
* **Alias:** `empty`

Asserts that the `target` does not contain any values. For arrays and strings, it checks the length property. For Map and Set instances, it checks the size property. For non-function objects, it gets the count of its own enumerable string keys.

```ts
import { assert, test } from 'vitest'

test('assert.isEmpty', () => {
  assert.isEmpty([])
  assert.isEmpty('')
  assert.isEmpty(new Map())
  assert.isEmpty({})
})
```

## isNotEmpty

* **Type:** `<T>(object: T, message?: string) => void`
* **Alias:** `notEmpty`

Asserts that the `target` contains values. For arrays and strings, it checks the length property. For Map and Set instances, it checks the size property. For non-function objects, it gets the count of its own enumerable string keys.

```ts
import { assert, test } from 'vitest'

test('assert.isNotEmpty', () => {
  assert.isNotEmpty([1, 2])
  assert.isNotEmpty('34')
  assert.isNotEmpty(new Set([5, 6]))
  assert.isNotEmpty({ key: 7 })
})
```

---

---
url: /api/browser/assertions.md
---
