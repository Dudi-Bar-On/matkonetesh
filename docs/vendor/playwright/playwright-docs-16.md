---
name: playwright-docs-16
description: "Playwright (GUI-walk driver) — vendor doc 16/30 (docs)"
type: reference
---

# Create a new context with the saved storage state.
context = browser.new_context(storage_state="state.json")
```

```csharp
// Save storage state into the file.
// Tests are executed in <TestProject>\bin\Debug\netX.0\ therefore relative path is used to reference playwright/.auth created in project root
await context.StorageStateAsync(new()
{
    Path = "../../../playwright/.auth/state.json"
});

// Create a new context with the saved storage state.
var context = await browser.NewContextAsync(new()
{
    StorageStatePath = "../../../playwright/.auth/state.json"
});
```


## Advanced scenarios

### Authenticate with API request
* langs: js

**When to use**
- Your web application supports authenticating via API that is easier/faster than interacting with the app UI.

**Details**

We will send the API request with [APIRequestContext] and then save authenticated state as usual.

In the [setup project](#basic-shared-account-in-all-tests):

```js title="tests/auth.setup.ts"
import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ request }) => {
  // Send authentication request. Replace with your own.
  await request.post('https://github.com/login', {
    form: {
      'user': 'user',
      'password': 'password'
    }
  });
  await request.storageState({ path: authFile });
});
```

Alternatively, in a [worker fixture](#moderate-one-account-per-parallel-worker):

```js title="playwright/fixtures.ts"
import { test as baseTest, request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export * from '@playwright/test';
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // Use the same storage state for all tests in this worker.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  // Authenticate once per worker with a worker-scoped fixture.
  workerStorageState: [async ({}, use) => {
    // Use parallelIndex as a unique identifier for each worker.
    const id = test.info().parallelIndex;
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);

    if (fs.existsSync(fileName)) {
      // Reuse existing authentication state if any.
      await use(fileName);
      return;
    }

    // Important: make sure we authenticate in a clean environment by unsetting storage state.
    const context = await request.newContext({ storageState: undefined });

    // Acquire a unique account, for example create a new one.
    // Alternatively, you can have a list of precreated accounts for testing.
    // Make sure that accounts are unique, so that multiple team members
    // can run tests at the same time without interference.
    const account = await acquireAccount(id);

    // Send authentication request. Replace with your own.
    await context.post('https://github.com/login', {
      form: {
        'user': 'user',
        'password': 'password'
      }
    });

    await context.storageState({ path: fileName });
    await context.dispose();
    await use(fileName);
  }, { scope: 'worker' }],
});
```

### Multiple signed in roles
* langs: js

**When to use**
- You have more than one role in your end to end tests, but you can reuse accounts across all tests.

**Details**

We will authenticate multiple times in the setup project.

```js title="tests/auth.setup.ts"
import { test as setup, expect } from '@playwright/test';

const adminFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('admin');
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

  await page.context().storageState({ path: adminFile });
});

const userFile = 'playwright/.auth/user.json';

setup('authenticate as user', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('user');
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

  await page.context().storageState({ path: userFile });
});
```

After that, specify `storageState` for each test file or test group, **instead of** setting it in the config.

```js title="tests/example.spec.ts"
import { test } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('admin test', async ({ page }) => {
  // page is authenticated as admin
});

test.describe(() => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('user test', async ({ page }) => {
    // page is authenticated as a user
  });
});
```

See also about [authenticating in the UI mode](#authenticating-in-ui-mode).

### Testing multiple roles together
* langs: js

**When to use**
- You need to test how multiple authenticated roles interact together, in a single test.

**Details**

Use multiple [BrowserContext]s and [Page]s with different storage states in the same test.

```js title="tests/example.spec.ts"
import { test } from '@playwright/test';

test('admin and user', async ({ browser }) => {
  // adminContext and all pages inside, including adminPage, are signed in as "admin".
  const adminContext = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
  const adminPage = await adminContext.newPage();

  // userContext and all pages inside, including userPage, are signed in as "user".
  const userContext = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
  const userPage = await userContext.newPage();

  // ... interact with both adminPage and userPage ...

  await adminContext.close();
  await userContext.close();
});
```
