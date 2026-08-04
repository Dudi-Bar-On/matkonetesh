---
name: sqlite-upsert
description: "SQLite UPSERT — ON CONFLICT ... DO UPDATE/DO NOTHING, conflict targets, excluded.*, the INSERT...SELECT parsing trap, and the virtual-table limitation (sqlite.org)"
type: reference
---

<!-- source: https://sqlite.org/lang_upsert.html -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY.**
> Retrieved 2026-08-05 via `WebFetch`, which is **model-mediated** and refused verbatim reproduction
> (~125-character quote cap). Bash was disabled, so `node -e "fetch(...)"` and `curl` were unavailable.
> `"Double-quoted"` text is reported as an exact phrase from the page; everything else is **paraphrase**.
> **Not an API contract — open the URL before relying on it.**

---

## Syntax

An `INSERT` statement "followed by one or more ON CONFLICT clauses". Reported shape:

```
INSERT INTO ... VALUES ...
  ON CONFLICT ( indexed-column, ... ) [WHERE expr]
  DO UPDATE SET column-name = expr, ... [WHERE expr]
```

or `DO NOTHING` in place of `DO UPDATE`.

Note there are **two** optional `WHERE` clauses and they do different jobs: the one **after the conflict
target** identifies a *partial* index; the one **after `DO UPDATE SET`** conditionally suppresses the update.

## Conflict target — when required

> "The conflict target may be omitted on the last ON CONFLICT clause in the INSERT statement, but is
> required for all other ON CONFLICT clauses."

> "The conflict target specifies a uniqueness constraint that will trigger the upsert."

The constraint may come from a `CREATE TABLE` statement or from a unique index.

> ## ⚠️ UNCONFIRMED — THE EXACT QUESTION WE CAME TO ANSWER
>
> **Whether an ON CONFLICT target may be an EXPRESSION (an index on an expression), or a PARTIAL unique
> index (named by repeating its WHERE clause), is NOT STATED on the page as retrieved.** The syntax
> diagram shows `indexed-column`, and the retrieval did not establish whether that production admits an
> expression.
>
> **This is recorded as an open question, deliberately, rather than guessed.** Our design does
> `ON CONFLICT ... DO UPDATE` **on an expression index**, so this is load-bearing. **Verify empirically
> before building on it** — the check is small:
>
> ```sql
> CREATE TABLE t(metadata TEXT);
> CREATE UNIQUE INDEX t_tool ON t(json_extract(metadata,'$.tool_name'));
> INSERT INTO t VALUES('{"tool_name":"a"}')
>   ON CONFLICT(json_extract(metadata,'$.tool_name')) DO UPDATE SET metadata=excluded.metadata;
> ```
>
> Consult `lang_upsert.html` and the `CREATE INDEX` grammar directly, and record the result here.

## `excluded.`

> "Column names in the expressions of a DO UPDATE refer to the original unchanged value of the column,
> before the attempted INSERT. To use the value that would have been inserted had the constraint not
> failed, add the special 'excluded.' table qualifier to the column name."

So bare `phonenumber` is the **existing row's** value; `excluded.phonenumber` is "the value...that would
have been inserted." Example: `SET phonenumber=excluded.phonenumber`.

## `DO NOTHING`

**Not explicitly described** on the page beyond appearing in the syntax diagram as the alternative to
`DO UPDATE`. (Standard reading — insert is skipped on conflict rather than raising — but the page as
retrieved does not spell it out, so it is not asserted here.)

## Limitations and version history

**⚠️ UPSERT DOES NOT WORK ON VIRTUAL TABLES.**

> "UPSERT does not currently work for virtual tables."

**This directly constrains our FTS5 design** — FTS5 tables are virtual tables, so no `ON CONFLICT`
against the FTS5 table. Write to the content table and let FTS5 follow (external-content configuration),
or manage FTS5 rows explicitly. See `fts5.md`.

**The `INSERT ... SELECT` parsing ambiguity:**

> "When the INSERT statement...takes its values from a SELECT statement, there is a potential parsing
> ambiguity...the parser might not be able to tell if the 'ON' keyword is introducing the UPSERT or if it
> is the ON clause of a join."

Documented workaround:

> "include a WHERE clause, even if that WHERE clause is just 'WHERE true'."

**Versions:**
- UPSERT syntax added in **SQLite 3.24.0 (2018-06-04)**.
- "multiple ON CONFLICT clauses and...DO UPDATE resolution without a conflict target" added in
  **SQLite 3.35.0 (2021-03-12)**.

> **Our SQLite version was NOT verified.** Bash was disabled, so the intended
> `python -c "import sqlite3; print(sqlite3.sqlite_version)"` check could not be run. Confirm the runtime
> version is ≥ 3.35.0 before relying on multiple `ON CONFLICT` clauses.

---

## ⚠️ RESOLVED 2026-08-05 — measured on this machine, not inferred

The research pass left one question open and marked it UNCONFIRMED, correctly, because it is
exactly this project's use case: **may an expression index, or a PARTIAL expression index, be an
`ON CONFLICT` target?** `agent_memory` upserts through
`ON CONFLICT (file_path, json_extract(metadata,'$.chunk_index')) WHERE type='md_doc'`.

Answer: **yes**, on SQLite 3.50.4.

```sql
CREATE TABLE t(id INTEGER PRIMARY KEY, kind TEXT, meta BLOB);
CREATE UNIQUE INDEX ux ON t(json_extract(meta,'$.k')) WHERE kind='a';

INSERT INTO t(kind,meta) VALUES('a', jsonb('{"k":1}'));
INSERT INTO t(kind,meta) VALUES('a', jsonb('{"k":1}'))
  ON CONFLICT(json_extract(meta,'$.k')) WHERE kind='a' DO UPDATE SET kind='a';
-- -> 1 row. The second insert resolved to an update.
```

The conflict target must repeat the index expression **and its WHERE clause**, textually. SQLite
matches the written form, not the meaning — see expression-indexes.md.

## The virtual-table limitation does not reach us

The docs note that UPSERT does not work for virtual tables, and FTS5 tables are virtual. Checked:
`agent_memory_fts` is only ever written by `DELETE` + `INSERT` in `rebuild_index()`. Nothing
upserts it. Rebuilding was chosen for a different reason — an index maintained incrementally is a
second source of truth that can drift — and it happens to sidestep this entirely.
