# Duplication sweep over the CORPUS — all 159 rules, not the 19 implementation files.
#
# The owner asked whether the earlier sweep covered all 159. It did not: that one looked for
# duplicated DETECTORS in rule code (19 files). This asks the different question it exposed — are
# there duplicate or overlapping RULES in the corpus itself?
#
# Three signals, each printed for judgement by eye. None is a verdict on its own.
#   1. Same mechanism AND same mechanism_target — two rules aiming at the identical trigger.
#   2. High textual overlap between statements (shingled Jaccard) — two rules saying one thing.
#   3. Rules whose statements quote each other's id — a sign one supersedes or splits another.
import re
import sqlite3
import sys
from itertools import combinations

sys.stdout.reconfigure(encoding="utf-8")

db = sqlite3.connect("rules.sqlite")
db.row_factory = sqlite3.Row
rows = [dict(r) for r in db.execute("SELECT * FROM rule_revisions")]
print(f"corpus: {len(rows)} rules\n")

def norm(t):
    t = (t or "").lower()
    t = re.sub(r"`[^`]*`", " ", t)          # code spans carry ids/paths, not meaning
    t = re.sub(r"[^\w֐-׿]+", " ", t)
    return [w for w in t.split() if len(w) > 2]

def shingles(words, n=4):
    return {tuple(words[i:i + n]) for i in range(max(0, len(words) - n + 1))}

print("=== 1. rules sharing BOTH mechanism and mechanism_target ===\n")
by_target = {}
for r in rows:
    mech, tgt = (r.get("mechanism") or "").strip(), (r.get("mechanism_target") or "").strip()
    if not mech or not tgt:
        continue
    by_target.setdefault((mech, tgt.lower()), []).append(r["rule_id"])
n = 0
for (mech, tgt), ids in sorted(by_target.items()):
    if len(ids) > 1:
        n += 1
        print(f"  {mech}  ->  {tgt[:70]}")
        print(f"      {' '.join(sorted(ids))}")
print("  (none)" if n == 0 else f"\n  {n} shared-target group(s)")

print("\n=== 2. statement overlap above 0.30 (4-word shingles) ===\n")
prepared = []
for r in rows:
    w = norm(r.get("statement"))
    if len(w) >= 12:
        prepared.append((r["rule_id"], shingles(w), r.get("section")))
pairs = []
for (a, sa, seca), (b, sb, secb) in combinations(prepared, 2):
    if not sa or not sb:
        continue
    j = len(sa & sb) / len(sa | sb)
    if j >= 0.30:
        pairs.append((round(j, 2), a, b, seca, secb))
for j, a, b, seca, secb in sorted(pairs, reverse=True)[:25]:
    print(f"  {j:.2f}  {a:8} ({seca})   ~   {b:8} ({secb})")
print("  (none)" if not pairs else f"\n  {len(pairs)} pair(s) above threshold")

print("\n=== 3. rules whose statement names another rule id ===\n")
ids = {r["rule_id"] for r in rows}
refs = 0
for r in rows:
    st = r.get("statement") or ""
    named = {i for i in ids if i != r["rule_id"] and re.search(r"(?<![\w.])" + re.escape(i) + r"(?![\w.])", st)}
    # only report L-ids and section ids that look like deliberate cross-references
    named = {i for i in named if i.startswith("L") or "." in i}
    if named:
        refs += 1
        print(f"  {r['rule_id']:8} names: {' '.join(sorted(named))}")
print("  (none)" if refs == 0 else f"\n  {refs} rule(s) cross-reference another")
