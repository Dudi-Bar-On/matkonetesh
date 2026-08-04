---
name: playwright-docs-04
description: "Playwright (GUI-walk driver) — vendor doc 04/30 (docs)"
type: reference
---

### Running Playwright code

For complex interactions that go beyond individual tool calls, use the `browser_run_code_unsafe` tool to execute Playwright scripts directly. This tool runs arbitrary JavaScript in the Playwright server process and is RCE-equivalent — only enable it for trusted MCP clients:

```txt
Run this Playwright code to verify the todo count:
async (page) => {
  const count = await page.getByTestId('todo-count').textContent();
  return count;
}
```

### Network monitoring and mocking

Inspect network traffic and mock API responses:

-   **View network requests**: List all requests made since page load.
-   **Mock routes**: Set up URL pattern matching to return custom responses.
-   **Console messages**: Access browser console output for debugging.

### Storage state

Save and restore browser state including cookies and localStorage:

-   **Save state**: Persist authentication and session data to a file.
-   **Restore state**: Load previously saved state into a new session.
-   **Cookie management**: List, get, set, and delete individual cookies.

## Configuration

### Headed mode

By default, Playwright MCP runs the browser in headed mode so you can see what's happening. To run headless:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--headless"
      ]
    }
  }
}
```

### Browser selection

Choose which browser to use:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser=firefox"
      ]
    }
  }
}
```

Supported values: `chrome`, `firefox`, `webkit`, `msedge`.

### User profile

Playwright MCP supports three profile modes:

-   **Persistent (default)**: Login state and cookies are preserved between sessions. The profile is stored in `ms-playwright/mcp-{channel}-{workspace-hash}` in your platform's cache directory, so different projects get separate profiles automatically. Override with `--user-data-dir`.
-   **Isolated**: Each session starts fresh. Pass `--isolated` to enable. You can load initial state with `--storage-state`.
-   **Browser extension**: Connect to your existing browser tabs with the [Playwright Extension](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md). Pass `--extension` to enable.

### Configuration file

For advanced configuration, use a JSON config file:

```bash
npx @playwright/mcp@latest --config path/to/config.json
```

The config file supports browser options, context options, network rules, timeouts, and more. See the [Playwright MCP repository](https://github.com/microsoft/playwright-mcp/blob/main/config.d.ts) for the full schema.

### Standalone server

When running a headed browser on a system without a display or from IDE worker processes, start the MCP server separately with HTTP transport:

```bash
npx @playwright/mcp@latest --port 8931
```

HTTP sessions use a five-second heartbeat timeout. If your MCP client or proxy does not answer server-initiated pings, set `PLAYWRIGHT_MCP_PING_TIMEOUT_MS` to a longer timeout in milliseconds. Set it to `0` to disable the heartbeat.

Then point your MCP client to the HTTP endpoint:

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

## Quick Reference

| Action                    | How to do it                                                  |
| ------------------------- | ------------------------------------------------------------- |
| **Install server**        | Add standard config to your MCP client                        |
| **Navigate to a page**    | Ask: "Go to https://example.com"                              |
| **Click an element**      | Ask: "Click the Submit button"                                |
| **Fill a form**           | Ask: "Fill in the email field with test@example.com"          |
| **Take a screenshot**     | Ask: "Take a screenshot of the page"                          |
| **Run Playwright code**   | Ask: "Run this Playwright code: ..."                          |
| **Mock an API**           | Ask: "Mock the /api/users endpoint to return ..."             |
| **Use headed mode**       | Default. Pass `--headless` to disable                         |
| **Choose a browser**      | Pass `--browser=firefox` in args                              |

## What's Next

-   [Write tests using web-first assertions, page fixtures, and locators](./writing-tests.md)
-   [Run your tests on CI](./ci-intro.md)
-   [Learn more about the Trace Viewer](./trace-viewer.md)


<!-- source: docs/src/getting-started-vscode-js.md -->

---
id: getting-started-vscode
title: "VS Code"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

## Introduction

The Playwright VS Code extension brings the power of Playwright Test directly into your editor, allowing you to run, debug, and generate tests with a seamless UI-driven experience. This guide will walk you through setting up the extension and using its core features to supercharge your end-to-end testing workflow.

<LiteYouTube
    id="WvsLGZnHmzw"
    title="Getting Started with Playwright in VS Code"
/>

## Prerequisites

Before you begin, make sure you have the following installed:
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Visual Studio Code](https://code.visualstudio.com/)

## Getting Started

### Installation & Setup

1.  **Install the Extension**: Open the Extensions view in VS Code (`Ctrl+Shift+X` or `Cmd+Shift+X`) and search for "Playwright". [Install the official extension from Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).


![install playwright extension](./images/getting-started/vscode-extension.png)


1.  **Install Playwright**: Once the extension is installed, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run the **Test: Install Playwright** command.

![install playwright](./images/getting-started/install-playwright.png)

3.  **Select Browsers**: Choose the browsers you want for your tests (e.g., Chromium, Firefox, WebKit). You can also add a GitHub Actions workflow to run tests in CI. These settings can be changed later in your `playwright.config.ts` file.

![install browsers](./images/getting-started/install-browsers.png)

### Opening the Testing Sidebar

Click the **Testing icon** in the VS Code Activity Bar to open the Test Explorer. Here, you'll find your tests, as well as the Playwright sidebar for managing projects, tools, and settings.

![Testing Sidebar](./images/getting-started/testing-sidebar.png)

## Core Features
