---
name: playwright-docs-11
description: "Playwright (GUI-walk driver) — vendor doc 11/30 (docs)"
type: reference
---

## Context request vs global request

There are two types of [APIRequestContext]:
* associated with a [BrowserContext]
* isolated instance, created via [`method: APIRequest.newContext`]

The main difference is that [APIRequestContext] accessible via [`property: BrowserContext.request`] and
[`property: Page.request`] will populate request's `Cookie` header from the browser context and will
automatically update browser cookies if [APIResponse] has `Set-Cookie` header:

```js
test('context request will share cookie storage with its browser context', async ({
  page,
  context,
}) => {
  await context.route('https://www.github.com/', async route => {
    // Send an API request that shares cookie storage with the browser context.
    const response = await context.request.fetch(route.request());
    const responseHeaders = response.headers();

    // The response will have 'Set-Cookie' header.
    const responseCookies = new Map(responseHeaders['set-cookie']
        .split('\n')
        .map(c => c.split(';', 2)[0].split('=')));
    // The response will have 3 cookies in 'Set-Cookie' header.
    expect(responseCookies.size).toBe(3);
    const contextCookies = await context.cookies();
    // The browser context will already contain all the cookies from the API response.
    expect(new Map(contextCookies.map(({ name, value }) =>
      [name, value])
    )).toEqual(responseCookies);

    await route.fulfill({
      response,
      headers: { ...responseHeaders, foo: 'bar' },
    });
  });
  await page.goto('https://www.github.com/');
});
```

If you don't want [APIRequestContext] to use and update cookies from the browser context, you can manually
create a new instance of [APIRequestContext] which will have its own isolated cookies:

```js
test('global context request has isolated cookie storage', async ({
  page,
  context,
  browser,
  playwright
}) => {
  // Create a new instance of APIRequestContext with isolated cookie storage.
  const request = await playwright.request.newContext();
  await context.route('https://www.github.com/', async route => {
    const response = await request.fetch(route.request());
    const responseHeaders = response.headers();

    const responseCookies = new Map(responseHeaders['set-cookie']
        .split('\n')
        .map(c => c.split(';', 2)[0].split('=')));
    // The response will have 3 cookies in 'Set-Cookie' header.
    expect(responseCookies.size).toBe(3);
    const contextCookies = await context.cookies();
    // The browser context will not have any cookies from the isolated API request.
    expect(contextCookies.length).toBe(0);

    // Manually export cookie storage.
    const storageState = await request.storageState();
    // Create a new context and initialize it with the cookies from the global request.
    const browserContext2 = await browser.newContext({ storageState });
    const contextCookies2 = await browserContext2.cookies();
    // The new browser context will already contain all the cookies from the API response.
    expect(
        new Map(contextCookies2.map(({ name, value }) => [name, value]))
    ).toEqual(responseCookies);

    await route.fulfill({
      response,
      headers: { ...responseHeaders, foo: 'bar' },
    });
  });
  await page.goto('https://www.github.com/');
  await request.dispose();
});
```


<!-- source: docs/src/aria-snapshots.md -->

---
id: aria-snapshots
title: "Snapshot testing"
---
import LiteYouTube from '@site/src/components/LiteYouTube';

## Overview

With Playwright's Snapshot testing you can assert the accessibility tree of a page against a predefined snapshot template.

```js
await page.goto('https://playwright.dev/');
await expect(page).toMatchAriaSnapshot(`
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started":
      - /url: /docs/intro
    - link "Star microsoft/playwright on GitHub":
      - /url: https://github.com/microsoft/playwright
    - link /[\\d]+k\\+ stargazers on GitHub/
`);
```

```python sync
page.goto('https://playwright.dev/')
expect(page).to_match_aria_snapshot("""
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started":
      - /url: /docs/intro
    - link "Star microsoft/playwright on GitHub":
      - /url: https://github.com/microsoft/playwright
    - link /[\\d]+k\\+ stargazers on GitHub/
""")
```

```python async
await page.goto('https://playwright.dev/')
await expect(page).to_match_aria_snapshot("""
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started":
      - /url: /docs/intro
    - link "Star microsoft/playwright on GitHub":
      - /url: https://github.com/microsoft/playwright
    - link /[\\d]+k\\+ stargazers on GitHub/
""")
```

```java
page.navigate("https://playwright.dev/");
assertThat(page).matchesAriaSnapshot("""
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started":
      - /url: /docs/intro
    - link "Star microsoft/playwright on GitHub":
      - /url: https://github.com/microsoft/playwright
    - link /[\\d]+k\\+ stargazers on GitHub/
""");
```

```csharp
await page.GotoAsync("https://playwright.dev/");
await Expect(page).ToMatchAriaSnapshotAsync(@"
  - banner:
    - heading ""Playwright enables reliable end-to-end testing for modern web apps."" [level=1]
    - link ""Get started"":
      - /url: /docs/intro
    - link ""Star microsoft/playwright on GitHub"":
      - /url: https://github.com/microsoft/playwright
    - link /[\\d]+k\\+ stargazers on GitHub/
");
```

<LiteYouTube
    id="P4R6hnsE0UY"
    title="Getting started with ARIA Snapshots"
/>

## Assertion testing vs Snapshot testing

Snapshot testing and assertion testing serve different purposes in test automation:

### Assertion testing
Assertion testing is a targeted approach where you assert specific values or conditions about elements or components. For instance, with Playwright, [`method: LocatorAssertions.toHaveText`]
verifies that an element contains the expected text, and [`method: LocatorAssertions.toHaveValue`]
confirms that an input field has the expected value.
Assertion tests are specific and generally check the current state of an element or property
against an expected, predefined state.
They work well for predictable, single-value checks but are limited in scope when testing the
broader structure or variations.

**Advantages**
- **Clarity**: The intent of the test is explicit and easy to understand.
- **Specificity**: Tests focus on particular aspects of functionality, making them more robust
  against unrelated changes.
- **Debugging**: Failures provide targeted feedback, pointing directly to the problematic aspect.

**Disadvantages**
- **Verbose for complex outputs**: Writing assertions for complex data structures or large outputs
  can be cumbersome and error-prone.
- **Maintenance overhead**: As code evolves, manually updating assertions can be time-consuming.
