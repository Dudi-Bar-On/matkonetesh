---
name: vitest-docs-05
description: "vitest (test runner) — vendor doc 05/48 (vitest.dev)"
type: reference
---

## exists

* **Type:** `<T>(value: T, message?: string) => asserts value is NonNullable<T>`

Asserts that `value` is neither null nor undefined.

```ts
import { assert, test } from 'vitest'

const name = 'foo'

test('assert.exists', () => {
  assert.exists(name, 'foo is neither null nor undefined')
})
```

## notExists

* **Type:** `<T>(value: T, message?: string) => asserts value is null | undefined`

Asserts that `value` is either null nor undefined.

```ts
import { assert, test } from 'vitest'

const foo = null
const bar = undefined

test('assert.notExists', () => {
  assert.notExists(foo, 'foo is null so not exist')
  assert.notExists(bar, 'bar is undefined so not exist')
})
```

## isUndefined

* **Type:** `<T>(value: T, message?: string) => asserts value is undefined`

Asserts that `value` is undefined.

```ts
import { assert, test } from 'vitest'

const name = undefined

test('assert.isUndefined', () => {
  assert.isUndefined(name, 'name is undefined')
})
```

## isDefined

* **Type:** `<T>(value: T, message?: string) => asserts value is Exclude<T, undefined>`

Asserts that `value` is not undefined.

```ts
import { assert, test } from 'vitest'

const name = 'foo'

test('assert.isDefined', () => {
  assert.isDefined(name, 'name is not undefined')
})
```

## isFunction

* **Type:** `<T>(value: T, message?: string) => void`
* **Alias:** `isCallable`
  Asserts that `value` is a function.

```ts
import { assert, test } from 'vitest'

function name() { return 'foo' };

test('assert.isFunction', () => {
  assert.isFunction(name, 'name is function')
})
```

## isNotFunction

* **Type:** `<T>(value: T, message?: string) => void`
* **Alias:** `isNotCallable`

Asserts that `value` is not a function.

```ts
import { assert, test } from 'vitest'

const name = 'foo'

test('assert.isNotFunction', () => {
  assert.isNotFunction(name, 'name is not function but string')
})
```

## isObject

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is an object of type Object (as revealed by Object.prototype.toString). The assertion does not match subclassed objects.

```ts
import { assert, test } from 'vitest'

const someThing = { color: 'red', shape: 'circle' }

test('assert.isObject', () => {
  assert.isObject(someThing, 'someThing is object')
})
```

## isNotObject

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not an object of type Object (as revealed by Object.prototype.toString). The assertion does not match subclassed objects.

```ts
import { assert, test } from 'vitest'

const someThing = 'redCircle'

test('assert.isNotObject', () => {
  assert.isNotObject(someThing, 'someThing is not object but string')
})
```

## isArray

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is an array.

```ts
import { assert, test } from 'vitest'

const color = ['red', 'green', 'yellow']

test('assert.isArray', () => {
  assert.isArray(color, 'color is array')
})
```

## isNotArray

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not an array.

```ts
import { assert, test } from 'vitest'

const color = 'red'

test('assert.isNotArray', () => {
  assert.isNotArray(color, 'color is not array but string')
})
```

## isString

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a string.

```ts
import { assert, test } from 'vitest'

const color = 'red'

test('assert.isString', () => {
  assert.isString(color, 'color is string')
})
```

## isNotString

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not a string.

```ts
import { assert, test } from 'vitest'

const color = ['red', 'green', 'yellow']

test('assert.isNotString', () => {
  assert.isNotString(color, 'color is not string but array')
})
```

## isNumber

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a number.

```ts
import { assert, test } from 'vitest'

const colors = 3

test('assert.isNumber', () => {
  assert.isNumber(colors, 'colors is number')
})
```

## isNotNumber

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not a number.

```ts
import { assert, test } from 'vitest'

const colors = '3 colors'

test('assert.isNotNumber', () => {
  assert.isNotNumber(colors, 'colors is not number but strings')
})
```

## isFinite

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a finite number (not NaN, Infinity).

```ts
import { assert, test } from 'vitest'

const colors = 3

test('assert.isFinite', () => {
  assert.isFinite(colors, 'colors is number not NaN or Infinity')
})
```

## isBoolean

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a boolean.

```ts
import { assert, test } from 'vitest'

const isReady = true

test('assert.isBoolean', () => {
  assert.isBoolean(isReady, 'isReady is a boolean')
})
```

## isNotBoolean

* **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not a boolean.

```ts
import { assert, test } from 'vitest'

const isReady = 'sure'

test('assert.isBoolean', () => {
  assert.isBoolean(isReady, 'isReady is not a boolean but string')
})
```

## typeOf

* **Type:** `<T>(value: T, name: string, message?: string) => void`

Asserts that `value`’s type is `name`, as determined by Object.prototype.toString.

```ts
import { assert, test } from 'vitest'

test('assert.typeOf', () => {
  assert.typeOf({ color: 'red' }, 'object', 'we have an object')
  assert.typeOf(['red', 'green'], 'array', 'we have an array')
  assert.typeOf('red', 'string', 'we have a string')
  assert.typeOf(/red/, 'regexp', 'we have a regular expression')
  assert.typeOf(null, 'null', 'we have a null')
  assert.typeOf(undefined, 'undefined', 'we have an undefined')
})
```

## notTypeOf

* **Type:** `<T>(value: T, name: string, message?: string) => void`

Asserts that `value`’s type is not `name`, as determined by Object.prototype.toString.

```ts
import { assert, test } from 'vitest'

test('assert.notTypeOf', () => {
  assert.notTypeOf('red', 'number', '"red" is not a number')
})
```

## instanceOf

* **Type:** `<T>(value: T, constructor: Function, message?: string) => asserts value is T`

Asserts that `value` is an instance of `constructor`.

```ts
import { assert, test } from 'vitest'

function Person(name) { this.name = name }
const foo = new Person('foo')

class Tea {
  constructor(name) {
    this.name = name
  }
}
const coffee = new Tea('coffee')

test('assert.instanceOf', () => {
  assert.instanceOf(foo, Person, 'foo is an instance of Person')
  assert.instanceOf(coffee, Tea, 'coffee is an instance of Tea')
})
```

## notInstanceOf

* **Type:** `<T>(value: T, constructor: Function, message?: string) => asserts value is Exclude<T, U>`

Asserts that `value` is not an instance of `constructor`.

```ts
import { assert, test } from 'vitest'

function Person(name) { this.name = name }
const foo = new Person('foo')

class Tea {
  constructor(name) {
    this.name = name
  }
}
const coffee = new Tea('coffee')

test('assert.instanceOf', () => {
  assert.instanceOf(foo, Tea, 'foo is not an instance of Tea')
})
```
