---
name: vitest-docs-04
description: "vitest (test runner) — vendor doc 04/48 (vitest.dev)"
type: reference
---

#### Deep Exact Matching (`/children: deep-equal`)

Like `equal`, but the strict matching **propagates to all descendants**. Every level of nesting must match exactly — same count, same order, no extra nodes at any depth.

```ts
await expect.element(page.getByRole('navigation')).toMatchAriaInlineSnapshot(`
  - navigation "Main":
    - /children: deep-equal
    - link "Home":
      - /url: /
    - link "About":
      - /url: /about
`)
```

With `deep-equal`, every child of each `link` must also match exactly. If a link had an extra child node not listed in the template, the assertion would fail.

#### Comparison

| Mode | Directive | Behavior |
| --- | --- | --- |
| Partial | *(default)* or `/children: contain` | Template children are an ordered subsequence — extra actual children are ignored |
| Exact | `/children: equal` | Immediate children must match exactly; descendants still use partial matching |
| Deep exact | `/children: deep-equal` | All children at every depth must match exactly |

---

---
url: /api/assert.md
---
# assert

Vitest reexports the `assert` method from [`chai`](https://www.chaijs.com/api/assert/) for verifying invariants.

## assert

* **Type:** `(expression: any, message?: string) => asserts expression`

Assert that the given `expression` is truthy, otherwise the assertion fails.

```ts
import { assert, test } from 'vitest'

test('assert', () => {
  assert('foo' !== 'bar', 'foo should not be equal to bar')
})
```

## fail

* **Type:**
  * `(message?: string) => never`
  * `<T>(actual: T, expected: T, message?: string, operator?: string) => never`

Force an assertion failure.

```ts
import { assert, test } from 'vitest'

test('assert.fail', () => {
  assert.fail('error message on failure')
  assert.fail('foo', 'bar', 'foo is not bar', '===')
})
```

## isOk

* **Type:** `<T>(value: T, message?: string) => asserts value`
* **Alias:** `ok`

Assert that the given `value` is truthy.

```ts
import { assert, test } from 'vitest'

test('assert.isOk', () => {
  assert.isOk('foo', 'every truthy is ok')
  assert.isOk(false, 'this will fail since false is not truthy')
})
```

## isNotOk

* **Type:** `<T>(value: T, message?: string) => void`
* **Alias:** `notOk`

Assert that the given `value` is falsy.

```ts
import { assert, test } from 'vitest'

test('assert.isNotOk', () => {
  assert.isNotOk('foo', 'this will fail, every truthy is not ok')
  assert.isNotOk(false, 'this will pass since false is falsy')
})
```

## equal

* **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts non-strict equality (==) of `actual` and `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.equal', () => {
  assert.equal(Math.sqrt(4), '2')
})
```

## notEqual

* **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts non-strict inequality (!=) of `actual` and `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.equal', () => {
  assert.notEqual(Math.sqrt(4), 3)
})
```

## strictEqual

* **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts strict equality (===) of `actual` and `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.strictEqual', () => {
  assert.strictEqual(Math.sqrt(4), 2)
})
```

## deepEqual

* **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts that `actual` is deeply equal to `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.deepEqual', () => {
  assert.deepEqual({ color: 'green' }, { color: 'green' })
})
```

## notDeepEqual

* **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Assert that `actual` is not deeply equal to `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepEqual', () => {
  assert.notDeepEqual({ color: 'green' }, { color: 'red' })
})
```

## isAbove

* **Type:** `(valueToCheck: number, valueToBeAbove: number, message?: string) => void`

Assert that `valueToCheck` is strictly greater than (>) `valueToBeAbove`.

```ts
import { assert, test } from 'vitest'

test('assert.isAbove', () => {
  assert.isAbove(5, 2, '5 is strictly greater than 2')
})
```

## isAtLeast

* **Type:** `(valueToCheck: number, valueToBeAtLeast: number, message?: string) => void`

Assert that `valueToCheck` is greater than or equal to (>=) `valueToBeAtLeast`.

```ts
import { assert, test } from 'vitest'

test('assert.isAtLeast', () => {
  assert.isAtLeast(5, 2, '5 is greater or equal to 2')
  assert.isAtLeast(3, 3, '3 is greater or equal to 3')
})
```

## isBelow

* **Type:** `(valueToCheck: number, valueToBeBelow: number, message?: string) => void`

Asserts `valueToCheck` is strictly less than (<) `valueToBeBelow`.

```ts
import { assert, test } from 'vitest'

test('assert.isBelow', () => {
  assert.isBelow(3, 6, '3 is strictly less than 6')
})
```

## isAtMost

* **Type:** `(valueToCheck: number, valueToBeAtMost: number, message?: string) => void`

Asserts `valueToCheck` is less than or equal to (<=) `valueToBeAtMost`.

```ts
import { assert, test } from 'vitest'

test('assert.isAtMost', () => {
  assert.isAtMost(3, 6, '3 is less than or equal to 6')
  assert.isAtMost(4, 4, '4 is less than or equal to 4')
})
```

## isTrue

* **Type:** `<T>(value: T, message?: string) => asserts value is true`

Asserts that `value` is true.

```ts
import { assert, test } from 'vitest'

const testPassed = true

test('assert.isTrue', () => {
  assert.isTrue(testPassed)
})
```

## isNotTrue

* **Type:** `<T>(value: T, message?: string) => asserts value is Exclude<T, true>`

Asserts that `value` is not true.

```ts
import { assert, test } from 'vitest'

const testPassed = 'ok'

test('assert.isNotTrue', () => {
  assert.isNotTrue(testPassed)
})
```

## isFalse

* **Type:** `<T>(value: T, message?: string) => asserts value is false`

Asserts that `value` is false.

```ts
import { assert, test } from 'vitest'

const testPassed = false

test('assert.isFalse', () => {
  assert.isFalse(testPassed)
})
```

## isNotFalse

* **Type:** `<T>(value: T, message?: string) => asserts value is Exclude<T, false>`

Asserts that `value` is not false.

```ts
import { assert, test } from 'vitest'

const testPassed = 'no'

test('assert.isNotFalse', () => {
  assert.isNotFalse(testPassed)
})
```

## isNull

* **Type:** `<T>(value: T, message?: string) => asserts value is null`

Asserts that `value` is null.

```ts
import { assert, test } from 'vitest'

const error = null

test('assert.isNull', () => {
  assert.isNull(error, 'error is null')
})
```

## isNotNull

* **Type:** `<T>(value: T, message?: string) => asserts value is Exclude<T, null>`

Asserts that `value` is not null.

```ts
import { assert, test } from 'vitest'

const error = { message: 'error was occurred' }

test('assert.isNotNull', () => {
  assert.isNotNull(error, 'error is not null but object')
})
```

## isNaN

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is NaN.

```ts
import { assert, test } from 'vitest'

const calculation = 1 * 'vitest'

test('assert.isNaN', () => {
  assert.isNaN(calculation, '1 * "vitest" is NaN')
})
```

## isNotNaN

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not NaN.

```ts
import { assert, test } from 'vitest'

const calculation = 1 * 2

test('assert.isNotNaN', () => {
  assert.isNotNaN(calculation, '1 * 2 is Not NaN but 2')
})
```
