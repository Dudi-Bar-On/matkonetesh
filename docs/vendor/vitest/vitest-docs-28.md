---
name: vitest-docs-28
description: "vitest (test runner) — vendor doc 28/48 (vitest.dev)"
type: reference
---

### `vitest init`

`vitest init <name>` can be used to setup project configuration. At the moment, it only supports [`browser`](/guide/browser/) value:

```bash
vitest init browser
```

### `vitest list`

`vitest list` command inherits all `vitest` options to print the list of all matching tests. This command ignores `reporters` option. By default, it will print the names of all tests that matched the file filter and name pattern:

```shell
vitest list filename.spec.ts -t="some-test"
```

```txt
describe > some-test
describe > some-test > test 1
describe > some-test > test 2
```

You can pass down `--json` flag to print tests in JSON format or save it in a separate file:

```bash
vitest list filename.spec.ts -t="some-test" --json=./file.json
```

If `--json` flag doesn't receive a value, it will output the JSON into stdout.

You also can pass down `--filesOnly` flag to print the test files only:

```bash
vitest list --filesOnly
```

```txt
tests/test1.test.ts
tests/test2.test.ts
```

Since Vitest 4.1, you may pass `--static-parse` to [parse test files](/api/advanced/vitest#parsespecifications) instead of running them to collect tests. Vitest parses test files with limited concurrency, defaulting to `os.availableParallelism()`. You can change it via the `--static-parse-concurrency` option.

## Shell Autocompletions

Vitest provides shell autocompletions for commands, options, and option values powered by [`@bomb.sh/tab`](https://github.com/bombshell-dev/tab).

### Setup

For permanent setup in zsh, add this to your `~/.zshrc`:

```bash
# Add to ~/.zshrc for permanent autocompletions (same can be done for other shells)
source <(vitest complete zsh)
```

### Package Manager Integration

`@bomb.sh/tab` integrates with [package managers](https://github.com/bombshell-dev/tab?tab=readme-ov-file#package-manager-completions). Autocompletions work when running vitest directly:

::: code-group

```bash [npm]
npm vitest <Tab>
```

```bash [npm]
npm exec vitest <Tab>
```

```bash [pnpm]
pnpm vitest <Tab>
```

```bash [yarn]
yarn vitest <Tab>
```

```bash [bun]
bun vitest <Tab>
```

:::

For package manager autocompletions, you should install [tab's package manager completions](https://github.com/bombshell-dev/tab?tab=readme-ov-file#package-manager-completions) separately.

## Options

::: tip
Vitest supports both camel case and kebab case for [CLI arguments](https://github.com/cacjs/cac#dot-nested-options). For example, `--passWithNoTests` and `--pass-with-no-tests` will both work (`--no-color` and `--inspect-brk` are the exceptions).

Vitest also supports different ways of specifying the value: `--reporter dot` and `--reporter=dot` are both valid.

If option supports an array of values, you need to pass the option multiple times:

```
vitest --reporter=dot --reporter=default
```

Boolean options can be negated with `no-` prefix. Specifying the value as `false` also works:

```
vitest --no-api
vitest --api=false
```

:::

### root

* **CLI:** `-r, --root <path>`
* **Config:** [root](/config/root)

Root path

### config

* **CLI:** `-c, --config <path>`

Path to config file

### update

* **CLI:** `-u, --update [type]`
* **Config:** [update](/config/update)

Update snapshot (accepts boolean, "new", "all" or "none")

### watch

* **CLI:** `-w, --watch`
* **Config:** [watch](/config/watch)

Enable watch mode

### testNamePattern

* **CLI:** `-t, --testNamePattern <pattern>`
* **Config:** [testNamePattern](/config/testnamepattern)

Run tests with full names matching the specified regexp pattern

### dir

* **CLI:** `--dir <path>`
* **Config:** [dir](/config/dir)

Base directory to scan for the test files

### ui

* **CLI:** `--ui`

Enable UI

### open

* **CLI:** `--open`
* **Config:** [open](/config/open)

Open UI automatically (default: `!process.env.CI`)

### api.port

* **CLI:** `--api.port [port]`

Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `51204`

### api.host

* **CLI:** `--api.host [host]`

Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses

### api.strictPort

* **CLI:** `--api.strictPort`

Set to true to exit if port is already in use, instead of automatically trying the next available port

### api.allowExec

* **CLI:** `--api.allowExec`
* **Config:** [api.allowExec](/config/api#api-allowexec)

Allow API to execute code. (Be careful when enabling this option in untrusted environments)

### api.allowWrite

* **CLI:** `--api.allowWrite`
* **Config:** [api.allowWrite](/config/api#api-allowwrite)

Allow API to edit files. (Be careful when enabling this option in untrusted environments)

### silent

* **CLI:** `--silent [value]`
* **Config:** [silent](/config/silent)

Silent console output from tests. Use `'passed-only'` to see logs from failing tests only.

### hideSkippedTests

* **CLI:** `--hideSkippedTests`

Hide logs for skipped tests

### reporters

* **CLI:** `--reporter <name>`
* **Config:** [reporters](/config/reporters)

Specify reporters (default, agent, minimal, blob, verbose, dot, json, tap, tap-flat, junit, tree, hanging-process, github-actions)

### outputFile

* **CLI:** `--outputFile <filename/-s>`
* **Config:** [outputFile](/config/outputfile)

Write test results to a file when supporter reporter is also specified, use cac's dot notation for individual outputs of multiple reporters (example: `--outputFile.tap=./tap.txt`)

### coverage.provider

* **CLI:** `--coverage.provider <name>`
* **Config:** [coverage.provider](/config/coverage#coverage-provider)

Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom"

### coverage.enabled

* **CLI:** `--coverage.enabled`
* **Config:** [coverage.enabled](/config/coverage#coverage-enabled)

Enables coverage collection. Can be overridden using the `--coverage` CLI option (default: `false`)

### coverage.include

* **CLI:** `--coverage.include <pattern>`
* **Config:** [coverage.include](/config/coverage#coverage-include)

Files included in coverage as glob patterns. May be specified more than once when using multiple patterns. By default only files covered by tests are included.

### coverage.exclude

* **CLI:** `--coverage.exclude <pattern>`
* **Config:** [coverage.exclude](/config/coverage#coverage-exclude)

Files to be excluded in coverage. May be specified more than once when using multiple extensions.

### coverage.clean

* **CLI:** `--coverage.clean`
* **Config:** [coverage.clean](/config/coverage#coverage-clean)

Clean coverage results before running tests (default: true)

### coverage.cleanOnRerun

* **CLI:** `--coverage.cleanOnRerun`
* **Config:** [coverage.cleanOnRerun](/config/coverage#coverage-cleanonrerun)

Clean coverage report on watch rerun (default: true)

### coverage.reportsDirectory

* **CLI:** `--coverage.reportsDirectory <path>`
* **Config:** [coverage.reportsDirectory](/config/coverage#coverage-reportsdirectory)

Directory to write coverage report to (default: ./coverage)

### coverage.reporter

* **CLI:** `--coverage.reporter <name>`
* **Config:** [coverage.reporter](/config/coverage#coverage-reporter)

Coverage reporters to use. Visit [`coverage.reporter`](/config/coverage#coverage-reporter) for more information (default: `["text", "html", "clover", "json"]`)
