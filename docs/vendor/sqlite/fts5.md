---
name: sqlite-fts5
description: "SQLite FTS5 — full-text search: bm25() ranking, MATCH query syntax, unicode61 & trigram tokenizers, prefix=/content= options (sqlite.org)"
type: reference
---

<!-- source: https://sqlite.org/fts5.html -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY.**
> Retrieved on 2026-08-05 via the `WebFetch` tool, which is **model-mediated**: it reads the page and
> answers a prompt. It **refused** a verbatim-reproduction request outright (it enforces a ~125-character
> cap on quotes from a source). Bash was disabled in the capture session, so `node -e "fetch(...)"` and
> `curl` were both unavailable.
> **Therefore:** text in `"double quotes"` below is reported by the fetcher as an exact phrase from the
> page and is high-confidence. Everything else is **paraphrase**. Treat nothing here as the API contract.
> **Before you rely on any signature or default, open the URL.**
> **Re-pull raw when Bash is available:**
> `node -e "fetch('https://sqlite.org/fts5.html').then(r=>r.text()).then(t=>require('fs').writeFileSync('fts5.raw.html',t))"`

---

## bm25() — the ranking function

**Signature.** `bm25(fts_table_name, weight1, weight2, ...)` — the first argument is the FTS5 table
itself; every argument after it is a **column weight**, a real number.

> "The first argument passed to bm25() following the table name is the weight assigned to the leftmost
> column of the FTS5 table. The second is the weight assigned to the second leftmost column, and so on."

> "If there are not enough arguments for all table columns, remaining columns are assigned a weight of 1.0."

**The free parameters are NOT tunable.**

> "_k1_ and _b_ are both constants, hard-coded at 1.2 and 0.75 respectively."

**Sign convention — this is the one that bites.** In FTS5, **a numerically LOWER bm25() value is a
BETTER match.** Sorting is therefore `ORDER BY rank` (ascending), *not* `DESC`.

> "The '-1' term at the start of the formula is not found in most implementations of the BM25
> algorithm... the FTS5 implementation of BM25 multiplies the result by -1 before returning it, ensuring
> that better matches are assigned numerically lower scores."

**NOT CAPTURED:** the full BM25 formula as typeset on the page (the fetcher would not reproduce it).
If you need the exact IDF/term-frequency expression, read the page.

## The `rank` column

> "[the rank column] contains by default the same value as would be returned by executing the bm25()
> auxiliary function with no trailing arguments."

To change what `rank` means for a table, set the `rank` **configuration option** by inserting into the
table's special one-column-named-after-itself interface:

```sql
INSERT INTO ft(ft, rank) VALUES('rank', 'bm25(10.0, 5.0)');
```

## CREATE VIRTUAL TABLE options

Reported exact syntax forms:

| Option | Forms shown |
|---|---|
| `tokenize=` | `tokenize = 'porter ascii'` or `tokenize = "porter ascii"` |
| `prefix=` | `prefix='2 3'` or `prefix=2, prefix=3` |
| `content=` | `content=t1`, or `content=''` for a **contentless** table |
| `content_rowid=` | `content_rowid='a'` or `content_rowid=d` |
| `columnsize=` | `columnsize=0` or `columnsize=1` |
| `detail=` | `detail=full` \| `detail=column` \| `detail=none` |

## Tokenizers

**Built-in, exactly four:** `unicode61` (**the default**), `ascii`, `porter`, `trigram`.

### unicode61

| Option | Accepted values | Default |
|---|---|---|
| `remove_diacritics` | `"0"`, `"1"`, `"2"` | `"1"` |
| `categories` | space-separated Unicode general-category codes | `"L* N* Co"` |
| `tokenchars` | string of extra characters treated as **token** characters | — |
| `separators` | string of extra characters treated as **separators** | — |

### trigram

> "Each contiguous sequence of three characters" becomes a token — this is what enables
> "substring matching" rather than whole-token matching.

Options: `case_sensitive` — `0` (default) or `1`; `remove_diacritics` — `0` or `1`, and it is
**only valid when `case_sensitive=0`**.

**What it buys you:** the page states it "support[s] indexed GLOB and LIKE pattern matching" when
`remove_diacritics` is not set — i.e. `LIKE '%foo%'` can use the index instead of scanning.

**Stated limitations — all three matter for us:**
- "Substrings consisting of fewer than 3 unicode characters do not match" — **a 1- or 2-character query
  returns nothing.**
- With `detail=none` or `detail=column`: "full-text queries may not contain any tokens longer than
  3 unicode characters".
- The index is **not** used for "LIKE patterns if the LIKE operator has an ESCAPE clause".

## MATCH query syntax

**Boolean operators**, tightest binding first: `NOT`, then `AND`, then `OR`.
- `NOT` — "Matches if query1 matches and query2 does not match"
- `AND` — "Matches if both query1 and query2 match"
- `OR`  — "Matches if either query1 or query2 match"

**Specialised operators:**
- **Prefix** `*` — marks the final token as matching "any document token of which it is a prefix".
- **Phrase** — "ordered list of one or more tokens"; `+` concatenates strings within a phrase.
- **NEAR** — "matches a document if the document contains at least one clump of tokens" containing all
  the phrases within distance N.
- **Column filter** — `:` with optional `-` and `{}`, restricting matching to named columns.

---

## Cross-reference — our usage

- We sort by `bm25()`. **Ascending.** See the sign convention above.
- We use the `trigram` tokenizer. The **3-character minimum** is a hard floor on query length.
- **`UPSERT` does not work on virtual tables** (see `upsert.md` in this folder) — FTS5 tables are
  virtual tables. Plan writes accordingly.
