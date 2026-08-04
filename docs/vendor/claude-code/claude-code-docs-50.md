---
name: claude-code-docs-50
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 50/66 (code.claude.com)"
type: reference
---

## Related resources

* [Claude Code hooks reference](/docs/en/hooks): full JSON input/output schemas, event documentation, and matcher patterns
* [Claude Code hooks guide](/docs/en/hooks-guide): shell command hook examples and walkthroughs
* [TypeScript SDK reference](/docs/en/agent-sdk/typescript): hook types, input/output definitions, and configuration options
* [Python SDK reference](/docs/en/agent-sdk/python): hook types, input/output definitions, and configuration options
* [Permissions](/docs/en/agent-sdk/permissions): control what your agent can do
* [Custom tools](/docs/en/agent-sdk/custom-tools): build tools to extend agent capabilities


<!-- source: https://code.claude.com/docs/en/agent-sdk/hosting.md -->

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Hosting the Agent SDK

> Deploy the Agent SDK in production: subprocess architecture, session persistence, scaling, observability, and multi-tenant isolation for Docker, Kubernetes, and sandbox providers.

The Agent SDK spawns and supervises a `claude` CLI subprocess that owns a shell, a working directory, and session files on disk. Hosting it is not like hosting a stateless API wrapper. Every running agent is a long-lived process tied to local state, which shapes how you allocate resources, persist sessions, and scale across tenants.

This page covers self-hosting on your own infrastructure: understand [the subprocess model](#the-subprocess-model), [choose a session pattern](#choose-a-session-pattern), [provision the container](#provision-the-container), and [handle production concerns](#handle-production-concerns) like persistence, observability, auth, and multi-tenant isolation. For deployable Dockerfiles and Kubernetes manifests, see the [hosting cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk/hosting).

If you do not need infrastructure control, custom isolation, or your own data plane, consider [Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview) instead: a hosted REST API where Anthropic runs the agent and the sandbox, so your application sends events and streams back results with no hosting infrastructure to operate.

<Info>
  For security hardening beyond basic sandboxing, including network controls, credential management, and isolation options, see [Secure Deployment](/docs/en/agent-sdk/secure-deployment).
</Info>

## The subprocess model

Every hosting decision on this page follows from how the SDK runs the agent. When your code calls `query()`, the SDK spawns a separate `claude` CLI process and talks to it over stdio. That subprocess owns the shell, the working directory, and the JSONL session transcripts on local disk.

<img src="https://mintcdn.com/claude-code/ikqp3_70mqIahteV/images/agent-sdk/hosting-subprocess.svg?fit=max&auto=format&n=ikqp3_70mqIahteV&q=85&s=9dac857ca9d3b1410c3734900c386004" className="dark:hidden" alt="Request flow: client to your app, which spawns a claude CLI subprocess over stdio inside the container; the subprocess writes to local disk and calls api.anthropic.com over HTTPS" width="920" height="220" data-path="images/agent-sdk/hosting-subprocess.svg" />

<img src="https://mintcdn.com/claude-code/_xqph1dUOslCOwsj/images/agent-sdk/hosting-subprocess-dark.svg?fit=max&auto=format&n=_xqph1dUOslCOwsj&q=85&s=3fdeff3d7f44b2b67762668acfbb25f5" className="hidden dark:block" alt="Request flow: client to your app, which spawns a claude CLI subprocess over stdio inside the container; the subprocess writes to local disk and calls api.anthropic.com over HTTPS" width="920" height="220" data-path="images/agent-sdk/hosting-subprocess-dark.svg" />

One agent session maps to one subprocess. Running N concurrent sessions means N subprocesses, each with its own process tree and transcript file. By default they all inherit your application's working directory, so pass `cwd` on each `query()` call when sessions need separate filesystems:

<CodeGroup>
  ```typescript TypeScript theme={null}
  query({ prompt, options: { cwd: "/work/session-a" } })
  ```

  ```python Python theme={null}
  query(prompt=prompt, options=ClaudeAgentOptions(cwd="/work/session-a"))
  ```
</CodeGroup>

### State that lives on local disk

Three kinds of agent state live on the container's filesystem by default. None of them survive a container restart, a scale-down, or a move to a different node.

| State                       | Default location                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Session transcripts         | `~/.claude/projects/`, or the `projects/` directory under `CLAUDE_CONFIG_DIR` if set             |
| `CLAUDE.md` memory files    | `~/.claude/CLAUDE.md` for the user tier and the session's working directory for the project tier |
| Working-directory artifacts | The session's working directory                                                                  |

To persist transcripts across hosts, configure a [`SessionStore` adapter](/docs/en/agent-sdk/session-storage). Memory files and other working-directory artifacts need their own storage strategy, such as a mounted volume or an object-store sync.

For how sessions, resumption, and forking work at the API level, see [Sessions](/docs/en/agent-sdk/sessions).

## Choose a session pattern

These four patterns cover session lifecycle: how long a container lives relative to the sessions it serves. For where the container runs, the [hosting cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/claude_agent_sdk/07_Hosting_the_agent.ipynb) has [deployable code](https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk/hosting) for local Docker, Modal, and Kubernetes. Choose a session pattern here and a deployment target from the cookbook.

### Ephemeral sessions

Create a container for each user task and destroy it when the task completes. Best for one-off tasks. The user may still interact with the AI while the task is completing, but once completed the container is destroyed.

Example workloads include bug investigation and fix, invoice and receipt extraction, document translation, and media transformation.

The container runs a one-shot entrypoint that calls the SDK and exits. In TypeScript, save the file as `entrypoint.mts` or set `"type": "module"` in `package.json` so top-level `await` is available.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const prompt = process.env.TASK_PROMPT!;
  for await (const message of query({ prompt, options: { maxTurns: 20 } })) {
    console.log(message);
  }
  ```

  ```python Python theme={null}
  import asyncio
  import os

  from claude_agent_sdk import ClaudeAgentOptions, query


  async def main():
      async for message in query(
          prompt=os.environ["TASK_PROMPT"],
          options=ClaudeAgentOptions(max_turns=20),
      ):
          print(message)


  asyncio.run(main())
  ```
</CodeGroup>
