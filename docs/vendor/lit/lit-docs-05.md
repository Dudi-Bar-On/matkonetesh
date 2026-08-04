---
name: lit-docs-05
description: "Lit (renderer web components) — vendor doc 05/30 (packages)"
type: reference
---

## Config file

The `lit-localize` command-line tool looks for a config file called
`lit-localize.json` in the current directory. Copy-paste the example below for a
quick start, and see the [CLI and config](/docs/v3/localization/cli-and-config)
page for a full reference of all options.

<div class="alert alert-info">

If you're writing JavaScript, set the `inputFiles` property to the location of
your `.js` source files. If you're writing TypeScript, set the `tsConfig`
property to the location of your `tsconfig.json` file, and leave `inputFiles`
blank.

</div>

{% switchable-sample %}

```ts
{
  "$schema": "https://raw.githubusercontent.com/lit/lit/main/packages/localize-tools/config.schema.json",
  "sourceLocale": "en",
  "targetLocales": ["es-419", "zh-Hans"],
  "tsConfig": "./tsconfig.json",
  "output": {
    "mode": "runtime",
    "outputDir": "./src/generated/locales",
    "localeCodesModule": "./src/generated/locale-codes.ts"
  },
  "interchange": {
    "format": "xliff",
    "xliffDir": "./xliff/"
  }
}
```

```js
{
  "$schema": "https://raw.githubusercontent.com/lit/lit/main/packages/localize-tools/config.schema.json",
  "sourceLocale": "en",
  "targetLocales": ["es-419", "zh-Hans"],
  "inputFiles": [
    "src/**/*.js"
  ],
  "output": {
    "mode": "runtime",
    "outputDir": "./src/generated/locales",
    "localeCodesModule": "./src/generated/locale-codes.js"
  },
  "interchange": {
    "format": "xliff",
    "xliffDir": "./xliff/"
  }
}
```

{% endswitchable-sample %}

## Extracting messages

Run `lit-localize extract` to generate an <a
href="https://docs.oasis-open.org/xliff/v1.2/os/xliff-core.html" target="_blank"
rel="noopener">XLIFF</a> file for each target locale. XLIFF is an XML format
supported by most localization tools and services. XLIFF files will be written
to the directory specified by the `interchange.xliffDir` [config
option](/docs/v3/localization/cli-and-config/#xliff-mode-settings).

```sh
lit-localize extract
```

For example, given the source:

```js
msg('Hello World');
msg(str`Hello ${name}`);
msg(html`Hello <b>World</b>`);
```

Then a `<xliffDir>/<locale>.xlf` file will be generated for each target locale:

```xml
<!-- xliff/es-419.xlf -->

<trans-unit id="s3d58dee72d4e0c27">
  <source>Hello World</source>
</trans-unit>

<trans-unit id="saed7d3734ce7f09d">
  <source>Hello <x equiv-text="${name}"/></source>
</trans-unit>

<trans-unit id="hf71d669027554f48">
  <source>Hello <x equiv-text="&lt;b&gt;"/>World<x equiv-text="&lt;/b&gt;"/></source>
</trans-unit>
```

## Translation with XLIFF

XLIFF files can be edited manually, but more typically they are sent to a
third-party translation service where they are edited by language experts using
specialized tools.

After uploading your XLIFF files to your chosen translation service, you will
eventually receive new XLIFF files in response. The new XLIFF files will look
just like the ones you uploaded, but with `<target>` tags inserted into each
`<trans-unit>`.

When you receive new translation XLIFF files, save them to your configured
`interchange.xliffDir` directory, overwriting the original versions.

```xml
<!-- xliff/es-419.xlf -->

<trans-unit id="s3d58dee72d4e0c27">
  <source>Hello World</source>
  <target>Hola Mundo</target>
</trans-unit>

<trans-unit id="saed7d3734ce7f09d">
  <source>Hello <x equiv-text="${name}"/></source>
  <target>Hola <x equiv-text="${name}"/></target>
</trans-unit>

<trans-unit id="hf71d669027554f48">
  <source>Hello <x equiv-text="&lt;b&gt;"/>World<x equiv-text="&lt;/b&gt;"/></source>
  <target>Hola <x equiv-text="&lt;b&gt;"/>Mundo<x equiv-text="&lt;/b&gt;"/></target>
</trans-unit>
```

## Building localized templates

Use the `lit-localize build` command to incorporate translations back into your
application. The behavior of this command depends on the [output mode](#output-modes)
you have configured.

```sh
lit-localize build
```

See the [runtime mode](/docs/v3/localization/runtime-mode) and [transform
mode](/docs/v3/localization/transform-mode) pages for details of how building in
each mode works.

## Message descriptions

Use the `desc` option to the `msg` function to provide human-readable
descriptions for your strings and templates. These descriptions are shown to
translators by most translation tools, and are highly recommended to help
explain and contextualize the meaning of messages.

```js
render() {
  return html`<button>
    ${msg("Launch", {
      desc: "Button that begins rocket launch sequence.",
    })}
  </button>`;
}
```

Descriptions are represented in XLIFF files using `<note>` elements.

```xml
<trans-unit id="s512957aa09384646">
  <source>Launch</source>
  <note from="lit-localize">Button that begins rocket launch sequence.</note>
</trans-unit>
```

## Message IDs

Lit Localize automatically generates an ID for every `msg` call using a hash of
the string.

If two `msg` calls share the same ID, then they are treated as the same message,
meaning they will be translated as a single unit and the same translations will
be substituted in both places.

For example, these two `msg` calls are in two different files, but since they
have the same content they will be treated as one message:

```js
// file1.js
msg('Hello World');

// file2.js
msg('Hello World');
```

### ID generation

The following content affects ID generation:

- String content
- HTML markup
- The position of expressions
- Whether the string is tagged with `html`

The following content **does not** affect ID generation:

- The code inside an expression
- The computed value of an expression
- File location

For example, all of these messages share the same ID:

```js
msg(html`Hello <b>${name}</b>`);
msg(html`Hello <b>${this.name}</b>`);
```

But this message has a different ID:

```js
msg(html`Hello <i>${name}</i>`);
```

Note, while providing a [description](#message-descriptions) does not affect ID
generation, multiple messages with the same ID but different description will
produce an error during analysis to avoid ambiguity in the extracted translation
unit. The following is considered **invalid**:

```js
msg(html`Hello <b>${name}</b>`);
msg(html`Hello <b>${name}</b>`, {desc: 'A friendly greeting'});
```

Make sure that all messages with the same ID also have the same description.
