---
name: playwright-docs-19
description: "Playwright (GUI-walk driver) — vendor doc 19/30 (docs)"
type: reference
---

#### Don't use manual assertions

Don't use manual assertions that are not awaiting the expect. In the code below the await is inside the expect rather than before it. When using assertions such as `isVisible()` the test won't wait a single second, it will just check the locator is there and return immediately.

```js
// 👎
expect(await page.getByText('welcome').isVisible()).toBe(true);
```

Use web first assertions such as `toBeVisible()` instead.

```js
// 👍
await expect(page.getByText('welcome')).toBeVisible();
```

### Configure debugging

#### Local debugging

For local debugging we recommend you [debug your tests live in VS Code](./getting-started-vscode.md#debugging-your-tests) by installing the [VS Code extension](./getting-started-vscode.md). You can run tests in debug mode by right-clicking on the line next to the test you want to run which will open a browser window and pause at where the breakpoint is set.

<img height="1240" width="2676" alt="debugging tests in vscode" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212274675-5c6e1647-2aab-40fd-9804-8680c1ac2d16.png" />

You can live debug your test by clicking or editing the locators in your test in VS Code which will highlight this locator in the browser window as well as show you any other matching locators found on the page.

<img height="1404" width="2788" alt="live debugging locators in vscode" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212273189-da271dc4-0f59-4138-92a8-10e719066cbe.png" />

You can also debug your tests with the Playwright inspector by running your tests with the `--debug` flag.

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
npx playwright test --debug
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright test --debug
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright test --debug
```

</TabItem>

</Tabs>

You can then step through your test, view actionability logs and edit the locator live and see it highlighted in the browser window. This will show you which locators match, how many of them there are.

<img height="1736" width="2700" alt="debugging with the playwright inspector" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212276296-4f5b18e7-2bd7-4766-9aa5-783517bd4aa2.png" />



To debug a specific test add the name of the test file and the line number of the test followed by the `--debug` flag.

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
npx playwright test example.spec.ts:9 --debug
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright test example.spec.ts:9 --debug
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright test example.spec.ts:9 --debug
```

</TabItem>

</Tabs>
#### Debugging on CI

For CI failures, use the Playwright [trace viewer](./trace-viewer.md) instead of videos and screenshots. The trace viewer gives you a full trace of your tests as a local Progressive Web App (PWA) that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action using dev tools, view network requests and more.

<img height="1920" width="3032" alt="playwrights trace viewer" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212277895-c63d94c2-bd06-4881-864e-62790a072ca3.png" />

Traces are configured in the Playwright config file and are set to run on CI on the first retry of a failed test. We don't recommend setting this to `on` so that traces are run on every test as it's very performance heavy. However you can run a trace locally when developing with the `--trace` flag.

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
npx playwright test --trace on
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright test --trace on
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright test --trace on
```

</TabItem>

</Tabs>

Once you run this command your traces will be recorded for each test and can be viewed directly from the HTML report.

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
npx playwright show-report
```

</TabItem>

<TabItem value="yarn">

```bash
yarn playwright show-report
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm exec playwright show-report
```

</TabItem>

</Tabs>

<img height="1920" width="3032" alt="Playwrights HTML report" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212279022-d929d4c0-2271-486a-a75f-166ac231d25f.png" />

Traces can be opened by clicking on the icon next to the test file name or by opening each of the test reports and scrolling down to the traces section.

<img height="2242" width="3032" alt="Screenshot 2023-01-13 at 09 58 34" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212279699-c9eb134f-4f4e-4f19-805c-37596d3272a6.png" />

### Use Playwright's Tooling

Playwright comes with a range of tooling to help you write tests.
- The [VS Code extension](./getting-started-vscode.md) gives you a great developer experience when writing, running, and debugging tests.
- The [test generator](./codegen.md) can generate tests and pick locators for you.
- The [trace viewer](./trace-viewer.md) gives you a full trace of your tests as a local PWA that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action, view network requests and more.
- The [UI Mode](./test-ui-mode) lets you explore, run and debug tests with a time travel experience complete with watch mode. All test files are loaded into the testing sidebar where you can expand each file and describe block to individually run, view, watch and debug each test.
- [TypeScript](./test-typescript) in Playwright works out of the box and gives you better IDE integrations. Your IDE will show you everything you can do and highlight when you do something wrong. No TypeScript experience is needed and it is not necessary for your code to be in TypeScript, all you need to do is create your tests with a `.ts` extension.

### Test across all browsers

Playwright makes it easy to test your site across all [browsers](./test-projects.md#configure-projects-for-multiple-browsers) no matter what platform you are on. Testing across all browsers ensures your app works for all users. In your config file you can set up projects adding the name and which browser or device to use.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```
