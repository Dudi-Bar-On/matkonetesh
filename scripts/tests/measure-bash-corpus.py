# Round 2 of the Phase-3 measurement. Round 1 showed the hit counts; the SAMPLES showed that most
# hits are prose describing the rule, quoted inside an echo. So the real question is not "how often
# does the token appear" but "how often does it appear in COMMAND position".
#
# This strips quoted string literals and comments from each command, then re-measures. The gap
# between the two numbers is the false-alarm surface every Phase-3 rule has to survive, and it is
# the number the plan must be written against.
import io
import json
import pathlib
import re
import sys

TRANSCRIPTS = pathlib.Path.home() / ".claude" / "projects" / "C--Users-dudib-source-repos-matconetesh"

PATTERNS = {
    "L10":    re.compile(r"playwright\s+test\b[^\n]*--(workers|retries)\b"),
    "L18":    re.compile(r"\b(taskkill|kill)\b"),
    "L32":    re.compile(r"\|[^\n|]*\b(head|tail|grep)\b[^\n]*(;|&&)\s*\w*=?\$\?"),
    "L51a":   re.compile(r"\bwsl\b[^\n]*\bsudo\b"),
    "L55a":   re.compile(r"pip\s+install\b[^\n]*--no-deps"),
    "L73":    re.compile(r"(cat\s*>|>>\s*\S+\.(md|py|mjs|json)|sed\s+-i|tee\s)[\s\S]{0,4000}?git\s+commit"),
    "10.12a": re.compile(r"\bclaude\s+-p\b"),
    "L39":    re.compile(r"(echo|printenv|Write-Output)\s+[^\n]{0,30}\$(\w*(API_KEY|_KEY|TOKEN|SECRET)\w*)", re.I),
}

# Remove what a shell would treat as DATA rather than as a command to run:
#   - heredoc bodies      <<'EOF' ... EOF
#   - single/double quoted strings
#   - # comments to end of line
HEREDOC = re.compile(r"<<-?\s*'?\"?(\w+)'?\"?\n[\s\S]*?\n\1", re.M)
SQ = re.compile(r"'[^']*'")
DQ = re.compile(r'"[^"]*"')
COMMENT = re.compile(r"(^|\s)#[^\n]*")

def command_position_only(cmd):
    s = HEREDOC.sub(" ", cmd)
    s = SQ.sub(" ", s)
    s = DQ.sub(" ", s)
    s = COMMENT.sub(" ", s)
    return s

def commands():
    for f in sorted(TRANSCRIPTS.glob("*.jsonl")):
        try:
            fh = io.open(f, encoding="utf-8", errors="replace")
        except Exception:
            continue
        with fh:
            for line in fh:
                if '"Bash"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                content = (d.get("message") or {}).get("content")
                if not isinstance(content, list):
                    continue
                for b in content:
                    if (isinstance(b, dict) and b.get("type") == "tool_use"
                            and b.get("name") == "Bash"):
                        c = (b.get("input") or {}).get("command")
                        if isinstance(c, str):
                            yield c

# --dump <out.jsonl>: write every real Bash command as one JSON line, for the Phase-3 replay
# harness (scripts/tests/replay-bash-corpus.mjs). Same extractor, zero duplication.
if len(sys.argv) == 3 and sys.argv[1] == "--dump":
    out_path = pathlib.Path(sys.argv[2])
    n = 0
    with out_path.open("w", encoding="utf-8") as fh:
        for cmd in commands():
            fh.write(json.dumps({"command": cmd}) + "\n")
            n += 1
    print(f"dumped {n} commands to {out_path}")
    sys.exit(0)

total = 0
raw = {k: 0 for k in PATTERNS}
stripped = {k: 0 for k in PATTERNS}
survivors = {k: [] for k in PATTERNS}

for cmd in commands():
    total += 1
    clean = command_position_only(cmd)
    for rid, pat in PATTERNS.items():
        if pat.search(cmd):
            raw[rid] += 1
        m = pat.search(clean)
        if m:
            stripped[rid] += 1
            if len(survivors[rid]) < 4:
                s = clean[max(0, m.start() - 25): m.end() + 35]
                survivors[rid].append(" ".join(s.split())[:100])

print(f"corpus: {total} real Bash commands\n")
print(f"{'rule':8} {'raw':>6} {'in-cmd':>7} {'noise':>7}   what the stripping removed")
for rid in PATTERNS:
    r, s = raw[rid], stripped[rid]
    noise = (r - s) / r * 100 if r else 0.0
    print(f"{rid:8} {r:6} {s:7} {noise:6.0f}%   prose/quoted mentions that are not commands")
print()
for rid in PATTERNS:
    if survivors[rid]:
        print(f"--- {rid}: what survives stripping (these are the real candidates) ---")
        for s in survivors[rid]:
            print("   ", re.sub(r"(KEY|TOKEN|SECRET)\w*", r"\1<redacted>", s, flags=re.I))
        print()
