---
name: bmad-docs-02
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 02/30 (raw.githubusercontent.com)"
type: reference
---

## Continue in a Mature Codebase

[Getting Deeper](./tutorials/getting-deeper.md) moves the same direct workflow
into Django 5.2.4. You ask Build to add JSON output to `django-admin
diffsettings`, make the decisions that define that output, run the focused
tests, and inspect the JSON produced by the command.

The second Django exercise shows what changes when the work spans several
stories. BMad Spec records one shared contract for filtering, redaction, and CI
status. Three Build runs implement it in order, and one final command shows the
features working together: filtering selects the setting, redaction hides its
value, and the exit status still reports the remaining difference.

**[Try the Django playground](./tutorials/getting-deeper.md)**

## Find a Specific Answer

Use the search box or sidebar when you already know what you need. These common
tasks lead directly to the relevant documentation:

- [Install or update BMad](./how-to/install-bmad.md)
- [Use BMad in an established project](./how-to/established-projects.md)
- [Understand how Build works](./explanation/build.md)
- [Look up installed skills](./reference/commands.md)

## Build in Your Repository

Choose a real change in a repository you already use. Install BMad in that
repository, run the installed `bmad-build` skill, and describe the result you
want. You can settle the important choices, approve or revise the plan, and
inspect the finished change in its real context.

**[Use BMad in your repository](./how-to/install-bmad.md)**


<!-- source: docs/tutorials/getting-started.md -->

---
title: 'Getting Started'
description: Install BMad and build a small Python program
sidebar:
  order: 1
---

BMad can help you plan and build anything from a small bug fix to a project with
a million lines of code. Let's start with something small.

Already have a repository and a small change you want to make?
[Install BMad there](../how-to/install-bmad.md), open your coding tool in the
repository, and run the installed `bmad-build` skill. Talk to it about the
change you want, and it will make it happen.

Otherwise, start here. You will make a working Python program in an empty
project.

:::note[Before You Start]
Use a macOS or Linux shell with Node.js 20.12+, Python 3, and a coding tool
supported by BMad. The exact install and launch commands below are for Claude
Code. If you use another supported tool, select it when installing BMad and run
the `bmad-build` skill there instead.
:::

## Create an Empty Project

```bash
mkdir bmad-first-project
cd bmad-first-project
```

Install the current stable version of BMad Method. This command sets it up for
Claude Code:

```bash
npx bmad-method install --directory . --modules bmm --tools claude-code --yes
```

Open your coding tool in this directory. For Claude Code, run:

```bash
claude
```

## Build a Mars Rover

Ask the `bmad-build` skill to make the
[Mars Rover programming kata](https://codingdojo.org/kata/mars-rover/), a small
exercise used to practice coding, without adding any design choices:

```text
/bmad-build write an implementation of mars rover kata
```

This gives the `bmad-build` skill room to ask what you want. It may start with a
question like this:

```text
`bmad-build`: Before implementation, I need one choice: which language should I use?
You: Python 3. Make it a small old-school terminal program I can run locally,
with no dependencies beyond Python standard library.
```

Your questions, answers, plan, and finished program may differ. Choose the
behavior you want rather than copying the example answer.

After you answer its questions, read its plan. Approve it or ask for changes.
The skill then writes the program, checks its work, fixes any problems, and
shows you what changed.

## Run the Mars Rover

Depending on what you told it, the result may look something like this:

```bash
python3 mars_rover.py --size 5x5 --obstacle 2,2
```

Enter `FFRFF`, then `MAP`, then `QUIT`. The terminal shows the rover stopping
before the obstacle:

```text
MARS ROVER CONTROL
Commands: F/M forward, B backward, L/R turn, MAP, STATUS, HELP, QUIT
Position: (0, 0)  Heading: N
rover> Position: (1, 2)  Heading: E
OBSTACLE: movement blocked at (2, 2)
rover>  4  . . . . .
 3  . . . . .
 2  . > # . .
 1  . . . . .
 0  . . . . .
    0 1 2 3 4
rover> Mission control signing off.
```

Open the files listed in the final message to look at your finished program.

## Ask BMad Help

The `bmad-help` skill answers questions about BMad. Use it to understand what
happened, decide what to do next, or solve a problem. Try it now:

```text
/bmad-help Explain what bmad-build just did.
```

## You Built It

Mars Rover showed how the `bmad-build` skill turns a short request into working
software. It clarified the request, presented a plan for your approval, wrote
the program, and checked its work before showing you the result.

## Keep Building

1. [Install BMad in your own repository](../how-to/install-bmad.md), then run
   the `bmad-build` skill with a short description of a small change.
2. Continue to [Getting Deeper](./getting-deeper.md) for a small change in a
   mature codebase, followed by a larger change using a written spec.


<!-- source: docs/404.md -->

---
title: Page Not Found
template: splash
---


The page you're looking for doesn't exist or has been moved.

[Return to Home](./index.md)


<!-- source: docs/_STYLE_GUIDE.md -->

---
title: "Documentation Style Guide"
description: Project-specific documentation conventions based on Google style and Diataxis structure
---

This project adheres to the [Google Developer Documentation Style Guide](https://developers.google.com/style) and uses [Diataxis](https://diataxis.fr/) to structure content. Only project-specific conventions follow.

## Project-Specific Rules

| Rule                             | Specification                            |
| -------------------------------- | ---------------------------------------- |
| No horizontal rules (`---`)      | Fragments reading flow                   |
| No `####` headers                | Use bold text or admonitions instead     |
| No "Related" or "Next:" sections | Sidebar handles navigation               |
| No deeply nested lists           | Break into sections instead              |
| No code blocks for non-code      | Use admonitions for dialogue examples    |
| No bold paragraphs for callouts  | Use admonitions instead                  |
| 1-2 admonitions per section max  | Tutorials allow 3-4 per major section    |
| Table cells / list items         | 1-2 sentences max                        |
| Header budget                    | 8-12 `##` per doc; 2-3 `###` per section |

## Admonitions (Starlight Syntax)

```md
:::tip[Title]
Shortcuts, best practices
:::

:::note[Title]
Context, definitions, examples, prerequisites
:::

:::caution[Title]
Caveats, potential issues
:::

:::danger[Title]
Critical warnings only — data loss, security issues
:::
```

### Standard Uses

| Admonition               | Use For                       |
| ------------------------ | ----------------------------- |
| `:::note[Prerequisites]` | Dependencies before starting  |
| `:::tip[Quick Path]`     | TL;DR summary at document top |
| `:::caution[Important]`  | Critical caveats              |
| `:::note[Example]`       | Command/response examples     |
