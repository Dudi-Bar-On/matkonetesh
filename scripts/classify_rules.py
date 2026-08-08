"""CLI for applying a rule-coverage classification batch (spec
docs/superpowers/specs/2026-08-08-rule-coverage-design.md, Task 4). The three structural refusals
this CLI enforces (see src/rules_store/classify.py for the reasoning behind each):

  1. more than MAX_BATCH (10) entries — refused
  2. approved_by_owner not a YYYY-MM-DD date — refused
  3. a demotion to rule_group/mechanism 'none' with no cost + importance — refused

Usage:
    py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-NN.md [--dry-run]

Exit 0 on success (or a clean --dry-run), exit 1 with every validation error printed on refusal.
--dry-run prints the would-be changes and exits WITHOUT opening the mirror connection at all — a
draft can be sanity-checked with zero write-side effects, not even a file handle.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# The demotion refusal (src/rules_store/classify.py) quotes the owner's binding caveat verbatim
# in Hebrew — that is the whole point of quoting it, not an accident to strip. Windows gives a
# non-console stdout/stderr (a pipe, a redirect, a subprocess capture — exactly how this CLI is
# actually run) the SYSTEM CODE PAGE (cp1252 here), which cannot encode it: `print()` then raises
# UnicodeEncodeError and the process dies mid-message, so the person sees a traceback where the
# refusal reason should be — the opposite of a refusal that "says what is missing and how to
# supply it" (§10.24). Reconfigured to UTF-8 explicitly, at entry, before argparse or anything
# else in this module can print anything.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import classify, config, mirror  # noqa: E402

MIRROR_PATH = ROOT / "rules.sqlite"

_JSON_FENCE_RE = re.compile(r"```json\s*\n(.*?)```", re.DOTALL)


def _load_batch(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    fences = _JSON_FENCE_RE.findall(text)
    if len(fences) == 0:
        raise ValueError(f"{path}: no ```json fenced block found — the batch file must contain exactly one")
    if len(fences) > 1:
        raise ValueError(f"{path}: found {len(fences)} ```json fenced blocks — the batch file must contain exactly one")
    return json.loads(fences[0])


def _load_current(pg_conn) -> dict:
    with pg_conn.cursor() as cur:
        cur.execute("SELECT rule_id, rule_group FROM rule_revisions WHERE is_current")
        return dict(cur.fetchall())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("batch_file", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    try:
        batch = _load_batch(args.batch_file)
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}")
        return 1

    pg_conn = config.connect_writer(timeout=10)
    try:
        current = _load_current(pg_conn)
        errors = classify.validate_batch(batch, current)
        if errors:
            print(f"REFUSED — {len(errors)} error(s) in {args.batch_file}:")
            for e in errors:
                print(f"  - {e}")
            return 1

        entries = batch.get("entries") or []
        if args.dry_run:
            print(f"DRY RUN — {len(entries)} entrie(s) would be applied, no writes made:")
            for e in entries:
                prev = current.get(e["rule_id"])
                print(f"  {e['rule_id']!r}: rule_group {prev!r} -> {e.get('rule_group')!r}, "
                      f"mechanism={e.get('mechanism')!r}, mechanism_target={e.get('mechanism_target')!r}")
            return 0

        mirror_conn = mirror.open_mirror(MIRROR_PATH)
        try:
            result = classify.apply_batch(pg_conn, mirror_conn, batch)
        finally:
            mirror_conn.close()

        print(f"applied {len(result['applied'])} rule(s), regrouped: {result['regrouped']}")
        if result["regrouped"]:
            print("REGROUPED (owner was told in this batch's checkpoint):")
            for rid in result["regrouped"]:
                print(f"  - {rid}")
        return 0
    finally:
        pg_conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
