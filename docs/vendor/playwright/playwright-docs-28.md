---
name: playwright-docs-28
description: "Playwright (GUI-walk driver) — vendor doc 28/30 (docs)"
type: reference
---

## Introduction

Playwright for Node.js has a canary releases system.

It permits you to **test new unreleased features** instead of waiting for a full release. They get released daily on the `next` NPM tag of Playwright.

It is a good way to **give feedback to maintainers**, ensuring the newly implemented feature works as intended.

:::note

Using a canary release in production might seem risky, but in practice, it's not.

A canary release passes all automated tests and is used to test e.g. the HTML report, Trace Viewer, or Playwright Inspector with end-to-end tests.

:::

## Next npm Dist Tag

For any code-related commit on `main`, the continuous integration will publish a daily canary release under the `@next` npm dist tag.

You can see on [npm](https://www.npmjs.com/package/@playwright/test?activeTab=versions) the current dist tags:

- `latest`: stable releases
- `next`: next releases, published daily
- `beta`: after a release-branch was cut, usually a week before a stable release each commit gets published under this tag

## Using a Canary Release

```bash
npm install -D @playwright/test@next
```

## Documentation

The stable and the `next` documentation is published on [playwright.dev](https://playwright.dev). To see the `next` documentation, press <kbd>Shift</kbd> on the keyboard `5` times.


<!-- source: docs/src/ci-intro.md -->

---
id: ci-intro
title: "Setting up CI"
---

## Introduction
* langs: js

Playwright tests can be run on any CI provider. This guide covers one way of running tests on GitHub using GitHub Actions. If you would like to learn more, or how to configure other CI providers, check out our detailed [doc on Continuous Integration](./ci.md).

#### You will learn
* langs: js

- [How to set up GitHub Actions](/ci-intro.md#setting-up-github-actions)
- [How to view test logs](/ci-intro.md#viewing-test-logs)
- [How to view the HTML report](/ci-intro.md#viewing-the-html-report)
- [How to view the trace](/ci-intro.md#viewing-the-trace)
- [How to publish report on the web](/ci-intro.md#publishing-report-on-the-web)


## Introduction
* langs: python, java, csharp

Playwright tests can be run on any CI provider. In this section we cover running tests on GitHub using GitHub Actions. If you would like to see how to configure other CI providers, check out our detailed [doc on Continuous Integration](./ci.md).

#### You will learn
* langs: python, java, csharp

- [How to set up GitHub Actions](/ci-intro.md#setting-up-github-actions)
- [How to view test logs](/ci-intro.md#viewing-test-logs)
- [How to view the trace](/ci-intro.md#viewing-the-trace)


## Setting up GitHub Actions
* langs: js

When [installing Playwright](./intro.md) using the [VS Code extension](./getting-started-vscode.md) or with `npm init playwright@latest`, you are given the option to add a [GitHub Actions](https://docs.github.com/en/actions) workflow. This creates a `playwright.yml` file inside a `.github/workflows` folder containing everything you need so that your tests run on each push and pull request into the main/master branch. Here's how that file looks:

```yml js title=".github/workflows/playwright.yml"
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: lts/*
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

The workflow performs these steps:

1. Clone your repository
1. Install Node.js
1. Install NPM Dependencies
1. Install Playwright Browsers
1. Run Playwright tests
1. Upload HTML report to the GitHub UI

To learn more about this, see ["Understanding GitHub Actions"](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions).

## Setting up GitHub Actions
* langs: python, java, csharp

To add a [GitHub Actions](https://docs.github.com/en/actions) file, first create `.github/workflows` folder and inside it add a `playwright.yml` file containing the example code below so that your tests run on each push and pull request for the main/master branch.

```yml python title=".github/workflows/playwright.yml"
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - name: Set up Python
      uses: actions/setup-python@v6
      with:
        python-version: '3.13'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    - name: Ensure browsers are installed
      run: python -m playwright install --with-deps
    - name: Run your tests
      run: pytest --tracing=retain-on-failure
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-traces
        path: test-results/
```

```yml java title=".github/workflows/playwright.yml"
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-java@v5
      with:
        distribution: 'temurin'
        java-version: '25'
    - name: Build & Install
      run: mvn -B install -D skipTests --no-transfer-progress
    - name: Ensure browsers are installed
      run: mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps"
    - name: Run tests
      run: mvn test
```

```yml csharp title=".github/workflows/playwright.yml"
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - name: Setup dotnet
      uses: actions/setup-dotnet@v5
      with:
        dotnet-version: 8.0.x
    - name: Build & Install
      run: dotnet build
    - name: Ensure browsers are installed
      run: pwsh bin/Debug/net8.0/playwright.ps1 install --with-deps
    - name: Run your tests
      run: dotnet test
```

To learn more about this, see ["Understanding GitHub Actions"](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions).

Looking at the list of steps in `jobs.test.steps`, you can see that the workflow performs these steps:

1. Clone your repository
1. Install language dependencies
1. Install project dependencies and build
1. Install Playwright Browsers
1. Run tests
