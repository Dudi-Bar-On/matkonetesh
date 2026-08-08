"""Classification-criterion arc (spec docs/superpowers/specs/2026-08-08-classification-criterion-design.md,
plan docs/superpowers/plans/2026-08-08-classification-criterion.md). Sampling, blind-packet
construction, and answer validation/agreement comparison — the machinery that makes a
classification decision REPEATABLE and proves it before it touches 95 rules.

Independence is enforced by construction, not by intention: `load_pool`'s query selects only
`rule_id, title_he, statement` — the truth columns (`rule_group`, `mechanism`, `mechanism_target`)
are never in the row the caller can see, so nothing downstream can leak them by accident.

Two refusals in this module are the arc's structural guarantees (spec's own words: "measurement
before application" and "fresh samples only"):

  1. `draw_sample` refuses (ValueError) when the unmeasured pool drops below SAMPLE_SIZE — the
     sample is never shrunk to fit.
  2. (enforced by `scripts/criterion_compare.py`, Task 3) comparison refuses to run when only one
     classifier's answers exist; a comparison run on one file is not a measurement.
"""
from __future__ import annotations

import json
import random
import sqlite3
from pathlib import Path

from src.rules_store import classify

POOL_GROUPS = ("C", "none")   # the 95: C=56, none=39 — measured, spec-fixed
SAMPLE_SIZE = 20
MAX_MEASUREMENTS = 4          # 1 initial + 3 revisions (Task 5)

ROOT = Path(__file__).resolve().parent.parent.parent
CRITERION_PATH = ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "criterion.md"


def load_pool(mirror_path) -> dict[str, dict]:
    """rule_id -> {"title_he":…, "statement":…}; ONLY rule_group in POOL_GROUPS; the returned
    dicts NEVER carry rule_group/mechanism/mechanism_target — stripped at the query, not later."""
    conn = sqlite3.connect(mirror_path)
    try:
        placeholders = ",".join("?" for _ in POOL_GROUPS)
        rows = conn.execute(
            f"SELECT rule_id, title_he, statement FROM rule_revisions "
            f"WHERE rule_group IN ({placeholders})",
            POOL_GROUPS,
        ).fetchall()
    finally:
        conn.close()
    return {rule_id: {"title_he": title_he, "statement": statement}
            for rule_id, title_he, statement in rows}


def draw_sample(pool_ids: list[str], measured_ids: set[str], seed: int) -> list[str]:
    """Deterministic: sorted(pool - measured), random.Random(seed).sample(…, SAMPLE_SIZE).
    Raises ValueError('unmeasured pool has N rules, fewer than 20 — ARC STOP: write the
    boundary-blur report (spec §5)') when len(pool - measured) < SAMPLE_SIZE."""
    unmeasured = sorted(set(pool_ids) - set(measured_ids))
    if len(unmeasured) < SAMPLE_SIZE:
        raise ValueError(
            f"unmeasured pool has {len(unmeasured)} rules, fewer than {SAMPLE_SIZE} — "
            "ARC STOP: write the boundary-blur report (spec §5)"
        )
    rng = random.Random(seed)
    return rng.sample(unmeasured, SAMPLE_SIZE)


def build_packet(rules: dict[str, dict], sample_ids: list[str], criterion_text: str,
                  seed: int, token_prefix: str = "R") -> tuple[str, dict[str, str]]:
    """Returns (packet_markdown, mapping token->rule_id). Tokens R01.. in an order shuffled by
    random.Random(seed) — packet order never equals corpus order. Packet = criterion text +
    per-token title_he + statement. HARD GUARANTEE (tested): the packet string contains none of
    'rule_group', 'mechanism', any rule_id from the sample, and no group letter next to a token."""
    shuffled = list(sample_ids)
    random.Random(seed).shuffle(shuffled)

    width = max(2, len(str(len(shuffled))))
    tokens = [f"{token_prefix}{i:0{width}d}" for i in range(1, len(shuffled) + 1)]
    mapping = dict(zip(tokens, shuffled))

    parts = [criterion_text, "", "---", "", "## הכללים לסיווג (עיוור — ללא מזהה, ללא קבוצה)", ""]
    for token in tokens:
        rule_id = mapping[token]
        rule = rules[rule_id]
        parts.append(f"### {token}")
        parts.append("")
        parts.append(f"**כותרת:** {rule['title_he']}")
        parts.append("")
        parts.append(f"**נוסח הכלל:** {rule['statement']}")
        parts.append("")

    packet = "\n".join(parts)
    return packet, mapping


def load_ledger(ledger_path: Path) -> dict:
    """{"rounds": [...]}; missing file returns the empty shape (a first draw initializes it)."""
    if not Path(ledger_path).exists():
        return {"rounds": []}
    return json.loads(Path(ledger_path).read_text(encoding="utf-8"))


def record_draw(ledger_path: Path, round_no: int, seed: int, criterion_version: int,
                 drawn: list[str]) -> dict:
    """Appends {"round", "seed", "criterion_version", "drawn", "verdict": None} to the ledger and
    writes it back. A failed round's rules are still consumed — that is the fresh-sample rule."""
    ledger = load_ledger(ledger_path)
    ledger["rounds"].append({
        "round": round_no,
        "seed": seed,
        "criterion_version": criterion_version,
        "drawn": list(drawn),
        "verdict": None,
    })
    Path(ledger_path).write_text(json.dumps(ledger, ensure_ascii=False, indent=1), encoding="utf-8")
    return ledger


def validate_answers(answers: list[dict], expected_tokens: set[str]) -> list[str]:
    """Full-sentence errors (classify.validate_batch style — never raises on shape): missing/extra/
    duplicate tokens; group not in {"A","B","C","none"}; A missing artifact/pattern/mechanism/
    mechanism_target or mechanism not in classify.VOCAB; B missing mechanism/mechanism_target/
    observed_prior_facts; C missing reason; none missing cost/importance. Empty list == usable."""
    errors: list[str] = []

    seen_tokens: set[str] = set()
    by_token: dict[str, dict] = {}
    for entry in answers:
        token = entry.get("token")
        if not token:
            errors.append(f"entry with no token: {entry!r}")
            continue
        if token in seen_tokens:
            errors.append(f"token {token!r} appears more than once in the answer file")
        seen_tokens.add(token)
        by_token[token] = entry

    missing_tokens = expected_tokens - seen_tokens
    for token in sorted(missing_tokens):
        errors.append(f"token {token!r} is missing from the answer file — a missing token is "
                       "an error, not a skip")

    extra_tokens = seen_tokens - expected_tokens
    for token in sorted(extra_tokens):
        errors.append(f"token {token!r} is not one of the expected tokens for this round")

    for token, entry in by_token.items():
        group = entry.get("group")
        if group not in classify.RULE_GROUPS:
            errors.append(f"{token!r} has group {group!r}, not one of {sorted(classify.RULE_GROUPS)}")
            continue

        if group == "A":
            for field in ("artifact", "pattern", "mechanism_target"):
                if not str(entry.get(field) or "").strip():
                    errors.append(f"{token!r} is group A but missing {field!r}")
            mechanism = entry.get("mechanism")
            if not mechanism or mechanism not in classify.VOCAB:
                errors.append(f"{token!r} is group A but mechanism {mechanism!r} is not in "
                               f"the vocabulary {sorted(classify.VOCAB)}")
        elif group == "B":
            for field in ("mechanism_target", "observed_prior_facts"):
                if not str(entry.get(field) or "").strip():
                    errors.append(f"{token!r} is group B but missing {field!r}")
            mechanism = entry.get("mechanism")
            if not mechanism or mechanism not in classify.VOCAB:
                errors.append(f"{token!r} is group B but mechanism {mechanism!r} is not in "
                               f"the vocabulary {sorted(classify.VOCAB)}")
        elif group == "C":
            if not str(entry.get("reason") or "").strip():
                errors.append(f"{token!r} is group C but missing 'reason'")
        elif group == "none":
            for field in ("cost", "importance"):
                if not str(entry.get(field) or "").strip():
                    errors.append(f"{token!r} is group none but missing {field!r}")

    return errors


def compare_answers(alpha: list[dict], beta: list[dict], mapping: dict[str, str]) -> dict:
    """{"total": N, "agreements": int, "verdict": "PASS"|"FAIL",   # PASS iff total-agreements <= 3
        "disagreements": [{"token":…, "rule_id":…, "alpha_group":…, "beta_group":…,
                           "alpha_reason":…, "beta_reason":…}, …],
        "mechanism_conflicts": [same shape + both mechanism/target proposals]}
    Agreement is on `group` only. A mechanism difference on an agreed group goes to
    mechanism_conflicts for the Task 7 batch prose — never counted as disagreement, never
    silently dropped."""
    alpha_by = {e["token"]: e for e in alpha}
    beta_by = {e["token"]: e for e in beta}

    tokens = sorted(mapping)
    total = len(tokens)
    agreements = 0
    disagreements: list[dict] = []
    mechanism_conflicts: list[dict] = []

    for token in tokens:
        a = alpha_by.get(token, {})
        b = beta_by.get(token, {})
        rule_id = mapping[token]
        a_group, b_group = a.get("group"), b.get("group")
        if a_group == b_group:
            agreements += 1
            a_mech = a.get("mechanism")
            b_mech = b.get("mechanism")
            a_target = a.get("mechanism_target")
            b_target = b.get("mechanism_target")
            if a_group in ("A", "B") and (a_mech != b_mech or a_target != b_target):
                mechanism_conflicts.append({
                    "token": token, "rule_id": rule_id,
                    "alpha_group": a_group, "beta_group": b_group,
                    "alpha_mechanism": a_mech, "alpha_mechanism_target": a_target,
                    "beta_mechanism": b_mech, "beta_mechanism_target": b_target,
                })
        else:
            disagreements.append({
                "token": token, "rule_id": rule_id,
                "alpha_group": a_group, "beta_group": b_group,
                "alpha_reason": a.get("reason"), "beta_reason": b.get("reason"),
            })

    verdict = "PASS" if (total - agreements) <= 3 else "FAIL"
    return {
        "total": total,
        "agreements": agreements,
        "verdict": verdict,
        "disagreements": disagreements,
        "mechanism_conflicts": mechanism_conflicts,
    }
