---
name: vitest-docs-10
description: "vitest (test runner) — vendor doc 10/48 (vitest.dev)"
type: reference
---

## sameDeepOrderedMembers

* **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` have the same members in the same order. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.sameDeepOrderedMembers', () => {
  assert.sameDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }, { c: 3 }], 'same deep ordered members')
})
```

## notSameDeepOrderedMembers

* **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` don’t have the same members in the same order. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.notSameDeepOrderedMembers', () => {
  assert.notSameDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }, { z: 5 }], 'not same deep ordered members')
  assert.notSameDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { c: 3 }], 'not same deep ordered members')
})
```

## includeMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in any order. Uses a strict equality check (===). Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.includeMembers', () => {
  assert.includeMembers([1, 2, 3], [2, 1, 2], 'include members')
})
```

## notIncludeMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn't included in `superset` in any order. Uses a strict equality check (===). Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.notIncludeMembers', () => {
  assert.notIncludeMembers([1, 2, 3], [5, 1], 'not include members')
})
```

## includeDeepMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in any order. Uses a deep equality check. Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.includeDeepMembers', () => {
  assert.includeDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { b: 2 }], 'include deep members')
})
```

## notIncludeDeepMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn’t included in `superset` in any order. Uses a deep equality check. Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.notIncludeDeepMembers', () => {
  assert.notIncludeDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { f: 5 }], 'not include deep members')
})
```

## includeOrderedMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in the same order beginning with the first element in `superset`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.includeOrderedMembers', () => {
  assert.includeOrderedMembers([1, 2, 3], [1, 2], 'include ordered members')
})
```

## notIncludeOrderedMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn't included in `superset` in the same order beginning with the first element in `superset`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notIncludeOrderedMembers', () => {
  assert.notIncludeOrderedMembers([1, 2, 3], [2, 1], 'not include ordered members')
  assert.notIncludeOrderedMembers([1, 2, 3], [2, 3], 'not include ordered members')
})
```

## includeDeepOrderedMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in the same order beginning with the first element in `superset`. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.includeDeepOrderedMembers', () => {
  assert.includeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }], 'include deep ordered members')
})
```

## notIncludeDeepOrderedMembers

* **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn’t included in `superset` in the same order beginning with the first element in superset. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.includeDeepOrderedMembers', () => {
  assert.notIncludeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { f: 5 }], 'not include deep ordered members')
  assert.notIncludeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }], 'not include deep ordered members')
  assert.notIncludeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { c: 3 }], 'not include deep ordered members')
})
```

## oneOf

* **Type:** `<T>(inList: T, list: T[], message?: string) => void`

Asserts that non-object, non-array value `inList` appears in the flat array `list`.

```ts
import { assert, test } from 'vitest'

test('assert.oneOf', () => {
  assert.oneOf(1, [2, 1], 'Not found in list')
})
```

## changes

* **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` changes the `object` of a `property`.

```ts
import { assert, test } from 'vitest'

test('assert.changes', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 22 };
  assert.changes(fn, obj, 'val')
})
```

## changesBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` changes the `object` of a `property` by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.changesBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 2 };
  assert.changesBy(fn, obj, 'val', 2)
})
```

## doesNotChange

* **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` does not changes the `object` of a `property`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotChange', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 2 };
  assert.doesNotChange(fn, obj, 'val', 2)
})
```

## changesButNotBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change:number, message?: string) => void`

Asserts that a `modifier` does not change the `object` of a `property` or of a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.changesButNotBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 10 };
  assert.changesButNotBy(fn, obj, 'val', 5)
})
```

## increases

* **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` increases a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.increases', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 13 };
  assert.increases(fn, obj, 'val')
})
```

## increasesBy

* **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` increases a numeric `object`'s `property` or a `modifier` return value by an `change`.

```ts
import { assert, test } from 'vitest'

test('assert.increasesBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 10 };
  assert.increasesBy(fn, obj, 'val', 10)
})
```
