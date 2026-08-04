---
name: vitest-docs-22
description: "vitest (test runner) — vendor doc 22/48 (vitest.dev)"
type: reference
---

## Examples

By default, you don't need any external packages to work with the Browser Mode:

```js [example.test.js]
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from './my-render-function.js'

test('properly handles form inputs', async () => {
  render() // mount DOM elements

  // Asserts initial state.
  await expect.element(page.getByText('Hi, my name is Alice')).toBeInTheDocument()

  // Get the input DOM node by querying the associated label.
  const usernameInput = page.getByLabelText(/username/i)

  // Type the name into the input. This already validates that the input
  // is filled correctly, no need to check the value manually.
  await usernameInput.fill('Bob')

  await expect.element(page.getByText('Hi, my name is Bob')).toBeInTheDocument()
})
```

However, Vitest also provides packages to render components for several popular frameworks out of the box:

* [`vitest-browser-vue`](https://github.com/vitest-dev/vitest-browser-vue) to render [vue](https://vuejs.org) components
* [`vitest-browser-svelte`](https://github.com/vitest-dev/vitest-browser-svelte) to render [svelte](https://svelte.dev) components
* [`vitest-browser-react`](https://github.com/vitest-dev/vitest-browser-react) to render [react](https://react.dev) components
* [`vitest-browser-angular`](https://github.com/vitest-community/vitest-browser-angular) to render [Angular](https://angular.dev) components

Community packages are available for other frameworks:

* [`vitest-browser-lit`](https://github.com/EskiMojo14/vitest-browser-lit) to render [lit](https://lit.dev) components
* [`vitest-browser-preact`](https://github.com/JoviDeCroock/vitest-browser-preact) to render [preact](https://preactjs.com) components
* [`vitest-browser-qwik`](https://github.com/QwikDev/vitest-browser-qwik) to render [qwik](https://qwik.dev) components

If your framework is not represented, feel free to create your own package - it is a simple wrapper around the framework renderer and `page.elementLocator` API. We will add a link to it on this page. Make sure it has a name starting with `vitest-browser-`.

Besides rendering components and locating elements, you will also need to make assertions. Vitest forks the [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) library to provide a wide range of DOM assertions out of the box. Read more at the [Assertions API](/api/browser/assertions).

```ts
import { expect } from 'vitest'
import { page } from 'vitest/browser'
// element is rendered correctly
await expect.element(page.getByText('Hello World')).toBeInTheDocument()
```

Vitest exposes a [Context API](/api/browser/context) with a small set of utilities that might be useful to you in tests. For example, if you need to make an interaction, like clicking an element or typing text into an input, you can use `userEvent` from `vitest/browser`. Read more at the [Interactivity API](/api/browser/interactivity).

```ts
import { page, userEvent } from 'vitest/browser'
await userEvent.fill(page.getByLabelText(/username/i), 'Alice')
// or just locator.fill
await page.getByLabelText(/username/i).fill('Alice')
```

::: code-group

```ts [vue]
import { render } from 'vitest-browser-vue'
import Component from './Component.vue'

test('properly handles v-model', async () => {
  const screen = render(Component)

  // Asserts initial state.
  await expect.element(screen.getByText('Hi, my name is Alice')).toBeInTheDocument()

  // Get the input DOM node by querying the associated label.
  const usernameInput = screen.getByLabelText(/username/i)

  // Type the name into the input. This already validates that the input
  // is filled correctly, no need to check the value manually.
  await usernameInput.fill('Bob')

  await expect.element(screen.getByText('Hi, my name is Bob')).toBeInTheDocument()
})
```

```ts [svelte]
import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'

import Greeter from './greeter.svelte'

test('greeting appears on click', async () => {
  const screen = render(Greeter, { name: 'World' })

  const button = screen.getByRole('button')
  await button.click()
  const greeting = screen.getByText(/hello world/iu)

  await expect.element(greeting).toBeInTheDocument()
})
```

```tsx [react]
import { render } from 'vitest-browser-react'
import Fetch from './fetch'

test('loads and displays greeting', async () => {
  // Render a React element into the DOM
  const screen = render(<Fetch url="/greeting" />)

  await screen.getByText('Load Greeting').click()
  // wait before throwing an error if it cannot find an element
  const heading = screen.getByRole('heading')

  // assert that the alert message is correct
  await expect.element(heading).toHaveTextContent('hello there')
  await expect.element(screen.getByRole('button')).toBeDisabled()
})
```

```ts [lit]
import { render } from 'vitest-browser-lit'
import { html } from 'lit'
import './greeter-button'

test('greeting appears on click', async () => {
  const screen = render(html`<greeter-button name="World"></greeter-button>`)

  const button = screen.getByRole('button')
  await button.click()
  const greeting = screen.getByText(/hello world/iu)

  await expect.element(greeting).toBeInTheDocument()
})
```

```tsx [preact]
import { render } from 'vitest-browser-preact'
import { createElement } from 'preact'
import Greeting from '.Greeting'

test('greeting appears on click', async () => {
  const screen = render(<Greeting />)

  const button = screen.getByRole('button')
  await button.click()
  const greeting = screen.getByText(/hello world/iu)

  await expect.element(greeting).toBeInTheDocument()
})
```

```tsx [qwik]
import { render } from 'vitest-browser-qwik'
import Greeting from './greeting'

test('greeting appears on click', async () => {
  // renderSSR and renderHook are also available
  const screen = render(<Greeting />)

  const button = screen.getByRole('button')
  await button.click()
  const greeting = screen.getByText(/hello world/iu)

  await expect.element(greeting).toBeInTheDocument()
})
```

:::

Vitest doesn't support all frameworks out of the box, but you can use external tools to run tests with these frameworks. We also encourage the community to create their own `vitest-browser` wrappers - if you have one, feel free to add it to the examples above.

For unsupported frameworks, we recommend using `testing-library` packages:

* [`@solidjs/testing-library`](https://testing-library.com/docs/solid-testing-library/intro) to render [solid](https://www.solidjs.com) components
* [`@marko/testing-library`](https://testing-library.com/docs/marko-testing-library/intro) to render [marko](https://markojs.com) components

You can also see more examples in [`browser-examples`](https://github.com/vitest-tests/browser-examples) repository.

::: warning
`testing-library` provides a package `@testing-library/user-event`. We do not recommend using it directly because it simulates events instead of actually triggering them - instead, use [`userEvent`](/api/browser/interactivity) imported from `vitest/browser` that uses Chrome DevTools Protocol or Webdriver (depending on the provider) under the hood.
:::

::: code-group

```tsx [solid]
// based on @testing-library/solid API
// https://testing-library.com/docs/solid-testing-library/api

import { render } from '@testing-library/solid'
