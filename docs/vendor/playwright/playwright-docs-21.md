---
name: playwright-docs-21
description: "Playwright (GUI-walk driver) — vendor doc 21/30 (docs)"
type: reference
---

## How Playwright Achieves Test Isolation

Playwright uses browser contexts to achieve Test Isolation. Each test has its own Browser Context. Running the test creates a new browser context each time.  When using Playwright as a Test Runner, browser contexts are created by default. Otherwise, you can create browser contexts manually.

```js tab=js-test
import { test } from '@playwright/test';

test('example test', async ({ page, context }) => {
  // "context" is an isolated BrowserContext, created for this specific test.
  // "page" belongs to this context.
});

test('another test', async ({ page, context }) => {
  // "context" and "page" in this second test are completely
  // isolated from the first test.
});
```

```js tab=js-library
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
```

```java
Browser browser = chromium.launch();
BrowserContext context = browser.newContext();
Page page = context.newPage();
```

```python async
browser = await playwright.chromium.launch()
context = await browser.new_context()
page = await context.new_page()
```

```python sync
browser = playwright.chromium.launch()
context = browser.new_context()
page = context.new_page()
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Chromium.LaunchAsync();
var context = await browser.NewContextAsync();
var page = await context.NewPageAsync();
```

Browser contexts can also be used to emulate multi-page scenarios involving mobile devices, permissions, locale and color scheme. Check out our [Emulation](./emulation.md) guide for more details.

## Multiple Contexts in a Single Test

Playwright can create multiple browser contexts within a single scenario. This is useful when you want to test for multi-user functionality, like a chat.

```js tab=js-test
import { test } from '@playwright/test';

test('admin and user', async ({ browser }) => {
  // Create two isolated browser contexts
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();

  // Create pages and interact with contexts independently
  const adminPage = await adminContext.newPage();
  const userPage = await userContext.newPage();
});
```

```js tab=js-library
const { chromium } = require('playwright');

// Create a Chromium browser instance
const browser = await chromium.launch();

// Create two isolated browser contexts
const userContext = await browser.newContext();
const adminContext = await browser.newContext();

// Create pages and interact with contexts independently
const adminPage = await adminContext.newPage();
const userPage = await userContext.newPage();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      // Create a Chromium browser instance
      Browser browser = chromium.launch();
      // Create two isolated browser contexts
      BrowserContext userContext = browser.newContext();
      BrowserContext adminContext = browser.newContext();
      // Create pages and interact with contexts independently
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    # create a chromium browser instance
    chromium = playwright.chromium
    browser = await chromium.launch()

    # create two isolated browser contexts
    user_context = await browser.new_context()
    admin_context = await browser.new_context()

    # create pages and interact with contexts independently

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    # create a chromium browser instance
    chromium = playwright.chromium
    browser = chromium.launch()

    # create two isolated browser contexts
    user_context = browser.new_context()
    admin_context = browser.new_context()

    # create pages and interact with contexts independently

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        // Create a Chromium browser instance
        await using var browser = await playwright.Chromium.LaunchAsync();
        await using var userContext = await browser.NewContextAsync();
        await using var adminContext = await browser.NewContextAsync();
        // Create pages and interact with contexts independently.
    }
}
```


<!-- source: docs/src/browsers.md -->

---
id: browsers
title: "Browsers"
---

## Introduction

Each version of Playwright needs specific versions of browser binaries to operate. You will need to use the Playwright CLI to install these browsers.

With every release, Playwright updates the versions of the browsers it supports, so that the latest Playwright would support the latest browsers at any moment. It means that every time you update Playwright, you might need to re-run the `install` CLI command.

## Install browsers

Playwright can install supported browsers. Running the command without arguments will install the default browsers.

```bash js
npx playwright install
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```bash python
playwright install
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 install
```

You can also install specific browsers by providing an argument:

```bash js
npx playwright install webkit
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install webkit"
```

```bash python
playwright install webkit
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 install webkit
```

See all supported browsers:

```bash js
npx playwright install --help
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --help"
```

```bash python
playwright install --help
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 install --help
```

### Install browsers via API
* langs: csharp

It's possible to run Command line tools commands via the .NET API:

```csharp
var exitCode = Microsoft.Playwright.Program.Main(new[] {"install"});
if (exitCode != 0)
{
    throw new Exception($"Playwright exited with code {exitCode}");
}
```
