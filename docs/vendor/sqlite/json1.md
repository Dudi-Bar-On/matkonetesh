---
name: sqlite-json1
description: "SQLite JSON functions — jsonb(), json_extract(), json_valid(), the -> and ->> operators, path syntax, text vs binary JSONB (sqlite.org)"
type: reference
---

<!-- source: https://sqlite.org/json1.html -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY.**
> Retrieved 2026-08-05 via `WebFetch`, which is **model-mediated** and **refused** verbatim reproduction
> (it caps quotes at ~125 characters). Bash was disabled, so `node -e "fetch(...)"` and `curl` were both
> unavailable. Text in `"double quotes"` is reported as an exact phrase from the page (high confidence);
> everything else is **paraphrase**. **Not an API contract — open the URL before relying on a signature.**

---

## JSONB — the binary representation

> "The jsonb(X) function returns the binary JSONB representation of the JSON provided as argument X."

JSONB is stored as a **BLOB**. It is:

> "SQLite's internal binary representation of JSON used by SQLite and is intended for internal use by
> SQLite only."

> "Applications should not use JSONB outside of SQLite nor try to reverse-engineer the JSONB format."

**It is NOT a documented, stable, external format.** Do not persist it anywhere that another program
parses, and do not assume it survives a SQLite upgrade unchanged.

**Why use it:**

> "By storing SQLite's internal binary representation of JSON directly in the database, applications can
> bypass the overhead of parsing and rendering JSON."

It is "smaller and faster than text JSON - potentially several times faster."

**The critical caveat — it is NOT PostgreSQL's JSONB.** Unlike PostgreSQL, SQLite "makes no such claim"
of O(1) subscript lookup; it has "O(N) time complexity for most operations." JSONB here buys you *parse
avoidance*, **not** indexed field access. If you need fast field access, you still need an index —
see `expression-indexes.md`.

## `json_extract(X, P, ...)`

**With a single path**, the return type depends on the JSON value:

> "NULL for a JSON null, INTEGER or REAL for a JSON numeric value, an INTEGER zero for a JSON false
> value, an INTEGER one for a JSON true value, the dequoted text for a JSON string value, and a text
> representation for JSON object and array values."

So a JSON **string** comes back **dequoted** as SQL TEXT — this is what makes
`json_extract(metadata,'$.tool_name')` directly comparable to a plain string literal.

**With two or more paths**, it returns:

> "SQLite text which is a well-formed JSON array holding the various values."

**Divergence from MySQL — a real portability trap:**

> "The MySQL version of json_extract() always returns JSON. The SQLite version of json_extract() only
> returns JSON if there are two or more PATH arguments...or if the single PATH argument references an
> array or object."

Worked contrast from the page: `json_extract('{"a":null}','$.a')` returns SQL `NULL` in SQLite, but the
JSON text `'null'` in MySQL.

## The `->` and `->>` operators

> "Both the -> and ->> operators select the same subcomponent of the JSON to their left."

The difference is purely in the **return type**:

> "The -> operator returns a text JSON representation of the selected subcomponent or NULL if that
> subcomponent does not exist. The ->> operator returns an SQL TEXT, INTEGER, REAL, or NULL value."

- `->`  → **always JSON**
- `->>` → **always an SQL scalar**

And versus `json_extract`:

> "[they] are subtly different from a two-argument json_extract() function call. A call to json_extract()
> with two arguments will return a JSON representation of the subcomponent if and only if the
> subcomponent is a JSON array or object."

**Practical rule:** `->>` and a single-path `json_extract()` agree for scalars but **disagree for arrays
and objects** (`json_extract` hands back JSON text there). Pick one and use it consistently — mixing them
in an expression index and its query will silently defeat the index (see `expression-indexes.md`:
the expression must match "exactly as it is written").

## `json_valid(X)` and `json_valid(X, Y)`

Single argument (equivalent to `Y = 1`):

> "Returns 1 if the argument X is well-formed JSON, or returns 0 if X is not well-formed."

The optional second argument is a **bitmask** selecting what counts as valid:

| Bit | Meaning |
|---|---|
| `0x01` | "strictly complies with canonical RFC-8259 JSON, without any extensions" |
| `0x02` | "JSON with JSON5 extensions" |
| `0x04` | "BLOB that superficially appears to be JSONB" |
| `0x08` | "BLOB that strictly conforms to the internal JSONB format" |

Useful combinations called out by the page:
- **`6`** → "JSON5 text or JSONB ← This is probably the value you want"
- **`8`** → "strictly conforming JSONB"

Note `0x04` is only a **superficial** check — cheap, but it can pass a corrupt blob. `0x08` is the strict
(more expensive) one. The default `Y=1` exists for backward compatibility with pre-JSON5 versions.

## Path syntax

> "A well-formed PATH is a text value that begins with exactly one '$' character followed by zero or more
> instances of '._objectlabel_' or '\[_arrayindex_\]'."

| Path | Meaning |
|---|---|
| `$` | the root element |
| `$.a` | object member `a` |
| `$[0]` | array element at index 0 |
| `$[#-1]` | the **last** array element — `#` is "the number of elements in the array" |
| `$[#]` | append position, e.g. `json_insert('[0,1,2]','$[#]','new') → '[0,1,2,"new"]'` |

---

## Cross-reference — our usage

We index `json_extract(metadata,'$.tool_name')`. Two consequences from the pages in this folder:
- The query **must spell the expression the same way** for the index to be used — see `expression-indexes.md`.
- `json_extract` is deterministic, which is a **requirement** for an indexable expression.
