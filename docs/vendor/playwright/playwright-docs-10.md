---
name: playwright-docs-10
description: "Playwright (GUI-walk driver) — vendor doc 10/30 (docs)"
type: reference
---

### Establishing preconditions

The following test creates a new issue via API and then navigates to the list of all issues in the
project to check that it appears at the top of the list.

```js
import { test, expect } from '@playwright/test';

const REPO = 'test-repo-1';
const USER = 'github-username';

// Request context is reused by all tests in the file.
let apiContext;

test.beforeAll(async ({ playwright }) => {
  apiContext = await playwright.request.newContext({
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  });
});

test.afterAll(async ({ }) => {
  // Dispose all responses.
  await apiContext.dispose();
});

test('last created issue should be first in the list', async ({ page }) => {
  const newIssue = await apiContext.post(`/repos/${USER}/${REPO}/issues`, {
    data: {
      title: '[Feature] request 1',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  await page.goto(`https://github.com/${USER}/${REPO}/issues`);
  const firstIssue = page.locator(`a[data-hovercard-type='issue']`).first();
  await expect(firstIssue).toHaveText('[Feature] request 1');
});
```

### Validating postconditions

The following test creates a new issue via user interface in the browser and then uses checks if
it was created via API:

```js
import { test, expect } from '@playwright/test';

const REPO = 'test-repo-1';
const USER = 'github-username';

// Request context is reused by all tests in the file.
let apiContext;

test.beforeAll(async ({ playwright }) => {
  apiContext = await playwright.request.newContext({
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  });
});

test.afterAll(async ({ }) => {
  // Dispose all responses.
  await apiContext.dispose();
});

test('last created issue should be on the server', async ({ page }) => {
  await page.goto(`https://github.com/${USER}/${REPO}/issues`);
  await page.getByText('New Issue').click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Bug report 1');
  await page.getByRole('textbox', { name: 'Comment body' }).fill('Bug description');
  await page.getByText('Submit new issue').click();
  const issueId = new URL(page.url()).pathname.split('/').pop();

  const newIssue = await apiContext.get(
      `https://api.github.com/repos/${USER}/${REPO}/issues/${issueId}`
  );
  expect(newIssue.ok()).toBeTruthy();
  expect(newIssue.json()).toEqual(expect.objectContaining({
    title: 'Bug report 1'
  }));
});
```

## Reusing authentication state

Web apps use cookie-based or token-based authentication, where authenticated
state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies).
Playwright provides [`method: APIRequestContext.storageState`] method that can be used to
retrieve storage state from an authenticated context and then create new contexts with that state.

Storage state is interchangeable between [BrowserContext] and [APIRequestContext]. You can
use it to log in via API calls and then create a new context with cookies already there.
The following code snippet retrieves state from an authenticated [APIRequestContext] and
creates a new [BrowserContext] with that state.

```js
const requestContext = await request.newContext({
  httpCredentials: {
    username: 'user',
    password: 'passwd'
  }
});
await requestContext.get(`https://api.example.com/login`);
// Save storage state into the file.
await requestContext.storageState({ path: 'state.json' });

// Create a new context with the saved storage state.
const context = await browser.newContext({ storageState: 'state.json' });
```
