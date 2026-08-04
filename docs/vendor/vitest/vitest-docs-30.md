---
name: vitest-docs-30
description: "vitest (test runner) — vendor doc 30/48 (vitest.dev)"
type: reference
---

### browser.api.allowWrite

* **CLI:** `--browser.api.allowWrite`
* **Config:** [browser.api.allowWrite](/config/browser/api#api-allowwrite)

Allow API to edit files. (Be careful when enabling this option in untrusted environments)

### browser.isolate

* **CLI:** `--browser.isolate`
* **Config:** [browser.isolate](/config/browser/isolate)

Run every browser test file in isolation. To disable isolation, use `--browser.isolate=false` (default: `true`)

### browser.ui

* **CLI:** `--browser.ui`
* **Config:** [browser.ui](/config/browser/ui)

Show Vitest UI when running tests (default: `!process.env.CI`)

### browser.detailsPanelPosition

* **CLI:** `--browser.detailsPanelPosition <position>`
* **Config:** [browser.detailsPanelPosition](/config/browser/detailspanelposition)

Default position for the details panel in browser mode. Either `right` (horizontal split) or `bottom` (vertical split) (default: `right`)

### browser.fileParallelism

* **CLI:** `--browser.fileParallelism`

Should browser test files run in parallel. Use `--browser.fileParallelism=false` to disable (default: `true`)

### browser.connectTimeout

* **CLI:** `--browser.connectTimeout <timeout>`
* **Config:** [browser.connectTimeout](/config/browser/connecttimeout)

If connection to the browser takes longer, the test suite will fail (default: `60_000`)

### browser.trackUnhandledErrors

* **CLI:** `--browser.trackUnhandledErrors`
* **Config:** [browser.trackUnhandledErrors](/config/browser/trackunhandlederrors)

Control if Vitest catches uncaught exceptions so they can be reported (default: `true`)

### browser.trace

* **CLI:** `--browser.trace <mode>`
* **Config:** [browser.trace](/config/browser/trace)

Enable trace view mode. Supported: "on", "off", "on-first-retry", "on-all-retries", "retain-on-failure".

### browser.locators.exact

* **CLI:** `--browser.locators.exact`
* **Config:** [browser.locators.exact](/config/browser/locators#locators-exact)

Should locators match the text exactly by default (default: `false`)

### pool

* **CLI:** `--pool <pool>`
* **Config:** [pool](/config/pool)

Specify pool, if not running in the browser (default: `forks`)

### execArgv

* **CLI:** `--execArgv <option>`
* **Config:** [execArgv](/config/execargv)

Pass additional arguments to `node` process when spawning `worker_threads` or `child_process`.

### vmMemoryLimit

* **CLI:** `--vmMemoryLimit <limit>`
* **Config:** [vmMemoryLimit](/config/vmmemorylimit)

Memory limit for VM pools. If you see memory leaks, try to tinker this value.

### fileParallelism

* **CLI:** `--fileParallelism`
* **Config:** [fileParallelism](/config/fileparallelism)

Should all test files run in parallel. Use `--no-file-parallelism` to disable (default: `true`)

### maxWorkers

* **CLI:** `--maxWorkers <workers>`
* **Config:** [maxWorkers](/config/maxworkers)

Maximum number or percentage of workers to run tests in

### environment

* **CLI:** `--environment <name>`
* **Config:** [environment](/config/environment)

Specify runner environment, if not running in the browser (default: `node`)

### passWithNoTests

* **CLI:** `--passWithNoTests`
* **Config:** [passWithNoTests](/config/passwithnotests)

Pass when no tests are found

### logHeapUsage

* **CLI:** `--logHeapUsage`
* **Config:** [logHeapUsage](/config/logheapusage)

Show the size of heap for each test when running in node

### detectAsyncLeaks

* **CLI:** `--detectAsyncLeaks`
* **Config:** [detectAsyncLeaks](/config/detectasyncleaks)

Detect asynchronous resources leaking from the test file (default: `false`)

### allowOnly

* **CLI:** `--allowOnly`
* **Config:** [allowOnly](/config/allowonly)

Allow tests and suites that are marked as only (default: `!process.env.CI`)

### dangerouslyIgnoreUnhandledErrors

* **CLI:** `--dangerouslyIgnoreUnhandledErrors`
* **Config:** [dangerouslyIgnoreUnhandledErrors](/config/dangerouslyignoreunhandlederrors)

Ignore any unhandled errors that occur

### sequence.shuffle.files

* **CLI:** `--sequence.shuffle.files`
* **Config:** [sequence.shuffle.files](/config/sequence#sequence-shuffle-files)

Run files in a random order. Long running tests will not start earlier if you enable this option. (default: `false`)

### sequence.shuffle.tests

* **CLI:** `--sequence.shuffle.tests`
* **Config:** [sequence.shuffle.tests](/config/sequence#sequence-shuffle-tests)

Run tests in a random order (default: `false`)

### sequence.concurrent

* **CLI:** `--sequence.concurrent`
* **Config:** [sequence.concurrent](/config/sequence#sequence-concurrent)

Make tests run in parallel (default: `false`)

### sequence.seed

* **CLI:** `--sequence.seed <seed>`
* **Config:** [sequence.seed](/config/sequence#sequence-seed)

Set the randomization seed. This option will have no effect if `--sequence.shuffle` is falsy. Visit ["Random Seed" page](https://en.wikipedia.org/wiki/Random_seed) for more information

### sequence.hooks

* **CLI:** `--sequence.hooks <order>`
* **Config:** [sequence.hooks](/config/sequence#sequence-hooks)

Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit [`sequence.hooks`](/config/sequence#sequence-hooks) for more information (default: `"parallel"`)

### sequence.setupFiles

* **CLI:** `--sequence.setupFiles <order>`
* **Config:** [sequence.setupFiles](/config/sequence#sequence-setupfiles)

Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: `"parallel"`)

### inspect

* **CLI:** `--inspect [[host:]port]`

Enable Node.js inspector (default: `127.0.0.1:9229`)

### inspectBrk

* **CLI:** `--inspectBrk [[host:]port]`

Enable Node.js inspector and break before the test starts

### testTimeout

* **CLI:** `--testTimeout <timeout>`
* **Config:** [testTimeout](/config/testtimeout)

Default timeout of a test in milliseconds (default: `5000`). Use `0` to disable timeout completely.

### hookTimeout

* **CLI:** `--hookTimeout <timeout>`
* **Config:** [hookTimeout](/config/hooktimeout)

Default hook timeout in milliseconds (default: `10000`). Use `0` to disable timeout completely.

### bail

* **CLI:** `--bail <number>`
* **Config:** [bail](/config/bail)

Stop test execution when given number of tests have failed (default: `0`)

### retry.count

* **CLI:** `--retry.count <times>`
* **Config:** [retry.count](/config/retry#retry-count)

Number of times to retry a test if it fails (default: `0`)

### retry.delay

* **CLI:** `--retry.delay <ms>`
* **Config:** [retry.delay](/config/retry#retry-delay)

Delay in milliseconds between retry attempts (default: `0`)

### retry.condition

* **CLI:** `--retry.condition <pattern>`
* **Config:** [retry.condition](/config/retry#retry-condition)

Regex pattern to match error messages that should trigger a retry. Only errors matching this pattern will cause a retry (default: retry on all errors)

### diff.aAnnotation

* **CLI:** `--diff.aAnnotation <annotation>`
* **Config:** [diff.aAnnotation](/config/diff#diff-aannotation)

Annotation for expected lines (default: `Expected`)

### diff.aIndicator

* **CLI:** `--diff.aIndicator <indicator>`
* **Config:** [diff.aIndicator](/config/diff#diff-aindicator)

Indicator for expected lines (default: `-`)
