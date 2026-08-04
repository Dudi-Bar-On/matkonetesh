---
name: vitest-docs-39
description: "vitest (test runner) — vendor doc 39/48 (vitest.dev)"
type: reference
---

### From Jest + Testing Library

Most Jest + Testing Library tests work with minimal changes:

```ts
// Before (Jest)
import { render, screen } from '@testing-library/react' // [!code --]

// After (Vitest)
import { render } from 'vitest-browser-react' // [!code ++]
```

### Key Differences

* Use `await expect.element()` instead of `expect()` for DOM assertions
* Use `vitest/browser` for user interactions instead of `@testing-library/user-event`
* Browser Mode provides real browser environment for accurate testing

## Learn More

* [Browser Mode Documentation](/guide/browser/)
* [Assertion API](/api/browser/assertions)
* [Interactivity API](/api/browser/interactivity)
* [Example Repository](https://github.com/vitest-tests/browser-examples)

---

---
url: /config/browser/playwright.md
---
# Configuring Playwright

To run tests using playwright, you need to install the [`@vitest/browser-playwright`](https://npmx.dev/package/@vitest/browser-playwright) npm package and specify its `playwright` export in the `test.browser.provider` property of your config:

```ts [vitest.config.js]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      instances: [{ browser: 'chromium' }]
    },
  },
})
```

You can configure the [`launchOptions`](https://playwright.dev/docs/api/class-browsertype#browser-type-launch), [`connectOptions`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect) and [`contextOptions`](https://playwright.dev/docs/api/class-browser#browser-new-context) when calling `playwright` at the top level or inside instances:

```ts{7-14,21-26} [vitest.config.js]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      // shared provider options between all instances
      provider: playwright({
        launchOptions: {
          slowMo: 50,
          channel: 'chrome-beta',
        },
        actionTimeout: 5_000,
      }),
      instances: [
        { browser: 'chromium' },
        {
          browser: 'firefox',
          // overriding options only for a single instance
          // this will NOT merge options with the parent one
          provider: playwright({
            launchOptions: {
              firefoxUserPrefs: {
                'browser.startup.homepage': 'https://example.com',
              },
            },
          })
        }
      ],
    },
  },
})
```

::: warning
Unlike Playwright test runner, Vitest opens a *single* page to run all tests that are defined in the same file. This means that isolation is restricted to a single test file, not to every individual test.
:::

## launchOptions

These options are directly passed down to `playwright[browser].launch` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

::: warning
Vitest will ignore `launch.headless` option. Instead, use [`test.browser.headless`](/config/browser/headless).

Note that Vitest will push debugging flags to `launch.args` if [`--inspect`](/guide/cli#inspect) is enabled.
:::

::: tip Enabling new Chromium headless mode
Playwright supports a [new headless mode](https://playwright.dev/docs/browsers#chromium-new-headless-mode) for Chromium that uses the real Chrome browser instead of the dedicated headless shell. This provides more authentic, reliable test execution and removes the need to install a separate headless Chromium build.

To opt in, set `channel` to `'chromium'` in `launchOptions`:

```ts [vitest.config.ts]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      headless: true,
      provider: playwright({
        launchOptions: {
          channel: 'chromium',
        },
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

:::

## connectOptions

These options are directly passed down to `playwright[browser].connect` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect).

Use `connectOptions.wsEndpoint` to connect to an existing Playwright server instead of launching browsers locally. This is useful for running browsers in Docker, in CI, or on a remote machine.

::: warning

Vitest forwards `launchOptions` to Playwright server via the `x-playwright-launch-options` header. This works only if the remote Playwright server supports this header, for example when using the `playwright run-server` CLI.

:::

::: details Example: Running a Playwright Server in Docker
To run browsers in a Docker container (see [Playwright Docker guide](https://playwright.dev/docs/docker#remote-connection)):

Start a Playwright server using Docker Compose:

```yaml [docker-compose.yml]
services:
  playwright:
    image: mcr.microsoft.com/playwright:v1.58.1-noble
    command: /bin/sh -c "npx -y playwright@1.58.1 run-server --port 6677 --host 0.0.0.0"
    init: true
    ipc: host
    user: pwuser
    ports:
      - '6677:6677'
```

```sh
docker compose up -d
```

Then configure Vitest to connect to it. The [`exposeNetwork`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-option-expose-network) option lets the containerized browser reach Vitest's dev server on the host:

```ts [vitest.config.ts]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: playwright({
        connectOptions: {
          wsEndpoint: 'ws://127.0.0.1:6677/',
          exposeNetwork: '<loopback>',
        },
      }),
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
})
```

:::

## contextOptions

Vitest creates a new context for every test file by calling [`browser.newContext()`](https://playwright.dev/docs/api/class-browsercontext). You can configure this behaviour by specifying [custom arguments](https://playwright.dev/docs/api/class-browser#browser-new-context).

::: tip
Note that the context is created for every *test file*, not every *test* like in playwright test runner.
:::

::: warning
Vitest always sets `ignoreHTTPSErrors` to `true` in case your server is served via HTTPS and `serviceWorkers` to `'allow'` to support module mocking via [MSW](https://mswjs.io).

It is also recommended to use [`test.browser.viewport`](/config/browser/headless) instead of specifying it here as it will be lost when tests are running in headless mode.
:::

## `actionTimeout`

* **Default:** no timeout

This value configures the default timeout it takes for Playwright to wait until all accessibility checks pass and [the action](/api/browser/interactivity) is actually done.

You can also configure the action timeout per-action:

```ts
import { page, userEvent } from 'vitest/browser'

await userEvent.click(page.getByRole('button'), {
  timeout: 1_000,
})
```
