---
name: claude-code-docs-01
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 01/66 (code.claude.com)"
type: reference
---

<!-- source: https://code.claude.com/docs/en/accessibility.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Use Claude Code with a screen reader

> Set up Claude Code for screen readers such as VoiceOver and NVDA, plus settings for screen magnifiers, reduced motion, and colorblind-friendly themes.

Claude Code has a screen reader mode that replaces its visual terminal interface with plain, linear text. Instead of boxes, progress animations, and in-place redraws, the mode prints labeled lines that a screen reader such as VoiceOver or NVDA reads in order, so you can hold a full conversation, approve tool permissions, and review output end to end.

Screen reader mode is opt-in. If you use a screen magnifier, reduced motion, or a colorblind-friendly theme instead of a screen reader, see [Accessibility settings beyond screen reader mode](#accessibility-settings-beyond-screen-reader-mode).

<Note>
  Screen reader mode requires Claude Code v2.1.181 or later. Earlier versions reject the `--ax-screen-reader` flag with `error: unknown option '--ax-screen-reader'`.
</Note>

## Turn on screen reader mode

Pick the method that matches how often you use a screen reader:

* For one session: run `claude --ax-screen-reader`.
* For sessions started from one shell: set the `CLAUDE_AX_SCREEN_READER` environment variable to `1`. In Bash or Zsh, run `export CLAUDE_AX_SCREEN_READER=1`; in PowerShell, run `$env:CLAUDE_AX_SCREEN_READER = "1"`. Add the line to your shell profile to cover every shell.
* For every session on the machine: add `"axScreenReader": true` to your user [settings file](/docs/en/settings). This covers any terminal, including the VS Code integrated terminal.

<Note>
  The methods are listed in precedence order: the [`--ax-screen-reader`](/docs/en/cli-reference#cli-flags) flag overrides the [`CLAUDE_AX_SCREEN_READER`](/docs/en/env-vars) environment variable, which overrides the [`axScreenReader`](/docs/en/settings#available-settings) setting.
</Note>

If you use Claude Code over SSH, set the environment variable or setting on the remote machine where Claude Code runs.

When the mode is on, the first thing Claude Code prints is a confirmation line naming the method that turned it on: `[Screen Reader Mode: on via flag]`, `[Screen Reader Mode: on via env]`, or `[Screen Reader Mode: on via settings]`. The method-naming format requires Claude Code v2.1.206 or later. When Claude Code relaunches itself, for example to finish installing an update, the new process inherits the mode through the `CLAUDE_AX_SCREEN_READER` environment variable, so its confirmation line reads `[Screen Reader Mode: on via env]` regardless of which method you used.
{/* max-version: 2.1.205 */}Earlier versions print `[Accessible screen reader mode: on]`.

After printing the confirmation line, Claude Code holds the rest of the interface back for three seconds so your screen reader can finish speaking the line, then renders the first prompt. Press any key to end the hold early. To change the hold's length, set the `CLAUDE_AX_STARTUP_QUIET_MS` environment variable to a number of milliseconds. The default is `3000`; set it to `0` to skip the hold. Claude Code caps the hold at `600000` milliseconds, 10 minutes. Requires Claude Code v2.1.217 or later.

## Turn off screen reader mode

Reverse whichever method turned the mode on: start without the flag, unset the environment variable, or set `axScreenReader` to `false`. Setting `CLAUDE_AX_SCREEN_READER=0` keeps the mode off even when the setting is `true`.

## What your screen reader hears

In screen reader mode, Claude Code writes flat text:

* no box-drawing characters for the interface chrome
* no color-only cues
* no redraws of content that hasn't changed; progress spinners render as static text
* tables in Claude's replies read as `Header: value` sentences instead of a box-character grid. {/* min-version: 2.1.198 */}Requires Claude Code v2.1.198 or later; earlier versions draw tables as grids even in screen reader mode.

Output accumulates in your terminal's scrollback, so you can re-read earlier turns with your screen reader's review commands or your terminal's search.

Screen reader mode renders as plain scrolling text, even if you've turned on [fullscreen rendering](/docs/en/fullscreen) with the [`tui` setting](/docs/en/settings#available-settings); the setting has no effect while the mode is active. Attached background sessions still render fullscreen; see [Known limitations](#known-limitations).

Each message in the transcript starts with a label your screen reader announces, naming what it is: your messages, Claude's replies, tool activity, errors, and prompts. The labels are also searchable, so you can jump between sections of the transcript by searching your terminal's scrollback:

| Label                  | Meaning                                                                                   |
| :--------------------- | :---------------------------------------------------------------------------------------- |
| `you:`                 | Your messages                                                                             |
| `claude:`              | Claude's replies                                                                          |
| `tool:`                | Tool activity, such as a file edit or a command run                                       |
| `tool error:`          | A tool that failed                                                                        |
| `error:`               | An error in the conversation, such as a failed API request                                |
| `Permission Required:` | A permission prompt waiting for your answer                                               |
| `Cost:`                | The session cost summary when Claude Code exits, if your account [shows costs](/docs/en/costs) |

The terminal cursor follows the input caret, so a screen reader's read-current-line command answers "where am I" with the prompt you're editing.

{/* min-version: 2.1.219 */}As you type at the end of the input line, Claude Code writes only the characters you type, so your screen reader echoes only those characters. Requires Claude Code v2.1.219 or later; earlier versions rewrite the whole input line on every keystroke, so the screen reader re-reads it as you type.

{/* min-version: 2.1.218 */}When you delete a word or a line in the input, Claude Code announces the deleted text. Requires Claude Code v2.1.218 or later. The announcement covers:

* Deleting a word with `Ctrl+W`, `Option+Delete` on macOS, or `Ctrl+Backspace` on Windows
* Deleting to the start of the line with `Ctrl+U` or `Cmd+Backspace`
* Deleting to the end of the line with `Ctrl+K`

See the [text editing shortcuts](/docs/en/interactive-mode#text-editing) for what each key does.

{/* min-version: 2.1.210 */}Cycling [permission modes](/docs/en/permission-modes) with `Shift+Tab` announces the mode you land on, such as `[plan mode on]` or `[accept edits on]`. Claude Code prints the announcement once and doesn't repeat it on later redraws. Requires Claude Code v2.1.210 or later.
