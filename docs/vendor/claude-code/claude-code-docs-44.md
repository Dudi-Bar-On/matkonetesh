---
name: claude-code-docs-44
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 44/66 (code.claude.com)"
type: reference
---

| Respond to MCP input requests programmatically                              |
| `ElicitationResult`                                    | No         | Yes            | A user responds to an MCP elicitation                                                                                                   | Modify or block the response before it returns to the server                |
| `ConfigChange`                                         | No         | Yes            | Configuration file changes                                                                                                              | Reload settings dynamically                                                 |
| `InstructionsLoaded`                                   | No         | Yes            | A `CLAUDE.md` or rules file is loaded into context                                                                                      | Audit which instruction files load                                          |
| `WorktreeCreate`                                       | No         | Yes            | Git worktree created                                                                                                                    | Track isolated workspaces                                                   |
| `WorktreeRemove`                                       | No         | Yes            | Git worktree removed                                                                                                                    | Clean up workspace resources                                                |
| `CwdChanged`                                           | No         | Yes            | The working directory changes during a session                                                                                          | Reload environment variables per directory                                  |
| `FileChanged`                                          | No         | Yes            | A watched file is modified, created, or deleted                                                                                         | Reload configuration when project files change                              |
| `DirectoryAdded`                                       | No         | Yes            | A working directory is added during a session                                                                                           | Install dependencies for a repository added mid-session                     |
