---
name: playwright-docs-02
description: "Playwright (GUI-walk driver) — vendor doc 02/30 (docs)"
type: reference
---

### `playwright-cli` vs Playwright MCP

- **`playwright-cli`** is best for **coding agents** (Claude Code, GitHub Copilot, etc.) that favor token-efficient, skill-based workflows. CLI commands avoid loading large tool schemas and verbose accessibility trees into the model context.
- **MCP** is best for specialized agentic loops that benefit from persistent state and iterative reasoning over page structure, such as exploratory automation or long-running autonomous workflows. See the [MCP getting started guide](./getting-started-mcp.md).

## Prerequisites

Before you begin, make sure you have the following installed:
- [Node.js](https://nodejs.org/) 20 or newer
- A coding agent: Claude Code, GitHub Copilot, or similar

## Installation

Install `playwright-cli` globally:

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
```

Alternatively, install `@playwright/cli` as a local dependency and use `npx`:

```bash
npm install -D @playwright/cli@latest
npx playwright-cli --help
```

### Installing skills

Coding agents like Claude Code and GitHub Copilot can use locally installed skills for richer context about available commands:

```bash
playwright-cli install --skills
```

### Skills-less operation

You can also point your agent at the CLI directly and let it discover commands on its own:

```txt
Test the "add todo" flow on https://demo.playwright.dev/todomvc using playwright-cli.
Check playwright-cli --help for available commands.
```

## First Steps

### Interactive demo

Try asking your coding agent:

```txt
Use playwright skills to test https://demo.playwright.dev/todomvc/.
Take screenshots for all successful and failing scenarios.
```

### Manual walkthrough

You can also run commands manually to see how the CLI works:

```bash
playwright-cli open https://demo.playwright.dev/todomvc/ --headed
playwright-cli type "Buy groceries"
playwright-cli press Enter
playwright-cli type "Water flowers"
playwright-cli press Enter
playwright-cli check e21
playwright-cli screenshot
```

After each command, the CLI outputs a snapshot of the current page state:

```txt
### Page
- Page URL: https://demo.playwright.dev/todomvc/#/
- Page Title: React • TodoMVC
### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

## Core Commands

### Interacting with pages

```bash
playwright-cli open [url]               # open browser, optionally navigate to url
playwright-cli goto <url>               # navigate to a url
playwright-cli click <ref> [button]     # click an element
playwright-cli type <text>              # type text into editable element
playwright-cli fill <ref> <text>        # fill text into editable element
playwright-cli select <ref> <value>     # select an option in a dropdown
playwright-cli check <ref>              # check a checkbox or radio button
playwright-cli uncheck <ref>            # uncheck a checkbox
playwright-cli hover <ref>              # hover over element
playwright-cli drag <startRef> <endRef> # drag and drop between elements
playwright-cli upload <files...>        # upload one or multiple files
playwright-cli close                    # close the page
```

### Targeting elements

Use element refs from snapshots to target elements:

```bash
playwright-cli snapshot                 # get snapshot with element refs
playwright-cli click e15                # click using a ref
```

You can also use CSS or role selectors:

```bash
playwright-cli click "#main > button.submit"
playwright-cli click "role=button[name=Submit]"
playwright-cli click "#footer >> role=button[name=Submit]"
```

### Screenshots and snapshots

```bash
playwright-cli snapshot                 # capture page snapshot
playwright-cli snapshot --filename=f    # save snapshot to specific file
playwright-cli screenshot               # screenshot of the current page
playwright-cli screenshot [ref]         # screenshot of a specific element
playwright-cli screenshot --filename=f  # save with specific filename
playwright-cli screenshot --hires       # capture using device pixels
playwright-cli pdf                      # save page as PDF
```

### Navigation

```bash
playwright-cli go-back                  # go back
playwright-cli go-forward               # go forward
playwright-cli reload                   # reload the page
```

### Keyboard and mouse

```bash
playwright-cli press <key>              # press a key (e.g. Enter, ArrowLeft)
playwright-cli keydown <key>            # key down
playwright-cli keyup <key>              # key up
playwright-cli mousemove <x> <y>        # move mouse
playwright-cli mousedown [button]       # mouse button down
playwright-cli mouseup [button]         # mouse button up
playwright-cli mousewheel <dx> <dy>     # scroll
```

### Tabs

```bash
playwright-cli tab-list                 # list all tabs
playwright-cli tab-new [url]            # create a new tab
playwright-cli tab-select <index>       # select a tab
playwright-cli tab-close [index]        # close a tab
```

### Network

```bash
playwright-cli requests                 # list network requests since page load
playwright-cli request <num>            # show full details of a single request
playwright-cli route <pattern> [opts]   # mock network requests
playwright-cli route-list               # list active routes
playwright-cli unroute [pattern]        # remove routes
```

### Storage

```bash
playwright-cli state-save [filename]    # save storage state (cookies, localStorage)
playwright-cli state-load <filename>    # load storage state

# Cookies
playwright-cli cookie-list [--domain]   # list cookies
playwright-cli cookie-get <name>        # get a cookie
playwright-cli cookie-set <name> <val>  # set a cookie
playwright-cli cookie-delete <name>     # delete a cookie
playwright-cli cookie-clear             # clear all cookies

# localStorage
playwright-cli localstorage-list        # list entries
playwright-cli localstorage-get <key>   # get value
playwright-cli localstorage-set <k> <v> # set value
playwright-cli localstorage-delete <k>  # delete entry
playwright-cli localstorage-clear       # clear all
```

### DevTools

```bash
playwright-cli console [min-level]      # list console messages
playwright-cli eval <func> [ref]        # evaluate JavaScript on page
playwright-cli run-code <code>          # run Playwright code snippet
playwright-cli tracing-start            # start trace recording
playwright-cli tracing-stop             # stop trace recording
playwright-cli video-start              # start video recording
playwright-cli video-chapter <title>    # add chapter marker to video
playwright-cli video-stop --filename=f  # stop video recording
```

## Sessions

The CLI keeps the browser profile in memory by default — cookies and storage state are preserved between calls within a session but lost when the browser closes. Use `--persistent` to save the profile to disk.

### Named sessions

Run multiple browser instances for different projects:

```bash
playwright-cli open https://playwright.dev
playwright-cli -s=example open https://example.com --persistent
playwright-cli list                     # list all sessions
```

You can configure your coding agent to use a specific session:

```bash
PLAYWRIGHT_CLI_SESSION=todo-app claude .
```
