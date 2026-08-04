---
name: superpowers-docs-20
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 20/33 (README.md)"
type: reference
---

### Step 6 — Add tests

Match the existing per-harness test style:

- **Shape A:** assert the hook's stdout has the exact JSON shape your harness
  consumes, and that it contains the bootstrap. See `tests/hooks/test-session-start.sh`,
  which validates each harness's output shape.
- **Shape B:** a unit test that fakes the harness's plugin API and asserts the
  lifecycle handlers register, the bootstrap injects once, the dedup guard
  works, and (if relevant) compaction re-injection works. See
  `tests/pi/test-pi-extension.mjs`. Add an isolated-install integration check in
  the style of `tests/opencode/`.
- If the bootstrap is cached, test that the cache behaves when the file is
  missing (see the OpenCode caching tests).

These automated tests cover the wiring; the live tmux run in Step 7 is what
proves the integration actually triggers skills.

### Step 7 — Install locally, then drive a live instance to verify

You cannot confirm a port works by reading code. You have to run the harness with
your in-progress port loaded and watch a real session — which is also how you
produce the transcript the PR requires.

**Install locally.** Point a *local* instance of the harness at your working
tree, not a published build:

- **Shape A / C:** install the plugin/extension from this repo's local path (or
  symlink its directory into wherever the harness looks). Find the harness's
  "install from a local directory / git checkout" path in its docs.
- **Shape B:** register the local module — e.g. an `opencode.json` `plugin`
  entry pointing at the local path, or pi resolving the `package.json` fields
  from the repo.

Reinstall after each change and restart the harness, since the bootstrap loads at
startup.

**Drive it with tmux.** Most harnesses are interactive REPLs/TUIs that can't be
driven by piping stdin, so run the harness inside a detached tmux session and
control it with `send-keys` / `capture-pane`. A harness may advertise a
non-interactive "run one prompt" mode (e.g. `opencode run "..."`) — try it for the
quick smoke check, but **don't depend on it**: these modes are frequently flaky,
auth-gated, or trust-gated (one real harness's `--print` mode hung and timed out
with no output every time). Be ready to do *everything*, including the smoke
check, through tmux.

**Clear the gates first, or tmux stalls silently.** Many harnesses block on
first-run onboarding, a "do you trust this folder?" prompt, a sandbox mode, or a
permission gate — and a detached tmux session will just sit there with no error
while it waits. Before the run, pre-trust your scratch directory (in the harness's
settings/config) or be prepared to answer those prompts via `send-keys`, and
account for the harness's startup time in your first `sleep`.

```bash
# 1. Launch the harness detached, in a throwaway project dir
mkdir -p /tmp/port-smoke
tmux new-session -d -s port-test -c /tmp/port-smoke '<harness-launch-command>'

# 2. Let it initialize — real TUIs take longer than you think (10s+ with a model
#    handshake); tune this. THEN capture and clear any blocking modal before you
#    type a prompt: first-run onboarding and "trust this folder?" are modal, so
#    keystrokes sent during them select menu items instead of typing your prompt.
sleep 12
tmux capture-pane -t port-test -p          # onboarding / trust prompt? answer it via send-keys first
# (e.g. tmux send-keys -t port-test Enter   # to accept a trust prompt — inspect before assuming)

# 3. Smoke check: does the model know it has superpowers?
#    Send the text and Enter as SEPARATE send-keys with a beat between them —
#    sending them together races on some TUIs (Enter arrives before the text lands).
tmux send-keys -t port-test 'What are your superpowers?'; sleep 0.4; tmux send-keys -t port-test Enter
sleep 5
tmux capture-pane -t port-test -p          # reply should show it knows its skills

# 4. Acceptance test: exact prompt (note the escaped apostrophe), fresh session
tmux send-keys -t port-test 'Let'\''s make a react todo list'; sleep 0.4; tmux send-keys -t port-test Enter
# poll until the turn finishes — re-capture every few seconds, don't capture once
sleep 8
tmux capture-pane -t port-test -p          # PASS = brainstorming triggers BEFORE any code

# 5. Save the transcript for the PR, then clean up
tmux capture-pane -t port-test -p > /tmp/port-smoke/transcript.txt
tmux kill-session -t port-test
```

tmux gotchas that bite here: wait after launch before the first capture; send the
prompt text and `Enter` as *separate* `send-keys` calls with a short `sleep`
between them (sending them together races on some TUIs), and `Enter` is a key name
not `\n`; the agent's turn takes time, so **poll `capture-pane` in a loop** rather
than capturing once; `capture-pane` shows only the visible pane, so for a long
conversation use the harness's own transcript/log file as the record of truth;
always `kill-session` when done.

If the smoke check shows the model *doesn't* know it has superpowers, the
bootstrap isn't loading — fix that before bothering with the acceptance test.

---
