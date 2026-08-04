---
name: playwright-docs-23
description: "Playwright (GUI-walk driver) — vendor doc 23/30 (docs)"
type: reference
---

### Chromium

For Google Chrome, Microsoft Edge and other Chromium-based browsers, by default, Playwright uses open source Chromium builds. Since the Chromium project is ahead of the branded browsers, when the world is on Google Chrome N, Playwright already supports Chromium N+1 that will be released in Google Chrome and Microsoft Edge a few weeks later.

### Chromium: headless shell

Playwright ships a regular Chromium build for headed operations and a separate [chromium headless shell](https://developer.chrome.com/blog/chrome-headless-shell) for headless mode.

If you are only running tests in headless shell (i.e. the `channel` option is **not** specified), for example on CI, you can avoid downloading the full Chromium browser by passing `--only-shell` during installation.

```bash js
# only running tests headlessly
npx playwright install --with-deps --only-shell
```

```bash java
# only running tests headlessly
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps --only-shell"
```

```bash python
# only running tests headlessly
playwright install --with-deps --only-shell
```

```bash csharp
# only running tests headlessly
pwsh bin/Debug/netX/playwright.ps1 install --with-deps --only-shell
```

### Chromium: new headless mode

You can opt into the new headless mode by using `'chromium'` channel. As [official Chrome documentation puts it](https://developer.chrome.com/blog/chrome-headless-shell):

> New Headless on the other hand is the real Chrome browser, and is thus more authentic, reliable, and offers more features. This makes it more suitable for high-accuracy end-to-end web app testing or browser extension testing.

See [issue #33566](https://github.com/microsoft/playwright/issues/33566) for details.

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
});
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setChannel("chromium"));
      Page page = browser.newPage();
      // ...
    }
  }
}
```

```bash python
pytest test_login.py --browser-channel chromium
```

```xml csharp
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <LaunchOptions>
      <Channel>chromium</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```

```bash csharp
dotnet test -- Playwright.BrowserName=chromium Playwright.LaunchOptions.Channel=chromium
```

With the new headless mode, you can skip downloading the headless shell during browser installation by using the `--no-shell` option:

```bash js
# only running tests headlessly
npx playwright install --with-deps --no-shell
```

```bash java
# only running tests headlessly
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps --no-shell"
```

```bash python
# only running tests headlessly
playwright install --with-deps --no-shell
```

```bash csharp
# only running tests headlessly
pwsh bin/Debug/netX/playwright.ps1 install --with-deps --no-shell
```

### Google Chrome & Microsoft Edge

While Playwright can download and use the recent Chromium build, it can operate against the branded Google Chrome and Microsoft Edge browsers available on the machine (note that Playwright doesn't install them by default). In particular, the current Playwright version will support Stable and Beta channels of these browsers.

Available channels are `chrome`, `msedge`, `chrome-beta`, `msedge-beta`, `chrome-dev`, `msedge-dev`, `chrome-canary`, `msedge-canary`.

:::warning
Certain Enterprise Browser Policies may impact Playwright's ability to launch and control Google Chrome and Microsoft Edge. Running in an environment with browser policies is outside of the Playwright project's scope.
:::

:::warning
Google Chrome and Microsoft Edge have switched to a [new headless mode](https://developer.chrome.com/docs/chromium/headless) implementation that is closer to a regular headed mode. This differs from [chromium headless shell](https://developer.chrome.com/blog/chrome-headless-shell) that is used in Playwright by default when running headless, so expect different behavior in some cases. See [issue #33566](https://github.com/microsoft/playwright/issues/33566) for details.
:::

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    /* Test against branded browsers. */
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' }, // or 'chrome-beta'
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' }, // or "msedge-beta" or 'msedge-dev'
    },
  ],
});
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      // Channel can be "chrome", "msedge", "chrome-beta", "msedge-beta" or "msedge-dev".
      Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setChannel("msedge"));
      Page page = browser.newPage();
      // ...
    }
  }
}
```

```bash python
pytest test_login.py --browser-channel msedge
```

```xml csharp
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <LaunchOptions>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```

```bash csharp
dotnet test -- Playwright.BrowserName=chromium Playwright.LaunchOptions.Channel=msedge
```

######
* langs: python

Alternatively when using the library directly, you can specify the browser [`option: BrowserType.launch.channel`] when launching the browser:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # Channel can be "chrome", "msedge", "chrome-beta", "msedge-beta" or "msedge-dev".
    browser = p.chromium.launch(channel="msedge")
    page = browser.new_page()
    page.goto("https://playwright.dev")
    print(page.title())
    browser.close()
```

#### Installing Google Chrome & Microsoft Edge

If Google Chrome or Microsoft Edge is not available on your machine, you can install
them using the Playwright command line tool:

```bash lang=js
npx playwright install msedge
```

```bash lang=python
playwright install msedge
```

```bash lang=csharp
pwsh bin/Debug/netX/playwright.ps1 install msedge
```

```batch lang=java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install msedge"
```

:::warning
Google Chrome or Microsoft Edge installations will be installed at the
default global location of your operating system overriding your current browser installation.
:::

Run with the `--help` option to see a full a list of browsers that can be installed.

#### When to use Google Chrome & Microsoft Edge and when not to?
