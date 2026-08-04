---
name: vitest-docs-33
description: "vitest (test runner) — vendor doc 33/48 (vitest.dev)"
type: reference
---

## CDP Session

Vitest exposes access to raw Chrome DevTools Protocol via the `cdp` method exported from `vitest/browser`. It is mostly useful to library authors to build tools on top of it.

```ts
import { cdp } from 'vitest/browser'

const input = document.createElement('input')
document.body.appendChild(input)
input.focus()

await cdp().send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  text: 'a',
})

expect(input).toHaveValue('a')
```

::: warning
CDP session works only with `playwright` provider and only when using `chromium` browser. You can read more about it in playwright's [`CDPSession`](https://playwright.dev/docs/api/class-cdpsession) documentation.

CDP is a privileged debugging API. It is available only when browser API write and exec operations are enabled through [`browser.api.allowWrite`](/config/browser/api#api-allowwrite), [`browser.api.allowExec`](/config/browser/api#api-allowexec), [`api.allowWrite`](/config/api#api-allowwrite), and [`api.allowExec`](/config/api#api-allowexec).
:::

## Custom Commands

You can also add your own commands via [`browser.commands`](/config/browser/commands) config option. If you develop a library, you can provide them via a `config` hook inside a plugin:

```ts
import type { Plugin } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'

const myCustomCommand: BrowserCommand<[arg1: string, arg2: string]> = ({
  testPath,
  provider
}, arg1, arg2) => {
  if (provider.name === 'playwright') {
    console.log(testPath, arg1, arg2)
    return { someValue: true }
  }

  throw new Error(`provider ${provider.name} is not supported`)
}

export default function BrowserCommands(): Plugin {
  return {
    name: 'vitest:custom-commands',
    config() {
      return {
        test: {
          browser: {
            commands: {
              myCustomCommand,
            }
          }
        }
      }
    }
  }
}
```

Then you can call it inside your test by importing it from `vitest/browser`:

```ts
import { commands } from 'vitest/browser'
import { expect, test } from 'vitest'

test('custom command works correctly', async () => {
  const result = await commands.myCustomCommand('test1', 'test2')
  expect(result).toEqual({ someValue: true })
})

// if you are using TypeScript, you can augment the module
declare module 'vitest/browser' {
  interface BrowserCommands {
    myCustomCommand: (arg1: string, arg2: string) => Promise<{
      someValue: true
    }>
  }
}
```

::: warning
Custom functions will override built-in ones if they have the same name.
:::

### Custom `playwright` commands

Vitest exposes several `playwright` specific properties on the command context.

* `page` references the full page that contains the test iframe. This is the orchestrator HTML and you most likely shouldn't touch it to not break things.
* `frame` is an async method that will resolve tester [`Frame`](https://playwright.dev/docs/api/class-frame). It has a similar API to the `page`, but it doesn't support certain methods. If you need to query an element, you should prefer using `context.iframe` instead because it is more stable and faster.
* `iframe` is a [`FrameLocator`](https://playwright.dev/docs/api/class-framelocator) that should be used to query other elements on the page.
* `context` refers to the unique [BrowserContext](https://playwright.dev/docs/api/class-browsercontext).

```ts
import { BrowserCommand } from 'vitest/node'

export const myCommand: BrowserCommand<[string, number]> = async (
  ctx,
  arg1: string,
  arg2: number
) => {
  if (ctx.provider.name === 'playwright') {
    const element = await ctx.iframe.findByRole('alert')
    const screenshot = await element.screenshot()
    // do something with the screenshot
    return difference
  }
}
```

### Custom `webdriverio` commands

Vitest exposes some `webdriverio` specific properties on the context object.

* `browser` is the `WebdriverIO.Browser` API.

Vitest automatically switches the `webdriver` context to the test iframe by calling `browser.switchFrame` before the command is called, so `$` and `$$` methods refer to the elements inside the iframe, not in the orchestrator, but non-webdriver APIs will still refer to the parent frame context.

---

---
url: /guide/common-errors.md
---

# Common Errors

## Cannot find module './relative-path'

If you receive an error that module cannot be found, it might mean several different things:

1. You misspelled the path. Make sure the path is correct.

2. It's possible that you rely on `baseUrl` in your `tsconfig.json`. Vite doesn't take into account `tsconfig.json` by default, so you might need to install [`vite-tsconfig-paths`](https://npmx.dev/package/vite-tsconfig-paths) yourself, if you rely on this behavior.

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()]
})
```

Or rewrite your path to not be relative to root:

```diff
- import helpers from 'src/helpers'
+ import helpers from '../src/helpers'
```

3. Make sure you don't have relative [aliases](/config/alias). Vite treats them as relative to the file where the import is instead of the root.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '@/': './src/', // [!code --]
      '@/': new URL('./src/', import.meta.url).pathname, // [!code ++]
    }
  }
})
```

## Failed to Terminate Worker

This error can happen when NodeJS's `fetch` is used with [`pool: 'threads'`](/config/pool#threads). See [#3077](https://github.com/vitest-dev/vitest/issues/3077) for details.

The default [`pool: 'forks'`](/config/pool#forks) does not have this issue. If you've explicitly set `pool: 'threads'`, switching back to `'forks'` or using [`'vmForks'`](/config/pool#vmforks) will resolve it.
