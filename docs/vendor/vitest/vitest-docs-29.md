---
name: vitest-docs-29
description: "vitest (test runner) — vendor doc 29/48 (vitest.dev)"
type: reference
---

### coverage.reportOnFailure

* **CLI:** `--coverage.reportOnFailure`
* **Config:** [coverage.reportOnFailure](/config/coverage#coverage-reportonfailure)

Generate coverage report even when tests fail (default: `false`)

### coverage.allowExternal

* **CLI:** `--coverage.allowExternal`
* **Config:** [coverage.allowExternal](/config/coverage#coverage-allowexternal)

Collect coverage of files outside the project root (default: `false`)

### coverage.skipFull

* **CLI:** `--coverage.skipFull`
* **Config:** [coverage.skipFull](/config/coverage#coverage-skipfull)

Do not show files with 100% statement, branch, and function coverage (default: `false`)

### coverage.thresholds.100

* **CLI:** `--coverage.thresholds.100`
* **Config:** [coverage.thresholds.100](/config/coverage#coverage-thresholds-100)

Shortcut to set all coverage thresholds to 100 (default: `false`)

### coverage.thresholds.perFile

* **CLI:** `--coverage.thresholds.perFile`
* **Config:** [coverage.thresholds.perFile](/config/coverage#coverage-thresholds-perfile)

Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds (default: `false`)

### coverage.thresholds.autoUpdate

* **CLI:** `--coverage.thresholds.autoUpdate <boolean|function>`
* **Config:** [coverage.thresholds.autoUpdate](/config/coverage#coverage-thresholds-autoupdate)

Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds (default: `false`)

### coverage.thresholds.lines

* **CLI:** `--coverage.thresholds.lines <number>`

Threshold for lines. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.thresholds.functions

* **CLI:** `--coverage.thresholds.functions <number>`

Threshold for functions. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.thresholds.branches

* **CLI:** `--coverage.thresholds.branches <number>`

Threshold for branches. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.thresholds.statements

* **CLI:** `--coverage.thresholds.statements <number>`

Threshold for statements. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.ignoreClassMethods

* **CLI:** `--coverage.ignoreClassMethods <name>`
* **Config:** [coverage.ignoreClassMethods](/config/coverage#coverage-ignoreclassmethods)

Array of class method names to ignore for coverage. Visit [istanbuljs](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`)

### coverage.processingConcurrency

* **CLI:** `--coverage.processingConcurrency <number>`
* **Config:** [coverage.processingConcurrency](/config/coverage#coverage-processingconcurrency)

Concurrency limit used when processing the coverage results. (default min between 20 and the number of CPUs)

### coverage.customProviderModule

* **CLI:** `--coverage.customProviderModule <path>`
* **Config:** [coverage.customProviderModule](/config/coverage#coverage-customprovidermodule)

Specifies the module name or path for the custom coverage provider module. Visit [Custom Coverage Provider](/guide/coverage#custom-coverage-provider) for more information. This option is only available for custom providers

### coverage.watermarks.statements

* **CLI:** `--coverage.watermarks.statements <watermarks>`

High and low watermarks for statements in the format of `<high>,<low>`

### coverage.watermarks.lines

* **CLI:** `--coverage.watermarks.lines <watermarks>`

High and low watermarks for lines in the format of `<high>,<low>`

### coverage.watermarks.branches

* **CLI:** `--coverage.watermarks.branches <watermarks>`

High and low watermarks for branches in the format of `<high>,<low>`

### coverage.watermarks.functions

* **CLI:** `--coverage.watermarks.functions <watermarks>`

High and low watermarks for functions in the format of `<high>,<low>`

### coverage.changed

* **CLI:** `--coverage.changed <commit/branch>`
* **Config:** [coverage.changed](/config/coverage#coverage-changed)

Collect coverage only for files changed since a specified commit or branch (e.g., `origin/main` or `HEAD~1`). Inherits value from `--changed` by default.

### coverage.excludeAfterRemap

* **CLI:** `--coverage.excludeAfterRemap`
* **Config:** [coverage.excludeAfterRemap](/config/coverage#coverage-excludeafterremap)

Apply exclusions again after coverage has been remapped to original sources. (default: false)

### coverage.htmlDir

* **CLI:** `--coverage.htmlDir <path>`
* **Config:** [coverage.htmlDir](/config/coverage#coverage-htmldir)

Directory of HTML coverage output to be served in UI mode and HTML reporter.

### mode

* **CLI:** `--mode <name>`
* **Config:** [mode](/config/mode)

Override Vite mode (default: `test` or `benchmark`)

### isolate

* **CLI:** `--isolate`
* **Config:** [isolate](/config/isolate)

Run every test file in isolation. To disable isolation, use `--no-isolate` (default: `true`)

### globals

* **CLI:** `--globals`
* **Config:** [globals](/config/globals)

Inject apis globally

### dom

* **CLI:** `--dom`

Mock browser API with happy-dom

### browser.enabled

* **CLI:** `--browser.enabled`
* **Config:** [browser.enabled](/config/browser/enabled)

Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`)

### browser.name

* **CLI:** `--browser.name <name>`

Run all tests in a specific browser. Some browsers are only available for specific providers (see `--browser.provider`).

### browser.headless

* **CLI:** `--browser.headless`
* **Config:** [browser.headless](/config/browser/headless)

Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: `process.env.CI`)

### browser.api.port

* **CLI:** `--browser.api.port [port]`
* **Config:** [browser.api.port](/config/browser/api#api-port)

Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `63315`

### browser.api.host

* **CLI:** `--browser.api.host [host]`
* **Config:** [browser.api.host](/config/browser/api#api-host)

Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses

### browser.api.strictPort

* **CLI:** `--browser.api.strictPort`
* **Config:** [browser.api.strictPort](/config/browser/api#api-strictport)

Set to true to exit if port is already in use, instead of automatically trying the next available port

### browser.api.allowExec

* **CLI:** `--browser.api.allowExec`
* **Config:** [browser.api.allowExec](/config/browser/api#api-allowexec)

Allow API to execute code. (Be careful when enabling this option in untrusted environments)
