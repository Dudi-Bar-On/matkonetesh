---
name: serena-docs-14
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 14/26 (docs)"
type: reference
---

## Project Activation
   
Project activation makes Serena aware of the project you want to work with.
You can either choose to do this
 * while in a conversation, by telling the LLM to activate a project, e.g.,
       
      * "Activate the project /path/to/my_project" (for first-time activation with auto-creation)
      * "Activate the project my_project"
   
   Note that this option requires the `activate_project` tool to be active, 
   which it isn't in single-project [contexts](contexts) like `ide` or `claude-code` *if* a project is provided at startup.
   (The tool is deactivated, because we assume that in these contexts, user will only work on the single, open project and have
   no need to switch it.)

 * when the MCP server starts, by passing the project path or name as a command-line argument
   (e.g. when using a single-project mode like `ide` or `claude-code`): `--project <path|name>`

When working with the JetBrains plugin, be sure to have the same project folder open as a project in your IDE,
i.e. the folder that is activated in Serena should correspond to the root folder of the project in your IDE.

## Onboarding & Memories

By default, Serena will perform an **onboarding process** when
it is started for the first time for a project.
The goal of the onboarding is for Serena to get familiar with the project
and to store memories, which it can then draw upon in future interactions.

In general, **memories** provide a way for Serena to store and retrieve 
information about the project, relevant conventions, and other relevant aspects.
Memories may reference each other using the `` `mem:NAME` `` convention; references
are kept in sync across renames, and a `serena memories check` command is available
to report stale references.

During the first onboarding, Serena seeds a `memory_maintenance` memory describing the
conventions (style, references) that subsequent memories should follow, and the
agent is instructed to read it before writing any project-specific memories.

For more information on this, including the target memory layout, the `mem:` reference
convention, the `serena memories` CLI subcommands, and how to manage or disable these
features, see [Memories & Onboarding](045_memories).


## Preparing Your Project

When using Serena to work on your project, it can be helpful to follow a few best practices.

### Structure Your Codebase

Serena uses the code structure for finding, reading and editing code. This means that it will
work well with well-structured code but may perform poorly on fully unstructured one (like a "God class"
with enormous, non-modular functions).

Furthermore, for languages that are not statically typed, the use of type annotations (if supported) 
are highly beneficial.

### Start from a Clean State

It is best to start a code generation task from a clean git state. Not only will
this make it easier for you to inspect the changes, but also the model itself will
have a chance of seeing what it has changed by calling `git diff` and thereby
correct itself or continue working in a followup conversation if needed.

### Use Platform-Native Line Endings

**Important**: since Serena will write to files using the system-native line endings
and it might want to look at the git diff, it is important to
set `git config core.autocrlf` to `true` on Windows.
With `git config core.autocrlf` set to `false` on Windows, you may end up with huge diffs
due to line endings only. 
It is generally a good idea to globally enable this git setting on Windows:

```shell
git config --global core.autocrlf true
```

### Logging, Linting, and Automated Tests

Serena can successfully complete tasks in an _agent loop_, where it iteratively
acquires information, performs actions, and reflects on the results.
However, Serena cannot use a debugger; it must rely on the results of program executions,
linting results, and test results to assess the correctness of its actions.
Therefore, software that is designed to meaningful interpretable outputs (e.g. log messages)
and that has a good test coverage is much easier to work with for Serena.

We generally recommend to start an editing task from a state where all linting checks and tests pass.

## Multiple Projects, Multiple Agents

There are several ways in which you might want to work with multiple projects simultaneously.

### A Single Agent Editing Multiple Projects Simultaneously

If fulfilling a task requires a single agent to edit code in multiple projects, the recommended approach is to create a **monorepo folder**,
i.e. a folder that contains all the projects as sub-folders, and open that monorepo folder as a project in Serena.
You may also use symbolic links to create a monorepo folder if the projects are located in different places on your filesystem.

If several languages are used across the projects, specify all of them as needed when using the LSP backend;
For JetBrains mode, make sure that your IDE is configured to work with all the languages used across the projects (e.g. by installing the respective language plugins).

(query-projects)=
### Reading from External Projects

If, while working on a project, you want Serena to be able to read code or other information from another project (e.g. a library or otherwise related project), 
this can be enabled via the `query_project` tool.
Provided that the project you want to query is known to Serena (i.e. you have created it as described above),
the `query_project` tool allows the agent to query files and symbolic information from that project.

To enable this tool, [activate the mode](modes) `query-projects`.
This also enables a second tool for listing projects that can be queried.

Depending on the language backend being used, the management of resources for the external projects varies:

* When using the JetBrains backend, make sure that every project for which you want symbolic queries to work is open in an IDE instance. 
* When using the LSP backend, executing symbolic tools via the query tool requires that Serena's **Project Server** be started,
  which will automatically spawn the necessary language servers for the projects that are queried.

  To start the server, run

      serena start-project-server


### Multiple Agents Accessing a Single Serena Instance

If you want multiple agents to access the same project via a single Serena instance,
i.e. you do not want several instances of Serena (including its language servers) to be running,
you can achieve this by [starting the Serena MCP server in HTTP mode](streamable-http)
and connecting all client agents to the same HTTP endpoint.
The agents will then share the resources of the single Serena instance.

### Multiple Agents Working on Different Projects

For this use case, simply run a separate instance of Serena for each project, which naturally
occurs when Serena is started by the MCP client in stdio mode.


<!-- source: docs/02-usage/045_memories.md -->

# Memories & Onboarding

Serena provides the functionality of a fully featured agent, and a useful aspect of this is Serena's memory system.
Despite its simplicity, we received positive feedback from many users who tend to combine it with their
agent's internal memory management (e.g., `AGENTS.md` files).

(memories)=
