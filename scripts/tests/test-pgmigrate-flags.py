# scripts/tests/test-pgmigrate-flags.py
"""RED: pgmigrate.py's discover() is hardcoded to infra/postgres/migrations today. A --migrations-dir
flag must let it point elsewhere without touching its default behaviour."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def test_migrations_dir_flag_is_recognised():
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "pgmigrate.py"), "--help"],
        capture_output=True, text=True,
    )
    assert "--migrations-dir" in r.stdout, f"--migrations-dir not in help output:\n{r.stdout}"
    assert "--env-file" in r.stdout, f"--env-file not in help output:\n{r.stdout}"


if __name__ == "__main__":
    test_migrations_dir_flag_is_recognised()
    print("PASS")
