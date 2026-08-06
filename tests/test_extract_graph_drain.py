"""R-101: the extraction work-list has a consumer that re-checks after EVERY document.

`scripts/extract_graph.py` used to call `fetch_chunks(...)` ONCE, build `by_doc` from that
snapshot, and iterate it to completion — a document whose revision became pending in
`revisions_pending_extraction` WHILE the loop was running sat there until some future
invocation happened to start. Detection was never the problem: the view is live and correct.
The problem was that nothing asked it again.

These tests drive `scripts.extract_graph.drain(...)` directly, with the model, PostgreSQL and
Neo4j entirely absent — a fake in-memory "pending store" stands in for `revisions_pending_extraction`,
and `process_one` is a plain Python callable that mutates that store the way `_mark_extracted`
does in production (removing the just-finished revision from the pending set). This is
intentionally the SAME shape the real loop uses: fetch (tier-ordered) -> process one -> cheap
count check -> re-fetch only if the count grew.

No test here calls Ollama, PostgreSQL, or Neo4j.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts import extract_graph  # noqa: E402


TIER = {"A": 1, "C": 1, "B": 4}  # A, C are project-tier; B is vendor-tier


class FakeStore:
    """Stands in for `revisions_pending_extraction` + the chunk-fetch query.

    `pending` is an ordered dict of document_id -> chunk-record, exactly like a row of
    `fetch_chunks()`'s result grouped by document. Removing a key models `_mark_extracted`
    taking that revision out of the view.
    """

    def __init__(self, pending: dict[str, dict]):
        self.pending = dict(pending)
        self.fetch_calls = 0
        self.count_calls = 0

    def fetch(self):
        """Mirrors `fetch_chunks`: rows ORDERed by tier, longest-chunk-first within a tier."""
        self.fetch_calls += 1
        rows = list(self.pending.values())
        rows.sort(key=lambda r: (r["tier"], -r["n"]))
        return rows

    def count(self):
        """Mirrors the cheap `SELECT count(*) FROM revisions_pending_extraction ...` probe."""
        self.count_calls += 1
        return len(self.pending)


def _row(doc_id: str, tier: int, n: int = 100) -> dict:
    return {
        "document_id": doc_id, "node_id": f"{doc_id}-c1", "content": "x" * n,
        "revision_id": f"{doc_id}-r1", "source_path": f"docs/{doc_id}.md", "n": n, "tier": tier,
    }


def test_a_document_that_becomes_pending_mid_run_is_processed_in_the_same_run():
    """THE HONEST TEST. Start with A (tier1) and B (tier4) pending. While A is being
    processed, C (tier1) becomes pending — simulating an edit landing mid-run. The drain must
    process C in this same run, and — because C is tier1 and B is tier4 — BEFORE B, per the
    owner's ruling that a re-queried project document jumps ahead of a lower-tier document
    still waiting, not behind it.

    If the drain logic snapshots once (the pre-fix behaviour), C is never processed at all in
    this run — it would need the loop to end and a NEW invocation to start. That is exactly
    the defect measured in the register: 17 project documents left waiting after 295 were
    extracted, with no consumer to notice they had appeared.
    """
    store = FakeStore({"A": _row("A", tier=1), "B": _row("B", tier=4)})
    processed: list[str] = []

    def process_one(document_id, doc_chunks):
        processed.append(document_id)
        if document_id == "A":
            # C becomes pending WHILE A is being worked — this is the mid-run edit.
            store.pending["C"] = _row("C", tier=1)
        del store.pending[document_id]  # mirrors _mark_extracted removing it from the view

    extract_graph.drain(fetch_fn=store.fetch, count_fn=store.count, process_one=process_one)

    assert processed == ["A", "C", "B"], (
        f"expected C to be picked up in this run, ahead of the lower-tier B; got {processed}"
    )
    assert store.pending == {}, "the store must be fully drained"


def test_answer_if_the_drain_logic_were_wrong_would_this_fail():
    """A document that appears in a LOWER-priority tier than what remains must NOT jump ahead
    of higher-priority work still queued — the drain only reshuffles because a fresh fetch
    re-sorts everything by tier, it must never special-case "new" items to the front.
    """
    store = FakeStore({"A": _row("A", tier=1), "B": _row("B", tier=1)})
    processed: list[str] = []

    def process_one(document_id, doc_chunks):
        processed.append(document_id)
        if document_id == "A":
            # D is vendor-tier (4) — lower priority than the still-queued B (tier 1).
            store.pending["D"] = _row("D", tier=4)
        del store.pending[document_id]

    extract_graph.drain(fetch_fn=store.fetch, count_fn=store.count, process_one=process_one)

    assert processed == ["A", "B", "D"], f"D (vendor) must not jump ahead of B (project); got {processed}"


def test_the_drain_stops_when_the_view_returns_nothing_in_scope():
    """Negative case: no pending work at all -> process_one is never called, and the drain
    returns cleanly rather than looping forever on an empty store."""
    store = FakeStore({})
    calls = []

    extract_graph.drain(fetch_fn=store.fetch, count_fn=store.count,
                        process_one=lambda d, c: calls.append(d))

    assert calls == []
    assert store.fetch_calls == 1, "an empty store should still be fetched once, then stop"


def test_a_steady_pending_count_does_not_trigger_a_wasted_refetch():
    """When nothing new appears, the drain must not re-run the (relatively) expensive fetch
    query after every single document — only the cheap count probe. This is what makes
    'ask after EVERY document' affordable: the owner's own measurement (0.7ms count vs a full
    fetch) is the entire justification for the design, so the loop must actually honour it."""
    store = FakeStore({"A": _row("A", tier=1), "B": _row("B", tier=4)})

    extract_graph.drain(fetch_fn=store.fetch, count_fn=store.count,
                        process_one=lambda d, c: store.pending.pop(d))

    assert store.fetch_calls == 1, f"expected exactly one fetch (no new work ever appeared); got {store.fetch_calls}"
    assert store.count_calls == 2, f"expected one count check per processed document; got {store.count_calls}"
