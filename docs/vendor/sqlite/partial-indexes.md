---
name: sqlite-partial-indexes
description: "SQLite partial indexes — CREATE INDEX ... WHERE, the WHERE-clause restrictions, and the planner's usability rule (sqlite.org)"
type: reference
---

<!-- source: https://sqlite.org/partialindex.html -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY.**
> Retrieved 2026-08-05 via `WebFetch`, which is **model-mediated** and refused verbatim reproduction
> (~125-character quote cap). Bash was disabled, so `node -e "fetch(...)"` and `curl` were unavailable.
> `"Double-quoted"` text is reported as an exact phrase from the page; everything else is **paraphrase**.
> **Not an API contract — open the URL before relying on it.**

---

## Syntax

Reported syntax skeleton (as rendered from the railroad diagram — treat the diagram on the page as
authoritative):

```
CREATE [UNIQUE] INDEX [IF NOT EXISTS] [schema-name.] index-name
  ON table-name ( indexed-column, ... )
  WHERE expr
```

Ours:

```sql
CREATE INDEX ... ON t(...) WHERE type='md_doc';
```

## WHERE-clause restrictions

The clause **may** contain "operators, literal values, and names of columns in the table being indexed".

It **may not** contain:

> "subqueries, references to other tables, non-deterministic functions, or bound parameters."

**`bound parameters` is the sharp edge** — you cannot parameterise a partial index's predicate. The
constant must be literal in the DDL, exactly as our `type='md_doc'` is.

## THE PLANNER RULE — when the partial index is usable

Let **W** be the query's `WHERE` clause and **X** the index's `WHERE` clause. The page gives two rules:

> "If W is AND-connected terms and X is OR-connected terms and if any term of W appears as a term of X,
> then the partial index is usable."

Plus a special case:

> "if a term in X is of the form 'z IS NOT NULL' and if a term in W is a comparison operator on 'z' other
> than 'IS', then those terms match."

**Practical reading for us:** the query must itself carry the predicate. `WHERE type='md_doc' AND ...`
can use the index; a query that omits `type='md_doc'` **cannot**, even if every row it touches happens to
satisfy it. SQLite performs **term matching, not logical inference** — it will not prove implication for
you. As with expression indexes, **the miss is silent**; confirm with `EXPLAIN QUERY PLAN`.

## Interaction with UNIQUE and with UPSERT / ON CONFLICT

A **unique partial index** enforces uniqueness "across some subset of the rows" rather than the whole table.

**On UPSERT / `ON CONFLICT`: NOT STATED ON THIS PAGE.** The page does not address whether a partial unique
index can serve as an UPSERT conflict target, nor what must be spelled out to name it. See `upsert.md` —
that page did not settle it either, and it is recorded there as **UNCONFIRMED**. Do not assume; test.

## Cost benefit

Writes get cheaper as well as reads, because excluded rows never touch the index. The page's example:

> "changes to the original purchaseorder table will run faster since the po_parent index only needs to be
> updated for those exceptional rows where parent_po is not NULL."

---

## Cross-reference

- `expression-indexes.md` — combining a partial index with an expression index means **both** matching
  rules apply at once: the expression must appear exactly as written **and** the query must carry the
  index's `WHERE` term.
- `upsert.md` — conflict-target rules.
