---
name: sqlite-expression-indexes
description: "SQLite indexes on expressions — syntax, the determinism/subquery restrictions, and the exact-match rule the query planner uses (sqlite.org)"
type: reference
---

<!-- source: https://sqlite.org/expridx.html -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY.**
> Retrieved 2026-08-05 via `WebFetch`, which is **model-mediated** and refused verbatim reproduction
> (~125-character quote cap). Bash was disabled, so `node -e "fetch(...)"` and `curl` were unavailable.
> `"Double-quoted"` text is reported as an exact phrase from the page; everything else is **paraphrase**.
> **Not an API contract — open the URL before relying on it.**

---

## Syntax

> "Use a CREATE INDEX statement to create a new index on one or more expressions just like you would to
> create an index on columns."

Example from the page:

```sql
CREATE INDEX acctchng_magnitude ON account_change(acct_no, abs(amt));
```

## Restrictions — the complete stated list

1. > "Expressions in CREATE INDEX statements may only refer to columns of the table being indexed, not to
   > columns in other tables."

2. > "Expressions in CREATE INDEX statements may contain function calls, but only to functions whose
   > output is always determined completely by its input parameters (a.k.a.: deterministic functions)."

3. > "Expressions in CREATE INDEX statements may not use subqueries."

4. > "Expressions may only be used in CREATE INDEX statements, not within UNIQUE or PRIMARY KEY
   > constraints within the CREATE TABLE statement."

**Point 4 matters for UPSERT:** you cannot declare an expression-based uniqueness constraint inline in
`CREATE TABLE`. To get a unique expression index you must write a separate
`CREATE UNIQUE INDEX ... ON t(expr)`.

## THE RULE THAT BITES: the planner matches text, not meaning

> "The query planner will consider using an index on an expression when the expression that is indexed
> appears in the WHERE clause or in the ORDER BY clause of a query, exactly as it is written."

The match must be **exact**, tolerating only "minor syntactic differences such as white-space changes."
**Mathematical equivalence is not enough.**

**Consequence for us.** Having created:

```sql
CREATE INDEX ... ON t(json_extract(metadata,'$.tool_name'));
```

then this query **uses** the index:

```sql
WHERE json_extract(metadata,'$.tool_name') = 'foo'
```

and this one, though semantically identical, **will not**:

```sql
WHERE metadata ->> '$.tool_name' = 'foo'
```

Likewise a different quoting style for the path, or a reordered equivalent expression, silently drops you
to a full scan. **The failure is silent — there is no error, only slowness.** Verify with `EXPLAIN QUERY PLAN`.

## json_extract-specific caveats

**Not stated on page.** The page does not single out `json_extract` or any JSON function. What it does
establish is the general rule that applies to it: it must be deterministic (it is), and the query must
spell it identically.

---

## Cross-reference

- `json1.md` — why `->>` and `json_extract()` are not interchangeable in the index expression.
- `partial-indexes.md` — a `WHERE` clause on the index adds a *second* matching hurdle.
- `upsert.md` — whether an expression index may serve as an `ON CONFLICT` target is **UNCONFIRMED**; see that file.
