---
name: lit-docs-04
description: "Lit (renderer web components) — vendor doc 04/30 (packages)"
type: reference
---

## Making strings and templates localizable

To make a string or Lit template localizable, wrap it in the `msg` function. The
`msg` function returns a version of the given string or template in whichever
locale is currently active.

<div class="alert alert-info">

Before you have any translations available, `msg` simply returns the original
string or template, so it's safe to use even if you're not yet ready to actually
localize.

</div>

{% switchable-sample %}

```ts
import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {msg} from '@lit/localize';

@customElement('my-greeter')
class MyGreeter extends LitElement {
  @property()
  who = 'World';

  render() {
    return msg(html`Hello <b>${this.who}</b>`);
  }
}
```

```js
import {html, LitElement} from 'lit';
import {msg} from '@lit/localize';

class MyGreeter extends LitElement {
  static properties = {
    who: {},
  };

  constructor() {
    super();
    this.who = 'World';
  }

  render() {
    return msg(html`Hello <b>${this.who}</b>`);
  }
}
customElements.define('my-greeter', MyGreeter);
```

{% endswitchable-sample %}

### Message types

Any string or template that you would normally render with Lit can be localized,
including ones with dynamic expressions and HTML markup.

Plain string:

```js
msg('Hello World');
```

Plain string with expression (see [strings with
expressions](#strings-with-expressions) for details on `str`):

```js
msg(str`Hello ${name}`);
```

HTML template:

```js
msg(html`Hello <b>World</b>`);
```

HTML template with expression:

```js
msg(html`Hello <b>${name}</b>`);
```

Localized messages can also be nested inside HTML templates:

```js
html`<button>${msg('Hello World')}</button>`;
```

### Strings with expressions

Strings that contain an expression must be tagged with either `html` or `str` in
order to be localizable. You should prefer `str` over `html` when your string
doesn't contain any HTML markup, because it has slightly less performance
overhead. An error will be raised when you run the `lit-localize` command if you
forget the `html` or `str` tag on a string with an expression.

Incorrect:
<strike>

```js
import {msg} from '@lit/localize';
msg(`Hello ${name}`);
```

</strike>

Correct:

```js
import {msg, str} from '@lit/localize';
msg(str`Hello ${name}`);
```

The `str` tag is required in these cases because untagged template string
literals are evaluated to regular strings before they are received by the `msg`
function, which means dynamic expression values could not otherwise be captured
and substituted into the localized versions of the string.

## Locale codes

A locale code is a string that identifies a human language, and sometimes also
includes a region, script, or other variation.

Lit Localize does not mandate use any particular system of locale codes, though
it is strongly recommended to use the <a
href="https://www.w3.org/International/articles/language-tags/index.en"
target="_blank" rel="noopener">BCP 47 language tag standard</a>. Some examples
of BCP 47 language tags are:

- en: English
- es-419: Spanish spoken in Latin America
- zh-Hans: Chinese written in Simplified script

### Terms

Lit Localize defines a few terms that refer to locale codes. These terms are
used in this documentation, in the Lit Localize config file, and in the Lit
Localize API:

<dl class="params">
  <dt class="paramName">Source locale</dt>
  <dd class="paramDetails">
    <p>The locale that is used to write strings and templates in
    your source code.</p>
  </dd>

  <dt class="paramName">Target locales</dt>
  <dd class="paramDetails">
    <p>The locales that your strings and templates can be translated into.</p>
  </dd>

  <dt class="paramName">Active locale</dt>
  <dd class="paramDetails">
    <p>The global locale that is currently being displayed.</p>
  </dd>
</dl>

## Output modes

Lit Localize supports two output modes:

-  _Runtime_ mode uses Lit Localize's APIs to load localized messages at
   runtime.

-  _Transform_ mode eliminates the Lit Localize runtime code by building a
   separate JavaScript bundle for each locale.

<div class="alert alert-info">

**Unsure which mode to use?** Start with runtime mode. It's easy to switch modes
later because the core `msg` API is identical.

</div>

### Runtime mode

In runtime mode, one JavaScript or TypeScript module is generated for each of
your locales. Each module contains the localized templates for that locale. When
the active locale switches, the module for that locale is imported, and all
localized components are re-rendered.

Runtime mode makes switching locales very fast because a page reload is not
required. However, there is a slight performance cost to rendering performance
compared to transform mode.

#### Example generated output

```js
// locales/es-419.ts
export const templates = {
  hf71d669027554f48: html`Hola <b>Mundo</b>`,
};
```

See the [runtime mode](/docs/v3/localization/runtime-mode) page for full details
about runtime mode.

### Transform mode

In transform mode, a separate folder is generated for each locale. Each folder
contains a complete standalone build of your application in that locale, with
`msg` wrappers and all other Lit Localize runtime code completely removed.

Transform mode requires 0 KiB of extra JavaScript and is extremely fast to
render. However, switching locales requires re-loading the page so that a new
JavaScript bundle can be loaded.

#### Example generated output

```js
// locales/en/my-element.js
render() {
  return html`Hello <b>World</b>`;
}
```

```js
// locales/es-419/my-element.js
render() {
  return html`Hola <b>Mundo</b>`;
}
```

See the [transform mode](/docs/v3/localization/transform-mode) page for full
details about transform mode.

### Differences

<!-- TODO(aomarks) Default CSS doesn't have a margin above table -->
<br>

<table>
<thead>
<tr>
  <th></th>
  <th>Runtime mode</th>
  <th>Transform mode</th>
</tr>
</thead>

<tbody>
<tr>
  <td>Output</td>
  <td>A dynamically loaded module for each target locale.</td>
  <td>A standalone app build for each locale.</td>
</tr>

<tr>
  <td>Switch locales</td>
  <td>Call <code>setLocale()</code></td>
  <td>Reload page</td>
</tr>

<tr>
  <td>JS bytes</td>
  <td>1.27 KiB (minified + compressed)</td>
  <td>0 KiB</td>
</tr>

<tr>
  <td>Make template localizable</td>
  <td><code>msg()</code></td>
  <td><code>msg()</code></td>
</tr>

<tr>
  <td>Configure</td>
  <td><code>configureLocalization()</code></td>
  <td><code>configureTransformLocalization()</code></td>
</tr>

<tr>
  <td>Advantages</td>
  <td>
    <ul>
      <li>Faster locale switching.</li>
      <li>Fewer <em>marginal</em> bytes when switching locale.</li>
    </ul>
  </td>
  <td>
    <ul>
      <li>Faster rendering.</li>
      <li>Fewer bytes for a single locale.</li>
    </ul>
  </td>
</tr>
</tbody>
</table>
