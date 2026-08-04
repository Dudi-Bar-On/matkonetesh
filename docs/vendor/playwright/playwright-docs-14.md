---
name: playwright-docs-14
description: "Playwright (GUI-walk driver) — vendor doc 14/30 (docs)"
type: reference
---

#### Input with `aria-invalid` attribute

The `aria-invalid` value is surfaced directly. A value of `true` renders as `[invalid]`, while `grammar`
and `spelling` render as `[invalid=grammar]` and `[invalid=spelling]`. A `false` value is omitted.

```html
<input type="text" aria-label="Email" aria-invalid="true" value="not-an-email">
```

```yaml title="aria snapshot"
- textbox "Email" [invalid]: not-an-email
```

```html
<input type="text" aria-label="Bio" aria-invalid="spelling">
```

```yaml title="aria snapshot"
- textbox "Bio" [invalid=spelling]
```


<!-- source: docs/src/auth.md -->

---
id: auth
title: "Authentication"
---

## Introduction

Playwright executes tests in isolated environments called [browser contexts](./browser-contexts.md). This isolation model improves reproducibility and prevents cascading test failures. Tests can load existing authenticated state. This eliminates the need to authenticate in every test and speeds up test execution.

## Core concepts

Regardless of the authentication strategy you choose, you are likely to store authenticated browser state on the file system.

We recommend to create `playwright/.auth` directory and add it to your `.gitignore`. Your authentication routine will produce authenticated browser state and save it to a file in this `playwright/.auth` directory. Later on, tests will reuse this state and start already authenticated.

:::danger
The browser state file may contain sensitive cookies and headers that could be used to impersonate you or your test account.
We strongly discourage checking them into private or public repositories.
:::

```bash tab=bash-bash
mkdir -p playwright/.auth
echo $'\nplaywright/.auth' >> .gitignore
```

```batch tab=bash-batch
md playwright\.auth
echo. >> .gitignore
echo "playwright/.auth" >> .gitignore
```

```powershell tab=bash-powershell
New-Item -ItemType Directory -Force -Path playwright\.auth
Add-Content -path .gitignore "`r`nplaywright/.auth"
```

## Basic: shared account in all tests
* langs: js

This is the **recommended** approach for tests **without server-side state**. Authenticate once in the **setup project**, save the authentication state, and then reuse it to bootstrap each test already authenticated.

**When to use**
- When you can imagine all your tests running at the same time with the same account, without affecting each other.

**When not to use**
- Your tests modify server-side state. For example, one test checks the rendering of the settings page, while the other test is changing the setting, and you run tests in parallel. In this case, tests must use different accounts.
- Your authentication is browser-specific.

**Details**

Create `tests/auth.setup.ts` that will prepare authenticated browser state for all other tests.

```js title="tests/auth.setup.ts"
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('username');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL('https://github.com/');
  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();

  // End of authentication steps.

  await page.context().storageState({ path: authFile });
});
```

Create a new `setup` project in the config and declare it as a [dependency](./test-projects.md#dependencies) for all your testing projects. This project will always run and authenticate before all the tests. All testing projects should use the authenticated state as `storageState`.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Setup project
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use prepared auth state.
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Use prepared auth state.
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

Tests start already authenticated because we specified `storageState` in the config.

```js title="tests/example.spec.ts"
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // page is authenticated
});
```

Note that you need to delete the stored state when it expires. If you don't need to keep the state between test runs, write the browser state under [`property: TestProject.outputDir`], which is automatically cleaned up before every test run.

### Authenticating in UI mode
* langs: js

UI mode will not run the `setup` project by default to improve testing speed. We recommend to authenticate by manually running the `auth.setup.ts` from time to time, whenever existing authentication expires.

First [enable the `setup` project in the filters](./test-ui-mode#filtering-tests), then click the triangle button next to `auth.setup.ts` file, and then disable the `setup` project in the filters again.
