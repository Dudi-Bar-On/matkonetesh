---
name: playwright-docs-29
description: "Playwright (GUI-walk driver) — vendor doc 29/30 (docs)"
type: reference
---

## Create a Repo and Push to GitHub

Once you have your [GitHub Actions workflow](#setting-up-github-actions) setup, then all you need to do is [Create a repo on GitHub](https://docs.github.com/en/get-started/quickstart/create-a-repo) or push your code to an existing repository. Follow the instructions on GitHub and don't forget to [initialize a git repository](https://github.com/git-guides/git-init) using the `git init` command so you can [add](https://github.com/git-guides/git-add), [commit](https://github.com/git-guides/git-commit), and [push](https://github.com/git-guides/git-push) your code.

######
* langs: js, java, python

<img height="745" width="1721" alt="Create a Repo and Push to GitHub" src="https://user-images.githubusercontent.com/13063165/183423254-d2735278-a2ab-4d63-bb99-48d8e5e447bc.png"/>


######
* langs: csharp

<img src="https://github.com/microsoft/playwright/assets/13063165/4f1b4cc3-b850-4d60-a99e-24057eaf91ad" alt="dotnet repo on github" width="2802" height="1570" />

## Opening the Workflows

Click on the **Actions** tab to see the workflows. Here you see if your tests have passed or failed.

######
* langs: js, python, java

<img src="https://user-images.githubusercontent.com/13063165/183423783-58bf2008-514e-4f96-9c12-c9a55703960c.png" alt="opening the workflow" width="1678" height="1207" />

######
* langs: csharp

<img src="https://github.com/microsoft/playwright/assets/13063165/71793c09-0815-4faa-866b-85684a1f87e5" alt="opening the workflow" width="2812" height="824" />

On Pull Requests you can also click on the **Details** link in the [PR status check](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks).

<img height="404" width="1290" alt="pr status checked" src="https://user-images.githubusercontent.com/13063165/183722462-17a985db-0e10-4205-b16c-8aaac36117b9.png" />


## Viewing Test Logs

Clicking on the workflow run shows you all the actions that GitHub performed and clicking on **Run Playwright tests** shows the error messages, what was expected and what was received as well as the call log.

######
* langs: js, python, java

<img src="https://user-images.githubusercontent.com/13063165/183423783-58bf2008-514e-4f96-9c12-c9a55703960c.png" alt="Viewing Test Logs" width="1678" height="1207" />

######
* langs: csharp

<img src="https://github.com/microsoft/playwright/assets/13063165/ba2d8d7b-ffce-42de-95e0-bcb35c421975" alt="viewing the test logs" width="2794" height="1858" />


## HTML Report
* langs: js

The HTML Report shows you a full report of your tests. You can filter the report by browsers, passed tests, failed tests, skipped tests, and flaky tests.

### Downloading the HTML Report
* langs: js

In the Artifacts section, click on the **playwright-report** to download your report in the format of a zip file.

<img height="1245" width="1943" alt="Downloading the HTML Report" src="https://user-images.githubusercontent.com/13063165/183437023-524f1803-84e4-4862-9ce3-1d55af0e023e.png" />

### Viewing the HTML Report
* langs: js

Locally opening the report does not work as expected as you need a web server for everything to work correctly. First, extract the zip, preferably in a folder that already has Playwright installed. Using the command line, change into the directory where the report is and use `npx playwright show-report` followed by the name of the extracted folder. This serves up the report and enables you to view it in your browser.


```bash
npx playwright show-report name-of-my-extracted-playwright-report
```

<img src="https://github.com/microsoft/playwright/assets/13063165/c5f60e56-fb75-4a2d-a4b6-054b8c5d69c1" alt="viewing the HTML report" width="2296" height="1424" />

To learn more about reports, check out our detailed guide on [HTML Reporter](/test-reporters.md#html-reporter)

## Viewing the Trace
* langs: js

Once you have served the report using `npx playwright show-report`, click on the trace icon next to the test's file name as seen in the image above. You can then view the trace of your tests and inspect each action to try to find out why the tests are failing.

<img src="https://github.com/microsoft/playwright/assets/13063165/10fe3585-8401-4051-b1c2-b2e92ac4c274" alt="playwright trace viewer" width="3598" height="2218" />

## Viewing the Trace
* langs: python, java

[trace.playwright.dev](https://trace.playwright.dev) is a statically hosted variant of the Trace Viewer. You can upload trace files using drag and drop.

![playwright trace viewer](./images/getting-started/trace-viewer-failed-test.png)

## Viewing the Trace
* langs: csharp

You can upload Traces which get created on your CI like GitHub Actions as artifacts. This requires [starting and stopping the trace](./trace-viewer-intro#recording-a-trace). We recommend only recording traces for failing tests. Once your traces have been uploaded to CI, they can then be downloaded and opened using [trace.playwright.dev](https://trace.playwright.dev), which is a statically hosted variant of the Trace Viewer. You can upload trace files using drag and drop.

######
* langs: csharp

![playwright trace viewer](./images/getting-started/trace-viewer-failed-test.png)
