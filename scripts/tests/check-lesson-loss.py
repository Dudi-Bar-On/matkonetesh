# Did trimming H15 (72,830 -> 702 chars) and retiring `11` lose any lesson?
#
# The owner asked before I thought to. Both containers held lesson entries; the whole justification
# for trimming was "every one of those is already extracted separately". That was an ASSERTION, and
# it is exactly the kind this project has been burned by. This checks it against the data.
#
# Three comparisons, all mechanical:
#   1. Every lesson id inside the OLD H15 body must exist as its own rule in the NEW store.
#   2. Every lesson id inside the OLD `11` body must too.
#   3. Every lesson id present anywhere in the SOURCE DOCUMENT must exist as its own rule — the
#      widest check, and the one that would catch a lesson neither container nor extractor saw.
import pathlib
import re
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

OLD = sys.argv[1]
NEW = "rules.sqlite"
DOC = pathlib.Path("docs/process/development-discipline.md")

MARKER = re.compile(r"\*\*(L\d+[ab]?)\s*·", re.MULTILINE)
TABLE_ROW = re.compile(r"^\|\s*\*{0,2}(L\d+[ab]?)\*{0,2}\s*\|", re.MULTILINE)

def ids_in(text):
    return set(MARKER.findall(text)) | set(TABLE_ROW.findall(text))

old = sqlite3.connect(OLD); old.row_factory = sqlite3.Row
new = sqlite3.connect(NEW); new.row_factory = sqlite3.Row

new_ids = {r[0] for r in new.execute("SELECT rule_id FROM rule_revisions")}
new_lessons = {i for i in new_ids if re.fullmatch(r"L\d+[ab]?", i)}
print(f"lessons in the store now: {len(new_lessons)}\n")

for container in ("H15", "11"):
    row = old.execute("SELECT statement FROM rule_revisions WHERE rule_id=?", (container,)).fetchone()
    if not row:
        print(f"{container}: not in the old mirror — nothing to compare")
        continue
    held = ids_in(row["statement"] or "")
    missing = sorted(held - new_ids)
    print(f"{container}: held {len(held)} lesson id(s); missing from the store now: "
          f"{missing if missing else 'NONE'}")

doc = DOC.read_text(encoding="utf-8")
in_doc = ids_in(doc)
missing_doc = sorted(in_doc - new_ids)
print(f"\nlesson ids present in the SOURCE DOCUMENT: {len(in_doc)}")
print(f"of those, missing from the store: {missing_doc if missing_doc else 'NONE'}")

# And the reverse direction — a rule in the store whose id no longer appears in the document would
# be a stale record, the opposite failure and equally worth knowing about.
orphaned = sorted(new_lessons - in_doc)
print(f"lessons in the store with no marker in the document: {orphaned if orphaned else 'NONE'}")

# Finally: did any lesson's TEXT shrink? A lesson that survives as an id but lost its body is the
# quiet version of the same loss.
shrunk = []
for r in old.execute("SELECT rule_id, length(statement) n FROM rule_revisions"):
    if not re.fullmatch(r"L\d+[ab]?", r["rule_id"]):
        continue
    n2 = new.execute("SELECT length(statement) FROM rule_revisions WHERE rule_id=?", (r["rule_id"],)).fetchone()
    if n2 and n2[0] < r["n"]:
        shrunk.append((r["rule_id"], r["n"], n2[0]))
print(f"lessons whose statement got SHORTER: {shrunk if shrunk else 'NONE'}")
