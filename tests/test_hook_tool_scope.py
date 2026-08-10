# tests/test_hook_tool_scope.py — R-120.
#
# Every rule declares `export const TOOLS`, and the pipeline reads that from the file TEXT so it can
# skip importing a rule that cannot possibly object to the current tool. That is the only lever that
# stops per-call cost from growing with the TOTAL rule count: measured 2026-08-10, a PreToolUse call
# cost 85ms worst case, of which 37ms is node startup (unremovable while a hook is a process), 18ms
# is importing all 19 rules and 12ms is running them. With 52 rules still to land, loading all of
# them on every call would add roughly another 100ms to every tool call in the session.
#
# The optimisation is only safe if the declarations are HONEST. A rule that quietly handles a tool
# it did not declare would simply stop running — silently, with every test still green, which is the
# inert-rule failure this project has already shipped once (Phase 4 Task 9: a stop rule that never
# loaded while 333 tests passed). So this file does not trust the declarations: it drives every rule
# with every tool it did NOT declare and requires `allow`.
import json
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "scripts" / "hooks" / "rules"

# Every tool name the pipeline is wired for, from .claude/settings.json's PreToolUse matcher.
ALL_TOOLS = ["Bash", "Grep", "WebSearch", "Agent", "browser_navigate", "Edit", "Write"]

TOOLS_RE = re.compile(r"export\s+const\s+TOOLS\s*=\s*\[([^\]]*)\]")


def declared_tools(path):
    m = TOOLS_RE.search(path.read_text(encoding="utf-8"))
    assert m, f"{path.name} declares no TOOLS — the pipeline would fall back to importing it always"
    return [t.strip().strip("'\"") for t in m.group(1).split(",") if t.strip()]


def rule_files():
    files = sorted(RULES.glob("*.mjs"))
    assert files, "no rule files found — this test examined NOTHING"
    return files


def _evaluate(path, tool):
    """Runs the rule's own evaluate() through node with a minimal payload for `tool`."""
    src = f"""
    import {{ evaluate }} from {json.dumps(path.as_uri())};
    const input = {{ session_id: 's-scope', hook_event_name: 'PreToolUse', tool_name: {json.dumps(tool)},
                     cwd: {json.dumps(ROOT.as_posix())},
                     tool_input: {{ file_path: {json.dumps((ROOT / 'app.js').as_posix())},
                                    old_string: 'a', new_string: 'b', content: 'x',
                                    command: 'echo hi', pattern: 'x', query: 'x',
                                    prompt: 'x', url: 'http://localhost:8123/' }} }};
    const out = await evaluate(input);
    console.log(JSON.stringify(out && out.decision ? out.decision : 'allow'));
    """
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, f"{path.name} threw for tool {tool}:\n{r.stderr}"
    return json.loads(r.stdout.strip())


@pytest.mark.parametrize("path", rule_files(), ids=lambda p: p.name)
def test_a_rule_never_objects_to_a_tool_it_did_not_declare(path):
    declared = declared_tools(path)
    for tool in ALL_TOOLS:
        if tool in declared:
            continue
        decision = _evaluate(path, tool)
        assert decision == "allow", (
            f"{path.name} returned {decision!r} for tool {tool!r}, which it does not declare in "
            f"TOOLS. The pipeline skips importing it for that tool, so this rule would be SILENTLY "
            f"INERT there. Add {tool!r} to its TOOLS, or stop handling it.")


def test_every_declared_tool_is_one_the_pipeline_is_actually_wired_for():
    """A typo in TOOLS ('Wrtie') would silently disable a rule for its real tool. Nothing else
    catches that: the rule still imports, still exports, still passes its own tests."""
    settings = json.loads((ROOT / ".claude" / "settings.json").read_text(encoding="utf-8"))
    matchers = set()
    for group in settings["hooks"].get("PreToolUse", []):
        for part in (group.get("matcher") or "").split("|"):
            if part:
                matchers.add(part)
    assert matchers, "could not read the PreToolUse matcher — this test examined NOTHING"
    unknown = {}
    for path in rule_files():
        bad = [t for t in declared_tools(path) if t not in matchers]
        if bad:
            unknown[path.name] = bad
    assert not unknown, (
        f"rule(s) declare a tool the PreToolUse matcher never routes: {unknown}. "
        f"Wired matchers: {sorted(matchers)}")
