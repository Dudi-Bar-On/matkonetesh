---
name: claude-code-docs-02
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 02/66 (code.claude.com)"
type: reference
---

### Jump between turns

Claude Code emits OSC 133 shell-integration markers at turn boundaries, so your terminal's jump-to-previous-prompt key moves between turns without reading through the whole transcript:

* iTerm2: Cmd+Shift+Up
* VS Code terminal: Ctrl+Up on Windows, Cmd+Up on macOS
* Windows Terminal: no key by default; bind the `scrollToMark` action in its settings
* Kitty and Ghostty: check the terminal's documentation for its jump-to-prompt key

macOS Terminal doesn't act on the markers, and Claude Code doesn't emit them in WezTerm. In those terminals, search the scrollback for the `you:` label instead.

## Answer menus and prompts

In screen reader mode, menus you'd normally navigate with the arrow keys, including permission prompts, become numbered lists. Each option is announced as a numbered line, followed by an `Enter selection` prompt that names the valid range. Type the number of the option you want and press Enter.

* To cancel a dismissible menu: press Escape. Its prompt ends with `or Escape to cancel`.
* If you type a number that isn't on the list: Claude Code announces the valid range and lets you try again.

Yes-or-no prompts ask for a typed answer instead of a two-option menu. Answer `y` or `n` and press Enter. `yes` and `no` also work.

## Hear when Claude Code needs you

In screen reader mode, Claude Code rings the terminal bell when it needs your attention, so you don't have to keep checking the transcript. The bell rings when:

* Claude finishes a reply
* a permission prompt appears
* a tool that ran longer than 5 seconds finishes

The bell is your terminal's standard alert. To silence it, change the bell setting in your terminal application. The bell doesn't require screen reader mode: outside the mode, set [`preferredNotifChannel`](/docs/en/settings#available-settings) to `"terminal_bell"` for similar alerts when Claude is waiting on you. See [Get a terminal bell or notification](/docs/en/terminal-config#get-a-terminal-bell-or-notification).

## Accessibility settings beyond screen reader mode

These options address accessibility needs outside of screen reader mode. All of them work alongside it.

* The `CLAUDE_CODE_ACCESSIBILITY` [environment variable](/docs/en/env-vars) is for screen magnifiers. Set `CLAUDE_CODE_ACCESSIBILITY=1` to keep the native terminal cursor visible so that magnifiers, such as macOS Zoom, can track the cursor position. The cursor follows keyboard focus: the input caret while you type, and the highlighted row as you move through menus and panels, such as `/config` and `/plugin`, with the arrow keys. {/* min-version: 2.1.218 */}Row tracking in menus and panels requires Claude Code v2.1.218 or later.
* The `prefersReducedMotion` [setting](/docs/en/settings#available-settings) reduces or disables spinners, shimmer, and other animations without changing the rest of the interface.
* The `theme` [setting](/docs/en/settings#available-settings) selects the interface colors, including the colorblind-friendly `dark-daltonized` and `light-daltonized` themes.

## Known limitations

Some behaviors aren't adapted for screen reader mode:

* Screen reader mode doesn't turn on automatically when a screen reader is running.
* Claude Code doesn't announce a permission mode change made in any way other than cycling with `Shift+Tab`, such as entering [plan mode](/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode) from a command.
* Attaching to a [background session](/docs/en/agent-view) with `claude attach` or from agent view enters the terminal's alternate screen, which has no native scrollback. This is the [same behavior as other attached sessions](/docs/en/fullscreen). To get back out, press Left Arrow on an empty prompt, or Ctrl+Z if a dialog has focus.
* Claude Code announces costs in the summary it prints at exit, not per turn.
* Screen reader mode doesn't change [non-interactive mode](/docs/en/headless) with the `-p` flag. Non-interactive mode already writes plain text and remains an alternative for scripting.

## Report an issue

If something doesn't work with your screen reader, magnifier, or terminal, open an issue on the [Claude Code issue tracker](https://github.com/anthropics/claude-code/issues) and mention your assistive technology in the title. Include your operating system, terminal application, and assistive technology name and version in the report.

## Related resources

These pages hold the full reference entries and related setup for what this page covers:

* [Settings](/docs/en/settings#available-settings): the `axScreenReader`, `prefersReducedMotion`, `theme`, and `preferredNotifChannel` entries
* [Environment variables](/docs/en/env-vars): the `CLAUDE_AX_SCREEN_READER` and `CLAUDE_CODE_ACCESSIBILITY` entries
* [CLI reference](/docs/en/cli-reference#cli-flags): the `--ax-screen-reader` flag
* [Terminal configuration](/docs/en/terminal-config): bells, notifications, and themes outside screen reader mode
* [Non-interactive mode](/docs/en/headless): scripted `claude -p` runs, which write plain text without screen reader mode


<!-- source: https://code.claude.com/docs/en/admin-setup.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.
