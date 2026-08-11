# Batch s10 — L89 classified by the owner, 2026-08-11

Written during R-154(b) while activating bounded pytest parallelism, and blocking commits until
classified — `check-rules-classified` and `check-corpus-consistency` both refuse an ungrouped rule.

## `L89` → `A` · `pretooluse:Edit|Write`

**A `pytest_collection_modifyitems` that ADDS a marker another plugin READS in the same hook must
declare `tryfirst=True`.**

`tests/conftest.py` pinned 20 files to a single xdist worker via `xdist_group`, and the pinning did
nothing at all: pytest's default hook ordering ran xdist's marker-reading implementation — the one
that builds the `@group_name` nodeid suffix `--dist loadgroup` schedules by — **before** conftest's
marker-adding one. `-v` showed items from a supposedly pinned file scattered across `gw0`–`gw7`.

It did real damage rather than leaving a theoretical gap: a `psycopg2.errors.ForeignKeyViolation` on
`document_chunks_revision_id_fkey` and a `WorkerBusy` against the live PostgreSQL, from two tests
that were pinned on paper and concurrent in fact.

**Why `A`:** the defect is visible in the artifact. A `pytest_collection_modifyitems` that mutates
markers without `@pytest.hookimpl(tryfirst=True)` is decidable by reading the file, with no knowledge
of intent — the same shape as `L73`, which already inspects a call for a forbidden combination.

The controller raised the counter-argument before the owner ruled: deciding whether *another plugin
reads this particular marker* is third-party knowledge, which argues `C`. The owner ruled `A` on the
narrower, checkable form — a marker-mutating collection hook without `tryfirst` — because the cost of
a false flag is one explicit annotation, and the cost of a miss was measured here in corrupted rows
and a safety net that was silently absent.

```json
{
 "approved_by_owner": "2026-08-11",
 "entries": [
  {
   "rule_id": "L89",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "a pytest_collection_modifyitems that adds or mutates markers without @pytest.hookimpl(tryfirst=True)"
  }
 ]
}
```
