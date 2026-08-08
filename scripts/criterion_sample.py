"""CLI: draw a round's blind sample and build its packet (criterion arc, Task 2). Also supports
apply-mode chunking (Task 6). See src/rules_store/criterion.py for the pure logic this wraps.

Usage:
    py -3 scripts/criterion_sample.py --round N --seed N
    py -3 scripts/criterion_sample.py --apply --chunk K   (K = 1..5)

Exit 0 on success. Exit 1, message printed, on: --round N already exists in the ledger; N greater
than MAX_MEASUREMENTS; or the pool-exhaustion refusal from draw_sample.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# L74: UTF-8 stdout/stderr before anything else can print Hebrew.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import criterion  # noqa: E402

MIRROR_PATH = ROOT / "rules.sqlite"
CRITERION_DIR = ROOT / "docs" / "process" / "rule-coverage" / "criterion"
LEDGER_PATH = CRITERION_DIR / "measured-ids.json"

_VERSION_HEADING_RE = None


def _current_criterion_version(text: str) -> int:
    import re
    global _VERSION_HEADING_RE
    if _VERSION_HEADING_RE is None:
        _VERSION_HEADING_RE = re.compile(r"^## גרסה (\d+)", re.MULTILINE)
    versions = [int(m) for m in _VERSION_HEADING_RE.findall(text)]
    return max(versions) if versions else 1


def _round_dir(round_no: int) -> Path:
    return CRITERION_DIR / "rounds" / f"round-{round_no}"


def _draw_round(round_no: int, seed: int) -> int:
    ledger = criterion.load_ledger(LEDGER_PATH)
    if any(r["round"] == round_no for r in ledger["rounds"]):
        print(f"REFUSED — round {round_no} already exists in the ledger "
              f"({LEDGER_PATH}); rounds are never re-drawn.")
        return 1
    if round_no > criterion.MAX_MEASUREMENTS:
        print(f"REFUSED — round {round_no} exceeds MAX_MEASUREMENTS "
              f"({criterion.MAX_MEASUREMENTS}); the arc stops before a 5th measurement.")
        return 1

    criterion_text = criterion.CRITERION_PATH.read_text(encoding="utf-8")
    version = _current_criterion_version(criterion_text)

    pool = criterion.load_pool(MIRROR_PATH)
    measured_ids = {rid for r in ledger["rounds"] for rid in r["drawn"]}
    try:
        sample = criterion.draw_sample(list(pool), measured_ids, seed=seed)
    except ValueError as exc:
        print(f"REFUSED — {exc}")
        return 1

    packet, mapping = criterion.build_packet(pool, sample, criterion_text, seed=seed)

    out_dir = _round_dir(round_no)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "packet.md").write_text(packet, encoding="utf-8")
    (out_dir / "mapping.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=1), encoding="utf-8")

    criterion.record_draw(LEDGER_PATH, round_no, seed, version, sample)

    print(f"round {round_no}: drew {len(sample)} rules, wrote {out_dir / 'packet.md'} "
          f"and {out_dir / 'mapping.json'}; ledger updated.")
    return 0


def _apply_chunk(chunk: int) -> int:
    if not (1 <= chunk <= 5):
        print(f"REFUSED — chunk must be 1..5, got {chunk}")
        return 1

    criterion_text = criterion.CRITERION_PATH.read_text(encoding="utf-8")
    pool = criterion.load_pool(MIRROR_PATH)
    all_ids = sorted(pool)
    if len(all_ids) != 95:
        print(f"WARNING — expected 95 rules in the pool, found {len(all_ids)}")

    lo = 19 * (chunk - 1)
    hi = 19 * chunk
    slice_ids = all_ids[lo:hi]

    # Global token numbering: S(19K-18)..S(19K) for chunk K.
    start_index = lo + 1
    packet, mapping = criterion.build_packet(pool, slice_ids, criterion_text, seed=chunk,
                                              token_prefix="S")
    # Re-number tokens globally (build_packet numbers 1..len(slice) by default).
    renumbered_mapping = {}
    local_tokens = sorted(mapping)
    for i, tok in enumerate(local_tokens):
        global_num = start_index + i
        new_tok = f"S{global_num:02d}"
        renumbered_mapping[new_tok] = mapping[tok]
        packet = packet.replace(f"### {tok}", f"### {new_tok}")

    out_dir = CRITERION_DIR / "apply"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"chunk-{chunk}-packet.md").write_text(packet, encoding="utf-8")
    (out_dir / f"chunk-{chunk}-mapping.json").write_text(
        json.dumps(renumbered_mapping, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"apply chunk {chunk}: {len(slice_ids)} rules, tokens "
          f"S{start_index:02d}..S{start_index + len(slice_ids) - 1:02d}, wrote "
          f"{out_dir / f'chunk-{chunk}-packet.md'} and {out_dir / f'chunk-{chunk}-mapping.json'}.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--chunk", type=int)
    args = ap.parse_args()

    if args.apply:
        if args.chunk is None:
            print("REFUSED — --apply requires --chunk K (K = 1..5)")
            return 1
        return _apply_chunk(args.chunk)

    if args.round is None or args.seed is None:
        print("REFUSED — non-apply mode requires --round N --seed N")
        return 1
    return _draw_round(args.round, args.seed)


if __name__ == "__main__":
    raise SystemExit(main())
