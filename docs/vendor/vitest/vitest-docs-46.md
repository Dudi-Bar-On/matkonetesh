---
name: vitest-docs-46
description: "vitest (test runner) — vendor doc 46/48 (vitest.dev)"
type: reference
---

## Custom Coverage Reporter

You can use custom coverage reporters by passing either the name of the package or absolute path in `test.coverage.reporter`:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: [
        // Specify reporter using name of the NPM package
        ['@vitest/custom-coverage-reporter', { someOption: true }],

        // Specify reporter using local path
        '/absolute/path/to/custom-reporter.cjs',
      ],
    },
  },
})
```

Custom reporters are loaded by Istanbul and must match its reporter interface. See [built-in reporters' implementation](https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-reports/lib) for reference.

```js [custom-reporter.cjs]
const { ReportBase } = require('istanbul-lib-report')

module.exports = class CustomReporter extends ReportBase {
  constructor(opts) {
    super()

    // Options passed from configuration are available here
    this.file = opts.file
  }

  onStart(root, context) {
    this.contentWriter = context.writer.writeFile(this.file)
    this.contentWriter.println('Start of custom coverage report')
  }

  onEnd() {
    this.contentWriter.println('End of custom coverage report')
    this.contentWriter.close()
  }
}
```

## Custom Coverage Provider

It's also possible to provide your custom coverage provider by passing `'custom'` in `test.coverage.provider`:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'custom',
      customProviderModule: 'my-custom-coverage-provider'
    },
  },
})
```

The custom providers require a `customProviderModule` option which is a module name or path where to load the `CoverageProviderModule` from. It must export an object that implements `CoverageProviderModule` as default export:

```ts [my-custom-coverage-provider.ts]
import type {
  CoverageProvider,
  CoverageProviderModule,
  ResolvedCoverageOptions,
  Vitest
} from 'vitest'

const CustomCoverageProviderModule: CoverageProviderModule = {
  getProvider(): CoverageProvider {
    return new CustomCoverageProvider()
  },

  // Implements rest of the CoverageProviderModule ...
}

class CustomCoverageProvider implements CoverageProvider {
  name = 'custom-coverage-provider'
  options!: ResolvedCoverageOptions

  initialize(ctx: Vitest) {
    this.options = ctx.config.coverage
  }

  // Implements rest of the CoverageProvider ...
}

export default CustomCoverageProviderModule
```

Please refer to the type definition for more details.

## Ignoring Code

Both coverage providers have their own ways how to ignore code from coverage reports:

* [`v8`](https://github.com/AriPerkkio/ast-v8-to-istanbul?tab=readme-ov-file#ignoring-code)
* [`istanbul`](https://github.com/istanbuljs/nyc#parsing-hints-ignoring-lines)

When using TypeScript the source codes are transpiled using `esbuild`, which strips all comments from the source codes ([esbuild#516](https://github.com/evanw/esbuild/issues/516)).
Comments which are considered as [legal comments](https://esbuild.github.io/api/#legal-comments) are preserved.

You can include a `@preserve` keyword in the ignore hint.
Beware that these ignore hints may now be included in final production build as well.

::: tip
Follow https://github.com/vitest-dev/vitest/issues/2021 for updates about `@preserve` usage.
:::

```diff
-/* istanbul ignore if */
+/* istanbul ignore if -- @preserve */
if (condition) {

-/* v8 ignore if */
+/* v8 ignore if -- @preserve */
if (condition) {
```

### Examples

::: code-group

```ts [lines: start/stop]
/* istanbul ignore start -- @preserve */
if (parameter) { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
else { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
/* istanbul ignore stop -- @preserve */

console.log('Included')

/* v8 ignore start -- @preserve */
if (parameter) { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
else { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
/* v8 ignore stop -- @preserve */

console.log('Included')
```

```ts [if else]
/* v8 ignore if -- @preserve */
if (parameter) { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
else {
  console.log('Included')
}

/* v8 ignore else -- @preserve */
if (parameter) {
  console.log('Included')
}
else { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
```

```ts [next node]
/* v8 ignore next -- @preserve */
console.log('Ignored') // [!code error]
console.log('Included')

/* v8 ignore next -- @preserve */
function ignored() { // [!code error]
  console.log('all') // [!code error]
  // [!code error]
  console.log('lines') // [!code error]
  // [!code error]
  console.log('are') // [!code error]
  // [!code error]
  console.log('ignored') // [!code error]
} // [!code error]

/* v8 ignore next -- @preserve */
class Ignored { // [!code error]
  ignored() {} // [!code error]
  alsoIgnored() {} // [!code error]
} // [!code error]

/* v8 ignore next -- @preserve */
condition // [!code error]
  ? console.log('ignored') // [!code error]
  : console.log('also ignored') // [!code error]
```

```ts [try catch]
/* v8 ignore next -- @preserve */
try { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
catch (error) { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]

try {
  console.log('Included')
}
catch (error) {
  /* v8 ignore next -- @preserve */
  console.log('Ignored') // [!code error]
  /* v8 ignore next -- @preserve */
  console.log('Ignored') // [!code error]
}

// Requires rolldown-vite due to esbuild's lack of support.
// See https://vite.dev/guide/rolldown.html#how-to-try-rolldown
try {
  console.log('Included')
}
catch (error) /* v8 ignore next */ { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
```

```ts [switch case]
switch (type) {
  case 1:
    return 'Included'

  /* v8 ignore next -- @preserve */
  case 2: // [!code error]
    return 'Ignored' // [!code error]

  case 3:
    return 'Included'

  /* v8 ignore next -- @preserve */
  default: // [!code error]
    return 'Ignored' // [!code error]
}
```

```ts [whole file]
/* v8 ignore file -- @preserve */
export function ignored() { // [!code error]
  return 'Whole file is ignored'// [!code error]
}// [!code error]
```

:::

## Coverage Performance

If code coverage generation is slow on your project, see [Profiling Test Performance | Code coverage](/guide/profiling-test-performance.html#code-coverage).

## Vitest UI

You can check your coverage report in [Vitest UI](/guide/ui) and [HTML reporter](/guide/reporters.html#html-reporter).

This is integrated with builtin coverage reporters with HTML output (`html`, `html-spa`, and `lcov` reporters). `html` reporter is enabled by default and this works out of the box. To integrate with custom reporters, you can configure [`coverage.htmlDir`](/config/coverage#coverage-htmldir).
