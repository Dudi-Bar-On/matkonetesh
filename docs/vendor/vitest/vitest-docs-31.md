---
name: vitest-docs-31
description: "vitest (test runner) — vendor doc 31/48 (vitest.dev)"
type: reference
---

### diff.bAnnotation

* **CLI:** `--diff.bAnnotation <annotation>`
* **Config:** [diff.bAnnotation](/config/diff#diff-bannotation)

Annotation for received lines (default: `Received`)

### diff.bIndicator

* **CLI:** `--diff.bIndicator <indicator>`
* **Config:** [diff.bIndicator](/config/diff#diff-bindicator)

Indicator for received lines (default: `+`)

### diff.commonIndicator

* **CLI:** `--diff.commonIndicator <indicator>`
* **Config:** [diff.commonIndicator](/config/diff#diff-commonindicator)

Indicator for common lines (default: ` `)

### diff.contextLines

* **CLI:** `--diff.contextLines <lines>`
* **Config:** [diff.contextLines](/config/diff#diff-contextlines)

Number of lines of context to show around each change (default: `5`)

### diff.emptyFirstOrLastLinePlaceholder

* **CLI:** `--diff.emptyFirstOrLastLinePlaceholder <placeholder>`
* **Config:** [diff.emptyFirstOrLastLinePlaceholder](/config/diff#diff-emptyfirstorlastlineplaceholder)

Placeholder for an empty first or last line (default: `""`)

### diff.expand

* **CLI:** `--diff.expand`
* **Config:** [diff.expand](/config/diff#diff-expand)

Expand all common lines (default: `true`)

### diff.includeChangeCounts

* **CLI:** `--diff.includeChangeCounts`
* **Config:** [diff.includeChangeCounts](/config/diff#diff-includechangecounts)

Include comparison counts in diff output (default: `false`)

### diff.omitAnnotationLines

* **CLI:** `--diff.omitAnnotationLines`
* **Config:** [diff.omitAnnotationLines](/config/diff#diff-omitannotationlines)

Omit annotation lines from the output (default: `false`)

### diff.printBasicPrototype

* **CLI:** `--diff.printBasicPrototype`
* **Config:** [diff.printBasicPrototype](/config/diff#diff-printbasicprototype)

Print basic prototype Object and Array (default: `true`)

### diff.maxDepth

* **CLI:** `--diff.maxDepth <maxDepth>`
* **Config:** [diff.maxDepth](/config/diff#diff-maxdepth)

Limit the depth to recurse when printing nested objects (default: `20`)

### diff.truncateThreshold

* **CLI:** `--diff.truncateThreshold <threshold>`
* **Config:** [diff.truncateThreshold](/config/diff#diff-truncatethreshold)

Number of lines to show before and after each change (default: `0`)

### diff.truncateAnnotation

* **CLI:** `--diff.truncateAnnotation <annotation>`
* **Config:** [diff.truncateAnnotation](/config/diff#diff-truncateannotation)

Annotation for truncated lines (default: `... Diff result is truncated`)

### exclude

* **CLI:** `--exclude <glob>`
* **Config:** [exclude](/config/exclude)

Additional file globs to be excluded from test

### expandSnapshotDiff

* **CLI:** `--expandSnapshotDiff`
* **Config:** [expandSnapshotDiff](/config/expandsnapshotdiff)

Show full diff when snapshot fails

### disableConsoleIntercept

* **CLI:** `--disableConsoleIntercept`
* **Config:** [disableConsoleIntercept](/config/disableconsoleintercept)

Disable automatic interception of console logging (default: `false`)

### typecheck.enabled

* **CLI:** `--typecheck.enabled`
* **Config:** [typecheck.enabled](/config/typecheck#typecheck-enabled)

Enable typechecking alongside tests (default: `false`)

### typecheck.only

* **CLI:** `--typecheck.only`
* **Config:** [typecheck.only](/config/typecheck#typecheck-only)

Run only typecheck tests. This automatically enables typecheck (default: `false`)

### typecheck.checker

* **CLI:** `--typecheck.checker <name>`
* **Config:** [typecheck.checker](/config/typecheck#typecheck-checker)

Specify the typechecker to use. Available values are: "tsc" and "vue-tsc" and a path to an executable (default: `"tsc"`)

### typecheck.allowJs

* **CLI:** `--typecheck.allowJs`
* **Config:** [typecheck.allowJs](/config/typecheck#typecheck-allowjs)

Allow JavaScript files to be typechecked. By default takes the value from tsconfig.json

### typecheck.ignoreSourceErrors

* **CLI:** `--typecheck.ignoreSourceErrors`
* **Config:** [typecheck.ignoreSourceErrors](/config/typecheck#typecheck-ignoresourceerrors)

Ignore type errors from source files

### typecheck.tsconfig

* **CLI:** `--typecheck.tsconfig <path>`
* **Config:** [typecheck.tsconfig](/config/typecheck#typecheck-tsconfig)

Path to a custom tsconfig file

### typecheck.spawnTimeout

* **CLI:** `--typecheck.spawnTimeout <time>`
* **Config:** [typecheck.spawnTimeout](/config/typecheck#typecheck-spawntimeout)

Minimum time in milliseconds it takes to spawn the typechecker

### project

* **CLI:** `--project <name>`

The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2`. You can also filter projects using wildcards like `--project=packages*`, and exclude projects with `--project=!pattern`.

### slowTestThreshold

* **CLI:** `--slowTestThreshold <threshold>`
* **Config:** [slowTestThreshold](/config/slowtestthreshold)

Threshold in milliseconds for a test or suite to be considered slow (default: `300`)

### teardownTimeout

* **CLI:** `--teardownTimeout <timeout>`
* **Config:** [teardownTimeout](/config/teardowntimeout)

Default timeout of a teardown function in milliseconds (default: `10000`)

### maxConcurrency

* **CLI:** `--maxConcurrency <number>`
* **Config:** [maxConcurrency](/config/maxconcurrency)

Maximum number of concurrent tests and suites during test file execution (default: `5`)

### expect.requireAssertions

* **CLI:** `--expect.requireAssertions`
* **Config:** [expect.requireAssertions](/config/expect#expect-requireassertions)

Require that all tests have at least one assertion

### expect.poll.interval

* **CLI:** `--expect.poll.interval <interval>`
* **Config:** [expect.poll.interval](/config/expect#expect-poll-interval)

Poll interval in milliseconds for `expect.poll()` assertions (default: `50`)

### expect.poll.timeout

* **CLI:** `--expect.poll.timeout <timeout>`
* **Config:** [expect.poll.timeout](/config/expect#expect-poll-timeout)

Poll timeout in milliseconds for `expect.poll()` assertions (default: `1000`)

### printConsoleTrace

* **CLI:** `--printConsoleTrace`
* **Config:** [printConsoleTrace](/config/printconsoletrace)

Always print console stack traces

### includeTaskLocation

* **CLI:** `--includeTaskLocation`
* **Config:** [includeTaskLocation](/config/includetasklocation)

Collect test and suite locations in the `location` property

### attachmentsDir

* **CLI:** `--attachmentsDir <dir>`
* **Config:** [attachmentsDir](/config/attachmentsdir)

The directory where attachments from `context.annotate` are stored in (default: `.vitest-attachments`)

### run

* **CLI:** `--run`

Disable watch mode

### color

* **CLI:** `--no-color`

Removes colors from the console output

### clearScreen

* **CLI:** `--clearScreen`

Clear terminal screen when re-running tests during watch mode (default: `true`)

### configLoader

* **CLI:** `--configLoader <loader>`

Use `bundle` to bundle the config with esbuild or `runner` (experimental) to process it on the fly. This is only available in vite version 6.1.0 and above. (default: `bundle`)

### standalone

* **CLI:** `--standalone`

Start Vitest without running tests. Tests will be running only on change. If browser mode is enabled, the UI will be opened automatically. This option is ignored when CLI file filters are passed. (default: `false`)

### listTags

* **CLI:** `--listTags [type]`

List all available tags instead of running tests. `--list-tags=json` will output tags in JSON format, unless there are no tags.
