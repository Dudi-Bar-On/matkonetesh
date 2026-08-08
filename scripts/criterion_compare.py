"""CLI: validate both classifiers' answer files for a round and emit the agreement verdict
(criterion arc, Task 3). See src/rules_store/criterion.py for the pure logic this wraps.

Usage:
    py -3 scripts/criterion_compare.py --round N
    py -3 scripts/criterion_compare.py --apply

THE STRUCTURAL REFUSAL THIS CLI EXISTS TO ENFORCE: comparison runs ONLY after BOTH classifiers'
answer files exist. If either is missing, exit 1 and say which file is missing — a comparison that
quietly proceeds with one file is not a measurement of agreement.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# L74: UTF-8 stdout/stderr before anything else can print Hebrew.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import criterion  # noqa: E402

CRITERION_DIR = ROOT / "docs" / "process" / "rule-coverage" / "criterion"
LEDGER_PATH = CRITERION_DIR / "measured-ids.json"


def _round_dir(round_no: int) -> Path:
    return CRITERION_DIR / "rounds" / f"round-{round_no}"


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _compare_round(round_no: int) -> int:
    out_dir = _round_dir(round_no)
    mapping_path = out_dir / "mapping.json"
    alpha_path = out_dir / "answers-alpha.json"
    beta_path = out_dir / "answers-beta.json"

    if not out_dir.exists() or not mapping_path.exists():
        print(f"REFUSED — round {round_no} does not exist / mapping.json missing at {out_dir}")
        return 1

    if not alpha_path.exists() or not beta_path.exists():
        missing = []
        if not alpha_path.exists():
            missing.append("answers-alpha.json")
        if not beta_path.exists():
            missing.append("answers-beta.json")
        print("REFUSED — comparison runs only after BOTH classifiers have finished — "
              f"{' and '.join(missing)} missing.")
        return 1

    mapping = _load_json(mapping_path)
    alpha = _load_json(alpha_path)
    beta = _load_json(beta_path)
    expected_tokens = set(mapping)

    alpha_errors = criterion.validate_answers(alpha, expected_tokens)
    beta_errors = criterion.validate_answers(beta, expected_tokens)
    if alpha_errors or beta_errors:
        print(f"REFUSED — answer validation failed:")
        for e in alpha_errors:
            print(f"  alpha: {e}")
        for e in beta_errors:
            print(f"  beta: {e}")
        return 1

    result = criterion.compare_answers(alpha, beta, mapping)

    criterion_version = None
    seed = None
    ledger = criterion.load_ledger(LEDGER_PATH)
    for r in ledger["rounds"]:
        if r["round"] == round_no:
            criterion_version = r["criterion_version"]
            seed = r["seed"]
            r["verdict"] = result["verdict"]
    LEDGER_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=1), encoding="utf-8")

    lines = [
        f"# תוצאת סבב {round_no}",
        "",
        f"גרסת קריטריון שנמדדה: {criterion_version}",
        f"seed: {seed}",
        "",
        f"הסכמות: {result['agreements']}/{result['total']}",
        f"VERDICT: {result['verdict']}",
        "",
    ]
    if result["disagreements"]:
        lines.append("## אי-הסכמות")
        lines.append("")
        lines.append("| token | rule_id | alpha | beta | נימוק alpha | נימוק beta |")
        lines.append("|---|---|---|---|---|---|")
        for d in result["disagreements"]:
            lines.append(f"| {d['token']} | {d['rule_id']} | {d['alpha_group']} | "
                          f"{d['beta_group']} | {d['alpha_reason']} | {d['beta_reason']} |")
        lines.append("")
    if result["mechanism_conflicts"]:
        lines.append("## התנגשויות מנגנון (על קבוצה שהוסכמה)")
        lines.append("")
        for m in result["mechanism_conflicts"]:
            lines.append(f"- {m['rule_id']}: alpha={m['alpha_mechanism']}/"
                          f"{m['alpha_mechanism_target']}, beta={m['beta_mechanism']}/"
                          f"{m['beta_mechanism_target']}")
        lines.append("")

    result_text = "\n".join(lines)
    (out_dir / "result.md").write_text(result_text, encoding="utf-8")
    print(result_text)
    return 0


def _compare_apply() -> int:
    apply_dir = CRITERION_DIR / "apply"
    alpha_path = apply_dir / "answers-alpha.json"
    beta_path = apply_dir / "answers-beta.json"

    if not alpha_path.exists() or not beta_path.exists():
        missing = []
        if not alpha_path.exists():
            missing.append("answers-alpha.json")
        if not beta_path.exists():
            missing.append("answers-beta.json")
        print("REFUSED — apply comparison runs only after BOTH merged answer files exist — "
              f"{' and '.join(missing)} missing.")
        return 1

    # Merge the 5 chunk mappings.
    mapping: dict[str, str] = {}
    for k in range(1, 6):
        chunk_mapping_path = apply_dir / f"chunk-{k}-mapping.json"
        if not chunk_mapping_path.exists():
            print(f"REFUSED — {chunk_mapping_path} missing; cannot assemble the 95-token mapping.")
            return 1
        mapping.update(_load_json(chunk_mapping_path))

    alpha = _load_json(alpha_path)
    beta = _load_json(beta_path)
    expected_tokens = set(mapping)

    alpha_tokens = {e.get("token") for e in alpha}
    beta_tokens = {e.get("token") for e in beta}
    if len(expected_tokens) != 95 or alpha_tokens != expected_tokens or beta_tokens != expected_tokens:
        print(f"REFUSED — expected 95 tokens, found alpha={len(alpha_tokens)}, "
              f"beta={len(beta_tokens)}, mapping={len(expected_tokens)}")
        return 1

    result = criterion.compare_answers(alpha, beta, mapping)
    # No PASS/FAIL threshold in apply mode — routing, not a measurement.
    agreed_count = result["agreements"]
    disputed_count = result["total"] - result["agreements"]

    payload = {
        "total": result["total"],
        "agreed": agreed_count,
        "disputed": disputed_count,
        "disagreements": result["disagreements"],
        "mechanism_conflicts": result["mechanism_conflicts"],
    }
    (apply_dir / "agreement.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"apply agreement: {agreed_count} agreed, {disputed_count} disputed "
          f"(out of {result['total']}); wrote {apply_dir / 'agreement.json'}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    if args.apply:
        return _compare_apply()

    if args.round is None:
        print("REFUSED — pass --round N or --apply")
        return 1
    return _compare_round(args.round)


if __name__ == "__main__":
    raise SystemExit(main())
