---
name: playwright-docs-09
description: "Playwright (GUI-walk driver) — vendor doc 09/30 (docs)"
type: reference
---

## Editable

Element is considered editable when it is [enabled] and is **not readonly**.

Element is **readonly** when:
- it is a `<select>`, `<input>` or `<textarea>` with a `[readonly]` attribute;
- it has an `[aria-readonly=true]` attribute and an aria role that [supports it](https://w3c.github.io/aria/#aria-readonly).

## Receives Events

Element is considered receiving pointer events when it is the hit target of the pointer event at the action point. For example, when clicking at the point `(10;10)`, Playwright checks whether some other element (usually an overlay) will instead capture the click at `(10;10)`.


For example, consider a scenario where Playwright will click `Sign Up` button regardless of when the [`method: Locator.click`] call was made:
- page is checking that user name is unique and `Sign Up` button is disabled;
- after checking with the server, the disabled `Sign Up` button is replaced with another one that is now enabled.

[Visible]: #visible "Visible"
[Stable]: #stable "Stable"
[Enabled]: #enabled "Enabled"
[Editable]: #editable "Editable"
[Receives Events]: #receives-events "Receives Events"


<!-- source: docs/src/api-testing-js.md -->

---
id: api-testing
title: "API testing"
---

## Introduction

Playwright can be used to get access to the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) API of
your application.

Sometimes you may want to send requests to the server directly from Node.js without loading a page and running js code in it.
A few examples where it may come in handy:
- Test your server API.
- Prepare server side state before visiting the web application in a test.
- Validate server side post-conditions after running some actions in the browser.

All of that could be achieved via [APIRequestContext] methods.

## Writing API Test

[APIRequestContext] can send all kinds of HTTP(S) requests over network.

The following example demonstrates how to use Playwright to test issues creation via [GitHub API](https://docs.github.com/en/rest). The test suite will do the following:
- Create a new repository before running tests.
- Create a few issues and validate server state.
- Delete the repository after running tests.

### Configuration

GitHub API requires authorization, so we'll configure the token once for all tests. While at it, we'll also set the `baseURL` to simplify the tests. You can either put them in the configuration file, or in the test file with `test.use()`.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  }
});
```

**Proxy configuration**

If your tests need to run behind a proxy, you can specify this in the config and the `request` fixture
will pick it up automatically:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    proxy: {
      server: 'http://my-proxy:8080',
      username: 'user',
      password: 'secret'
    },
  }
});
```

### Writing tests

Playwright Test comes with the built-in `request` fixture that respects configuration options like `baseURL` or `extraHTTPHeaders` we specified and is ready to send some requests.

Now we can add a few tests that will create new issues in the repository.
```js
const REPO = 'test-repo-1';
const USER = 'github-username';

test('should create a bug report', async ({ request }) => {
  const newIssue = await request.post(`/repos/${USER}/${REPO}/issues`, {
    data: {
      title: '[Bug] report 1',
      body: 'Bug description',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  const issues = await request.get(`/repos/${USER}/${REPO}/issues`);
  expect(issues.ok()).toBeTruthy();
  expect(await issues.json()).toContainEqual(expect.objectContaining({
    title: '[Bug] report 1',
    body: 'Bug description'
  }));
});

test('should create a feature request', async ({ request }) => {
  const newIssue = await request.post(`/repos/${USER}/${REPO}/issues`, {
    data: {
      title: '[Feature] request 1',
      body: 'Feature description',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  const issues = await request.get(`/repos/${USER}/${REPO}/issues`);
  expect(issues.ok()).toBeTruthy();
  expect(await issues.json()).toContainEqual(expect.objectContaining({
    title: '[Feature] request 1',
    body: 'Feature description'
  }));
});
```

### Setup and teardown

These tests assume that repository exists. You probably want to create a new one before running tests and delete it afterwards. Use `beforeAll` and `afterAll` hooks for that.

```js
test.beforeAll(async ({ request }) => {
  // Create a new repository
  const response = await request.post('/user/repos', {
    data: {
      name: REPO
    }
  });
  expect(response.ok()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  // Delete the repository
  const response = await request.delete(`/repos/${USER}/${REPO}`);
  expect(response.ok()).toBeTruthy();
});
```

## Using request context

Behind the scenes, [`request` fixture](./api/class-fixtures#fixtures-request) will actually call [`method: APIRequest.newContext`]. You can always do that manually if you'd like more control. Below is a standalone script that does the same as `beforeAll` and `afterAll` from above.

```js
import { request } from '@playwright/test';
const REPO = 'test-repo-1';
const USER = 'github-username';

(async () => {
  // Create a context that will issue http requests.
  const context = await request.newContext({
    baseURL: 'https://api.github.com',
  });

  // Create a repository.
  await context.post('/user/repos', {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      // Add GitHub personal access token.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
    data: {
      name: REPO
    }
  });

  // Delete a repository.
  await context.delete(`/repos/${USER}/${REPO}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      // Add GitHub personal access token.
      'Authorization': `token ${process.env.API_TOKEN}`,
    }
  });
})();
```

## Sending API requests from UI tests

While running tests inside browsers you may want to make calls to the HTTP API of your application. It may be helpful if you need to prepare server state before running a test or to check some postconditions on the server after performing some actions in the browser. All of that could be achieved via [APIRequestContext] methods.
