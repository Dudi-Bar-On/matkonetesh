"""R-136 RED #2: `find_impact` and `find_dependency_path` returned nothing for `proposed` edges
before the supersede pass; they must still return nothing for the same edges now that they carry
`superseded` instead.

Both queries filter `r.status IN ['current', 'manually_confirmed']` — an ALLOWLIST, not a denylist
of 'proposed'. That is what makes the guarantee hold across the status flip with zero code change:
'superseded' was never on the allowlist, so it needs no new exclusion added for it. This test proves
that allowlist shape directly against the query text, which is the actual mechanism the guarantee
rests on — the strongest check available in this session (Neo4j is unreachable here: `infra/.env`
is absent, see the R-136 report's "blocked" section; a live re-check with real superseded data is
listed there as the follow-up for whoever runs the apply pass).
"""

from __future__ import annotations

import inspect
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import retrieval  # noqa: E402

ALLOWED = "r.status IN ['current', 'manually_confirmed']"


def test_find_impact_uses_an_allowlist_that_excludes_both_proposed_and_superseded():
    src = inspect.getsource(retrieval.find_impact)
    assert ALLOWED in src, (
        "find_impact must gate on an explicit status allowlist, not a denylist of 'proposed' - "
        "a denylist would need updating for every new non-promotable status (including "
        "'superseded'); an allowlist needs none."
    )
    assert "'proposed'" not in src and '"proposed"' not in src, (
        "no denylist of 'proposed' should exist here at all"
    )
    assert "'superseded'" not in src and '"superseded"' not in src, (
        "superseded must not be special-cased in - it stays excluded for free, by not being on "
        "the allowlist"
    )


def test_find_dependency_path_uses_the_same_allowlist():
    src = inspect.getsource(retrieval.find_dependency_path)
    assert ALLOWED in src
    assert "'proposed'" not in src and '"proposed"' not in src
    assert "'superseded'" not in src and '"superseded"' not in src


def test_the_allowlist_has_exactly_two_members_current_and_manually_confirmed():
    """Guards against a future edit that widens the allowlist (e.g. adding 'superseded' back in
    to "be helpful") without anyone noticing it silently reopens R-136's whole finding."""
    for fn in (retrieval.find_impact, retrieval.find_dependency_path):
        src = inspect.getsource(fn)
        assert "status IN ['current', 'manually_confirmed']" in src, (
            f"{fn.__name__}: allowlist changed shape — re-verify it still excludes proposed/superseded"
        )
