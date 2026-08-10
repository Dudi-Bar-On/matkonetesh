# Measures the false-alarm surface for Phase 4's eight `stop` rules against a REAL corpus: every
# assistant FINAL message actually sent in this project's sessions.
#
# Why this runs before the plan: Phase 3 was planned against 6,338 measured Bash commands and that
# measurement overturned the design twice (a naive L18 pattern fired on "botulism kill-temps"; L51a's
# signal lived inside quotes). Phase 2 was planned on my expectations and two rules had to be
# rewritten after the fact. So: measure first.
#
# The stop point is different from Bash in a way that matters. A Bash rule reads a COMMAND — bounded,
# machine-shaped text. A stop rule reads MY PROSE TO THE OWNER, which is unbounded, bilingual, and —
# because the subject of this whole arc is rules — full of sentences that look like the very claims
# the rules police. `verify-before-success-claim` already fired on a message of mine that contained
# no claim at all, only a quotation of an instruction (R-133). Expect that to be the dominant noise.
#
# Prints COUNTS and short excerpts only.
import io
import json
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

TRANSCRIPTS = pathlib.Path.home() / ".claude" / "projects" / "C--Users-dudib-source-repos-matconetesh"

CANDIDATES = {
    # DoD-3 / rule 1 — a success claim with no pasted evidence.
    "DoD-3_claim": (re.compile(r"(passed|green|works|fixed|done|complete|verified|נחת|עובד|תוקן|ירוק)", re.I),
                    "any success-ish word"),
    "DoD-3_evidence": (re.compile(r"```|\bexit(?:ed)?\s*(?:code)?\s*[:=]?\s*0\b|\b\d+\s+passed\b|PASS\b"),
                       "pasted evidence present"),
    # L23a — a percentage in a final report with no named artifact.
    "L23a_pct": (re.compile(r"\b\d{1,3}(?:\.\d+)?\s*%|\b\d{1,3}\s*(?:אחוז)\b"), "a percentage appears"),
    "L23a_artifact": (re.compile(r"\.png\b|screenshot|צילום|\.json\b|\.txt\b"), "a named artifact appears"),
    # L64a — a landed/committed claim naming a document.
    "L64a_landed": (re.compile(r"(landed|committed|נחת|הופקד)[^\n]{0,60}(\.md|\.py|\.mjs|\.json)"),
                    "a landed claim over a named file"),
    # L63a — a repo path cited as justification.
    "L63a_path": (re.compile(r"\b(?:docs|scripts|src|tests)/[\w./-]+\.(?:md|py|mjs|json|ts)\b"),
                  "a repo path cited"),
    # 10.6 / H9 — the three-part summary and the five-row table.
    "10.6_three_parts": (re.compile(r"DONE|NEXT|LEFT UNTIL|מה נעשה|הבא בתור"), "three-part shape"),
    "H9_table": (re.compile(r"^\|.*\|.*\|\s*$", re.M), "a markdown table"),
}

def final_messages():
    for f in sorted(TRANSCRIPTS.glob("*.jsonl")):
        try:
            fh = io.open(f, encoding="utf-8", errors="replace")
        except Exception:
            continue
        with fh:
            for line in fh:
                if '"assistant"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                msg = d.get("message") or {}
                if msg.get("role") != "assistant":
                    continue
                content = msg.get("content")
                if not isinstance(content, list):
                    continue
                # A FINAL message is one with text and no tool_use block — the shape a stop hook sees.
                if any(isinstance(b, dict) and b.get("type") == "tool_use" for b in content):
                    continue
                text = "".join(b.get("text", "") for b in content
                               if isinstance(b, dict) and b.get("type") == "text")
                if text.strip():
                    yield text

msgs = list(final_messages())
print(f"corpus: {len(msgs)} assistant final messages\n")
if not msgs:
    print("EXAMINED NOTHING — the extractor is broken, not the corpus")
    raise SystemExit(1)

if "--dump" in sys.argv:
    out_path = pathlib.Path(sys.argv[sys.argv.index("--dump") + 1])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with io.open(out_path, "w", encoding="utf-8") as fh:
        for t in msgs:
            fh.write(json.dumps({"text": t}, ensure_ascii=False) + "\n")
    print(f"dumped {len(msgs)} messages to {out_path}")
    raise SystemExit(0)

hits = {k: 0 for k in CANDIDATES}
for t in msgs:
    for k, (pat, _) in CANDIDATES.items():
        if pat.search(t):
            hits[k] += 1

print(f"{'signal':18} {'msgs':>6} {'rate':>7}  meaning")
for k, (_, what) in CANDIDATES.items():
    print(f"{k:18} {hits[k]:6} {hits[k]/len(msgs)*100:6.1f}%  {what}")

# The number that decides DoD-3's shape: a claim WITHOUT evidence in the same message.
claim = CANDIDATES["DoD-3_claim"][0]
ev = CANDIDATES["DoD-3_evidence"][0]
naive = sum(1 for t in msgs if claim.search(t) and not ev.search(t))
print(f"\nDoD-3, naive reading: {naive} of {len(msgs)} messages ({naive/len(msgs)*100:.0f}%) would BLOCK.")
print("  A rule that blocks that share of ordinary replies is not a gate, it is a muzzle —")
print("  which is why the shipped verify-before-success-claim narrows to specific claim shapes.")

pct = CANDIDATES["L23a_pct"][0]
art = CANDIDATES["L23a_artifact"][0]
n = sum(1 for t in msgs if pct.search(t) and not art.search(t))
print(f"\nL23a, naive reading: {n} of {len(msgs)} ({n/len(msgs)*100:.0f}%) carry a percentage with no named artifact.")
