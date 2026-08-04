---
name: playwright-docs-18
description: "Playwright (GUI-walk driver) — vendor doc 18/30 (docs)"
type: reference
---

### Make tests as isolated as possible

Each test should be completely isolated from another test and should run independently with its own local storage, session storage, data, cookies etc. [Test isolation](./browser-contexts.md) improves reproducibility, makes debugging easier and prevents cascading test failures.

In order to avoid repetition for a particular part of your test you can use [before and after hooks](/api/class-test.md). Within your test file add a before hook to run a part of your test before each test such as going to a particular URL or logging in to a part of your app. This keeps your tests isolated as no test relies on another. However it is also ok to have a little duplication when tests are simple enough especially if it keeps your tests clearer and easier to read and maintain.

```js
import { test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('username');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
});

test('first', async ({ page }) => {
  // page is signed in.
});

test('second', async ({ page }) => {
  // page is signed in.
});
```

You can also reuse the signed-in state in the tests with [setup project](./auth.md#basic-shared-account-in-all-tests). That way you can log in only once and then skip the log in step for all of the tests.

### Avoid testing third-party dependencies

Only test what you control. Don't try to test links to external sites or third party servers that you do not control. Not only is it time consuming and can slow down your tests but also you cannot control the content of the page you are linking to, or if there are cookie banners or overlay pages or anything else that might cause your test to fail.

Instead, use the [Playwright Network API](/network.md#handle-requests) and guarantee the response needed.

```js
await page.route('**/api/fetch_data_third_party_dependency', route => route.fulfill({
  status: 200,
  body: testData,
}));
await page.goto('https://example.com');
```

### Testing with a database

If working with a database then make sure you control the data. Test against a staging environment and make sure it doesn't change. For visual regression tests make sure the operating system and browser versions are the same.

## Best Practices

### Use locators

In order to write end to end tests we need to first find elements on the webpage. We can do this by using Playwright's built in [locators](./locators.md). Locators come with auto waiting and retry-ability. Auto waiting means that Playwright performs a range of actionability checks on the elements, such as ensuring the element is visible and enabled before it performs the click. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts.

```js
// 👍
page.getByRole('button', { name: 'submit' });
```

#### Use chaining and filtering

Locators can be [chained](./locators.md#matching-inside-a-locator) to narrow down the search to a particular part of the page.

```js
const product = page.getByRole('listitem').filter({ hasText: 'Product 2' });
```

You can also [filter locators](./locators.md#filtering-locators) by text or by another locator.

```js
await page
    .getByRole('listitem')
    .filter({ hasText: 'Product 2' })
    .getByRole('button', { name: 'Add to cart' })
    .click();
```

#### Prefer user-facing attributes to XPath or CSS selectors

Your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests. For example consider selecting this button by its CSS classes. Should the designer change something then the class might change, thus breaking your test.


```js
// 👎
page.locator('button.buttonIcon.episode-actions-later');
```

Use locators that are resilient to changes in the DOM.

```js
// 👍
page.getByRole('button', { name: 'submit' });
```
### Generate locators

Playwright has a [test generator](./codegen.md) that can generate tests and pick locators for you. It will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

#### Use `codegen` to generate locators

To pick a locator run the `codegen` command followed by the URL that you would like to pick a locator from.

<Tabs
  groupId="js-package-manager"
  defaultValue="npm"
  values={[
    {label: 'npm', value: 'npm'},
    {label: 'yarn', value: 'yarn'},
    {label: 'pnpm', value: 'pnpm'}
  ]
}>
<TabItem value="npm">

```bash
npx playwright codegen playwright.dev
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright codegen playwright.dev
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright codegen playwright.dev
```

</TabItem>

</Tabs>

This will open a new browser window as well as the Playwright inspector. To pick a locator first click on the 'Record' button to stop the recording. By default when you run the `codegen` command it will start a new recording. Once you stop the recording the 'Pick Locator' button will be available to click.

You can then hover over any element on your page in the browser window and see the locator highlighted below your cursor. Clicking on an element will add the locator into the Playwright inspector. You can either copy the locator and paste into your test file or continue to explore the locator by editing it in the Playwright Inspector, for example by modifying the text, and seeing the results in the browser window.

<img height="1274" width="2788" alt="generating locators with codegen" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212103268-e7d8ee8b-d307-4cba-be13-831f3fbb1f40.png" />

#### Use the VS Code extension to generate locators

You can also use the [VS Code Extension](./getting-started-vscode.md) to generate locators as well as record a test. The VS Code extension also gives you a great developer experience when writing, running, and debugging tests.

<img height="1684" width="2788" alt="generating locators in vs code with codegen" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212269873-aca04043-16ce-4627-906f-7351d09740ab.png" />

### Use web first assertions

Assertions are a way to verify that the expected result and the actual result matched or not. By using [web first assertions](./test-assertions.md) Playwright will wait until the expected condition is met. For example, when testing an alert message, a test would click a button that makes a message appear and check that the alert message is there. If the alert message takes half a second to appear, assertions such as `toBeVisible()` will wait and retry if needed.

```js
// 👍
await expect(page.getByText('welcome')).toBeVisible();

// 👎
expect(await page.getByText('welcome').isVisible()).toBe(true);
```
