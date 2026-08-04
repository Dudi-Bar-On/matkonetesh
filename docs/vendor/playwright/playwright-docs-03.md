---
name: playwright-docs-03
description: "Playwright (GUI-walk driver) — vendor doc 03/30 (docs)"
type: reference
---

### Session management

```bash
playwright-cli list                     # list all sessions
playwright-cli close-all                # close all browsers
playwright-cli kill-all                 # forcefully kill all browser processes
playwright-cli -s=name delete-data      # delete user data for a named session
```

## Monitoring

Use `playwright-cli show` to open a visual dashboard for observing and controlling all running browser sessions:

```bash
playwright-cli show
```

The dashboard provides:

- **Session grid** — all active sessions grouped by workspace, each with a live screencast preview, session name, current URL, and page title. Click any session to zoom in.
- **Session detail** — a live view of the selected session with tab bar, navigation controls, and full remote control. Click into the viewport to take over mouse and keyboard; press Escape to release.

## Configuration

### Headed mode

The CLI runs headless by default. To see the browser:

```bash
playwright-cli open https://playwright.dev --headed
```

### Browser selection

```bash
playwright-cli open --browser=chrome    # use specific browser
playwright-cli open --browser=firefox
playwright-cli open --browser=webkit
playwright-cli open --browser=msedge
```

### Configuration file

For advanced settings, use a JSON config file:

```bash
playwright-cli --config path/to/config.json open example.com
```

The CLI also loads `.playwright/cli.config.json` automatically if present. The config file supports browser options, context options, network rules, timeouts, and more. Run `playwright-cli --help` for the full list of options.

### Browser extension

Connect to your existing browser tabs instead of launching a new browser:

```bash
playwright-cli attach --extension
```

This requires the [Playwright Extension](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md) to be installed.

## Quick Reference

| Action                    | Command                                             |
| ------------------------- | --------------------------------------------------- |
| **Install CLI**           | `npm install -g @playwright/cli@latest`             |
| **Install skills**        | `playwright-cli install --skills`                   |
| **Open a page**           | `playwright-cli open https://example.com`           |
| **Click an element**      | `playwright-cli click e15`                          |
| **Type text**             | `playwright-cli type "hello world"`                 |
| **Take a screenshot**     | `playwright-cli screenshot`                         |
| **Get page snapshot**     | `playwright-cli snapshot`                           |
| **Run headed**            | `playwright-cli open https://example.com --headed`  |
| **Use Firefox**           | `playwright-cli open --browser=firefox`             |
| **Monitor sessions**      | `playwright-cli show`                               |

## What's Next

- [Write tests using web-first assertions, page fixtures, and locators](./writing-tests.md)
- [Run your tests on CI](./ci-intro.md)
- [Learn more about the Trace Viewer](./trace-viewer.md)


<!-- source: docs/src/getting-started-mcp.md -->

---
id: getting-started-mcp
title: "Playwright MCP"
---

## Introduction

The Playwright MCP server provides browser automation capabilities through the [Model Context Protocol](https://modelcontextprotocol.io), enabling LLMs to interact with web pages using structured accessibility snapshots. It works with VS Code, Cursor, Windsurf, Claude Desktop, and any other MCP client — no vision models required.

## Prerequisites

Before you begin, make sure you have the following installed:
- [Node.js](https://nodejs.org/) 20 or newer
- An MCP client: VS Code, Cursor, Windsurf, Claude Code, Claude Desktop, or similar

## Getting Started

### Installation

Add the Playwright MCP server to your client using the standard configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

#### VS Code

Click one of the buttons below to install directly:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code" />](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5" />](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

Or install via the VS Code CLI:

```bash
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

#### Cursor

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" />](https://cursor.com/en/install-mcp?name=Playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

Or go to `Cursor Settings` → `MCP` → `Add new MCP Server` and use command type with `npx @playwright/mcp@latest`.

#### Claude Code

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

#### Claude Desktop

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user) and use the standard config above.

#### Other clients

The standard configuration works with most MCP clients, including Windsurf, Cline, Goose, Kiro, Codex, Copilot CLI, and others. Consult your client's MCP documentation for where to place the config.

### First interaction

Once the server is connected, ask your AI assistant to interact with a web page:

```txt
Navigate to https://demo.playwright.dev/todomvc and add a few todo items.
```

The assistant will use Playwright MCP tools to open the browser, navigate to the page, and interact with elements — all through structured accessibility snapshots rather than screenshots.

## Core Features

### Accessibility snapshots

Playwright MCP operates on the page's accessibility tree, not pixels. When a tool runs, it returns a structured snapshot showing the page elements, their roles, and text content. The LLM uses element references from these snapshots to interact with the page:

```txt
- heading "todos" [level=1]
- textbox "What needs to be done?" [ref=e5]
- listitem:
  - checkbox "Toggle Todo" [ref=e10]
  - text: "Buy groceries"
```

The LLM reads this snapshot and uses `ref=e5` to type into the textbox or `ref=e10` to check the checkbox.

### Interacting with pages

Playwright MCP provides tools for all common browser interactions:

-   **Navigation**: Open URLs, go back/forward, reload pages.
-   **Clicking and typing**: Click elements, type text, fill forms, select dropdowns.
-   **Screenshots**: Capture the current page or specific elements for visual verification.
-   **Keyboard and mouse**: Press keys, hover, drag and drop.
-   **Dialogs**: Accept or dismiss browser dialogs.
-   **Tabs**: Create, close, and switch between browser tabs.
