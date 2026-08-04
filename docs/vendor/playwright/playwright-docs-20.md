---
name: playwright-docs-20
description: "Playwright (GUI-walk driver) — vendor doc 20/30 (docs)"
type: reference
---

### Keep your Playwright dependency up to date

By keeping your Playwright version up to date you will be able to test your app on the latest browser versions and catch failures before the latest browser version is released to the public.

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
npm install -D @playwright/test@latest
```

</TabItem>

<TabItem value="yarn">

```bash
yarn add --dev @playwright/test@latest
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm install --save-dev @playwright/test@latest
```

</TabItem>

</Tabs>

Check the [release notes](./release-notes.md) to see what the latest version is and what changes have been released.

You can see what version of Playwright you have by running the following command.

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
npx playwright --version
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright --version
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright --version
```

</TabItem>

</Tabs>

### Run tests on CI

Setup CI/CD and run your tests frequently. The more often you run your tests the better. Ideally you should run your tests on each commit and pull request. Playwright comes with a [GitHub actions workflow](/ci-intro.md) so that tests will run on CI for you with no setup required. Playwright can also be setup on the [CI environment](/ci.md) of your choice.

Use Linux when running your tests on CI as it is cheaper. Developers can use whatever environment when running locally but use linux on CI. Consider setting up [Sharding](./test-sharding.md) to make CI faster.


#### Optimize browser downloads on CI

Only install the browsers that you actually need, especially on CI. For example, if you're only testing with Chromium, install just Chromium.

```bash title=".github/workflows/playwright.yml"
# Instead of installing all browsers
npx playwright install --with-deps

# Install only Chromium
npx playwright install chromium --with-deps
```

This saves both download time and disk space on your CI machines.

### Lint your tests

We recommend TypeScript and linting with ESLint for your tests to catch errors early. Use [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises/) [ESLint](https://eslint.org) rule to make sure there are no missing awaits before the asynchronous calls to the Playwright API. On your CI you can run `tsc --noEmit` to ensure that functions are called with the right signature.

### Use parallelism and sharding

Playwright runs tests in [parallel](./test-parallel.md) by default. Tests in a single file are run in order, in the same worker process. If you have many independent tests in a single file, you might want to run them in parallel

```js
import { test } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

test('runs in parallel 1', async ({ page }) => { /* ... */ });
test('runs in parallel 2', async ({ page }) => { /* ... */ });
```

Playwright can [shard](./test-parallel.md#shard-tests-between-multiple-machines) a test suite, so that it can be executed on multiple machines.

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
npx playwright test --shard=1/3
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright test --shard=1/3
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright test --shard=1/3
```

</TabItem>

</Tabs>

## Productivity tips

### Use Soft assertions

If your test fails, Playwright will give you an error message showing what part of the test failed which you can see either in VS Code, the terminal, the HTML report, or the trace viewer. However, you can also use [soft assertions](/test-assertions.md#soft-assertions). These do not immediately terminate the test execution, but rather compile and display a list of failed assertions once the test ended.

```js
// Make a few checks that will not stop the test when failed...
await expect.soft(page.getByTestId('status')).toHaveText('Success');

// ... and continue the test to check more things.
await page.getByRole('link', { name: 'next page' }).click();
```


<!-- source: docs/src/browser-contexts.md -->

---
id: browser-contexts
title: "Isolation"
---

## Introduction

Tests written with Playwright execute in isolated clean-slate environments called browser contexts. This isolation model improves reproducibility and prevents cascading test failures. 

## What is Test Isolation? 

Test Isolation is when each test is completely isolated from another test. Every test runs independently from any other test. This means that each test has its own local storage, session storage, cookies etc. Playwright achieves this using [BrowserContext]s which are equivalent to incognito-like profiles. They are fast and cheap to create and are completely isolated, even when running in a single browser. Playwright creates a context for each test, and provides a default [Page] in that context.

## Why is Test Isolation Important? 

- No failure carry-over. If one test fails it doesn't affect the other test.
- Easy to debug errors or flakiness, because you can run just a single test as many times as you'd like. 
- Don't have to think about the order when running in parallel, sharding, etc.

## Two Ways of Test Isolation

There are two different strategies when it comes to Test Isolation: start from scratch or cleanup in between. The problem with cleaning up in between tests is that it can be easy to forget to clean up and some things are impossible to clean up such as "visited links". State from one test can leak into the next test which could cause your test to fail and make debugging harder as the problem comes from another test. Starting from scratch means everything is new, so if the test fails you only have to look within that test to debug.
