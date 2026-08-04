---
name: playwright-docs-15
description: "Playwright (GUI-walk driver) — vendor doc 15/30 (docs)"
type: reference
---

## Moderate: one account per parallel worker
* langs: js

This is the **recommended** approach for tests that **modify server-side state**. In Playwright, worker processes run in parallel. In this approach, each parallel worker is authenticated once. All tests ran by worker are reusing the same authentication state. We will need multiple testing accounts, one per each parallel worker.

**When to use**
- Your tests modify shared server-side state. For example, one test checks the rendering of the settings page, while the other test is changing the setting.

**When not to use**
- Your tests do not modify any shared server-side state. In this case, all tests can use a single shared account.

**Details**

We will authenticate once per [worker process](./test-parallel.md#worker-processes), each with a unique account.

Create `playwright/fixtures.ts` file that will [override `storageState` fixture](./test-fixtures.md#overriding-fixtures) to authenticate once per worker. Use [`property: TestInfo.parallelIndex`] to differentiate between workers.

```js title="playwright/fixtures.ts"
import { test as baseTest, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export * from '@playwright/test';
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // Use the same storage state for all tests in this worker.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  // Authenticate once per worker with a worker-scoped fixture.
  workerStorageState: [async ({ browser }, use) => {
    // Use parallelIndex as a unique identifier for each worker.
    const id = test.info().parallelIndex;
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);

    if (fs.existsSync(fileName)) {
      // Reuse existing authentication state if any.
      await use(fileName);
      return;
    }

    // Important: make sure we authenticate in a clean environment by unsetting storage state.
    const page = await browser.newPage({ storageState: undefined });

    // Acquire a unique account, for example create a new one.
    // Alternatively, you can have a list of precreated accounts for testing.
    // Make sure that accounts are unique, so that multiple team members
    // can run tests at the same time without interference.
    const account = await acquireAccount(id);

    // Perform authentication steps. Replace these actions with your own.
    await page.goto('https://github.com/login');
    await page.getByLabel('Username or email address').fill(account.username);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Wait until the page receives the cookies.
    //
    // Sometimes login flow sets cookies in the process of several redirects.
    // Wait for the final URL to ensure that the cookies are actually set.
    await page.waitForURL('https://github.com/');
    // Alternatively, you can wait until the page reaches a state where all cookies are set.
    await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();

    // End of authentication steps.

    await page.context().storageState({ path: fileName });
    await page.close();
    await use(fileName);
  }, { scope: 'worker' }],
});
```

Now, each test file should import `test` from our fixtures file instead of `@playwright/test`. No changes are needed in the config.

```js title="tests/example.spec.ts"
// Important: import our fixtures.
import { test, expect } from '../playwright/fixtures';

test('test', async ({ page }) => {
  // page is authenticated
});
```


## Signing in before each test
* langs: java, python, csharp

The Playwright API can [automate interaction](./input.md) with a login form.

The following example logs into GitHub. Once these steps are executed,
the browser context will be authenticated.

```java
Page page = context.newPage();
page.navigate("https://github.com/login");
// Interact with login form
page.getByLabel("Username or email address").fill("username");
page.getByLabel("Password").fill("password");
page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"))
    .click();
// Continue with the test
```

```python async
page = await context.new_page()
await page.goto('https://github.com/login')

# Interact with login form
await page.get_by_label("Username or email address").fill("username")
await page.get_by_label("Password").fill("password")
await page.get_by_role("button", name="Sign in").click()
# Continue with the test
```

```python sync
page = context.new_page()
page.goto('https://github.com/login')

# Interact with login form
page.get_by_label("Username or email address").fill("username")
page.get_by_label("Password").fill("password")
page.get_by_role("button", name="Sign in").click()
# Continue with the test
```

```csharp
var page = await context.NewPageAsync();
await page.GotoAsync("https://github.com/login");
// Interact with login form
await page.GetByLabel("Username or email address").FillAsync("username");
await page.GetByLabel("Password").FillAsync("password");
await page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();
// Continue with the test
```

Redoing login for every test can slow down test execution. To mitigate that, reuse
existing authentication state instead.

## Reusing signed in state
* langs: java, csharp, python

Playwright provides a way to reuse the signed-in state in the tests. That way you can log
in only once and then skip the log in step for all of the tests.

Web apps use cookie-based or token-based authentication, where authenticated state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage), in [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), or as passkeys ([WebAuthn](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API) credentials). Playwright provides [`method: BrowserContext.storageState`] method that can be used to retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

Cookies, local storage, IndexedDB and virtual WebAuthn credentials (passkeys) can be used across different browsers. They depend on your application's authentication model which may require some combination of cookies, local storage, IndexedDB or passkeys.

The following code snippet retrieves state from an authenticated context and creates a new context with that state.

```java
// Save storage state into the file.
context.storageState(new BrowserContext.StorageStateOptions().setPath(Paths.get("state.json")));

// Create a new context with the saved storage state.
BrowserContext context = browser.newContext(
  new Browser.NewContextOptions().setStorageStatePath(Paths.get("state.json")));
```

```python async
# Save storage state into the file.
storage = await context.storage_state(path="state.json")

# Create a new context with the saved storage state.
context = await browser.new_context(storage_state="state.json")
```

```python sync
# Save storage state into the file.
storage = context.storage_state(path="state.json")
