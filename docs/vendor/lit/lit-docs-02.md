---
name: lit-docs-02
description: "Lit (renderer web components) — vendor doc 02/30 (packages)"
type: reference
---

## Next steps

* [Getting started](/docs/v3/getting-started/): Get set up to start developing with Lit.
* [Components](/docs/v3/components/overview/): Learn about the Lit component model.
* [Templates](/docs/v3/templates/overview/): Write templates with lit-html syntax.
* [Code organization](/docs/v3/composition/overview/): Write reusable, maintainable code.


<!-- source: packages/lit-dev-content/site/docs/v3/libraries/index.md -->

---
title: Related libraries
eleventyNavigation:
  key: Related libraries
  order: 12
versionLinks:
  v1: lit-html/introduction/
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/localization/index.md -->

---
title: Localization
eleventyNavigation:
  key: Localization
  order: 9
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/releases/index.md -->

---
title: Releases
eleventyNavigation:
  key: Releases
  order: 11
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/ssr/index.md -->

---
title: Server rendering
eleventyNavigation:
  key: Server rendering
  order: 7
  labs: true
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/templates/index.md -->

---
title: Templates
eleventyNavigation:
  key: Templates
  order: 3
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/tools/index.md -->

---
title: Tools and workflows
eleventyNavigation:
  title: Tools and workflows
  key: Tools
  order: 6
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/introduction.md -->

---
title: Introduction
eleventyNavigation:
  key: Introduction
  order: 1
---

<!-- This file exists only to create a section heading.
     Its output is deleted by the Eleventy build process. -->


<!-- source: packages/lit-dev-content/site/docs/v3/getting-started.md -->

---
title: Getting Started
eleventyNavigation:
  key: Getting Started
  parent: Introduction
  order: 3
versionLinks:
  v1: getting-started/
  v2: getting-started/
---

There are many ways to get started using Lit, from our Playground and interactive tutorial to installing into an existing project.

## Lit Playground

Get started right away with the interactive playground and examples. Start with "[Hello World](/playground)", then customize it or move on to more examples.

## Interactive tutorial

Take our [step-by-step tutorial](/tutorials/intro-to-lit) to learn how to build a Lit component in minutes.

## Lit starter kits

We provide TypeScript and JavaScript component starter kits for creating standalone reusable components. See [Starter Kits](/docs/v3/tools/starter-kits/).

## Install locally from npm

Lit is available as the `lit` package via npm.

```sh
npm i lit
```

Then import into JavaScript or TypeScript files:

{% switchable-sample %}

```ts
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
```

```js
import {LitElement, html} from 'lit';
```

{% endswitchable-sample %}

## Use bundles

Lit is also available as pre-built, single-file bundles. These are provided for
more flexibility around development workflows: for example, if you would prefer
to download a single file rather than use npm and build tools. The bundles are
standard JavaScript modules with no dependencies - any modern browser should be
able to import and run the bundles from within a `<script type="module">` like this:

```js
import {LitElement, html} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
```

<div class="alert alert-warning">

**If you're using npm for client-side dependencies, you should use [the `lit`
package](#install-locally-from-npm), not these bundles.** The bundles
intentionally combine most or all of Lit into a single file, which can cause
your page to download more code than it needs.

</div>

To browse the bundles, go to <https://cdn.jsdelivr.net/gh/lit/dist/> and use the
dropdown menu to go to the page for a particular version. On that page, there
will be a directory for each type of bundle available for that version. There
are two types of bundles:

<dl class="params">
  <dt class="paramName">core</dt>
  <dd class="paramDetails">
    <a href="https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js">
      https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js
    </a>
    <br>
    <code>core</code> exports the same items as
    <a href="https://github.com/lit/lit/blob/main/packages/lit/src/index.ts">
    the main module of the <code>lit</code> package</a>.
  </dd>

  <dt class="paramName">all</dt>
  <dd class="paramDetails">
    <a href="https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js">
      https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js
    </a>
    <br>
    <code>all</code> exports everything in <code>core</code> plus
    <a href="https://github.com/lit/lit/blob/main/packages/lit/src/index.all.ts">
    most other modules in <code>lit</code></a>.
    <br>
    Note that <code>html</code> and <code>svg</code> exports from <code>lit/static-html.js</code> are aliased to <code>staticHtml</code> and <code>staticSvg</code>, respectively, to avoid collision.
  </dd>
  </dd>
</dl>

## Add Lit to an existing project

See [Adding Lit to an existing project](/docs/v3/tools/adding-lit) for instructions on adding Lit to an existing project or application.
