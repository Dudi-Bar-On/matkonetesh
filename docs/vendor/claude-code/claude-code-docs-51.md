---
name: claude-code-docs-51
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 51/66 (code.claude.com)"
type: reference
---

### Long-running sessions

Run persistent container instances, often hosting multiple SDK processes per container, to serve ongoing work. Best for agents that take autonomous action, serve content, or handle high-volume message streams.

Example workloads include an email agent that triages and responds to incoming mail, a site builder that hosts a per-user editable site through container ports, and a chat bot that handles continuous traffic from a platform like Slack.

The container exposes an HTTP or WebSocket endpoint and maps each active session to a long-lived query and the subprocess behind it. In TypeScript, use [`streamInput()`](/docs/en/agent-sdk/typescript#query-object) to add turns to an active session and [`startup()`](/docs/en/agent-sdk/typescript#startup) to pre-warm subprocesses ahead of incoming traffic. In Python, use [`ClaudeSDKClient`](/docs/en/agent-sdk/python#claudesdkclient) to hold a session open across turns. Size the container so it can hold the maximum number of concurrent sessions in memory.

### Hybrid sessions

Ephemeral containers that hydrate from a [`SessionStore`](/docs/en/agent-sdk/session-storage) on startup and persist updates back. Best for sessions that span many interactions but sit idle between them. The container spins down during idle periods and spins back up when the user returns.

Example workloads include a personal project manager with intermittent check-ins, deep research that pauses and resumes over hours, and a customer support agent that loads ticket history across interactions.

Tune your provider's idle timeout to how frequently you expect users to return. Shutting a container down without a `SessionStore` configured loses the transcript with it, so the store is required for this pattern, not optional.

The pattern hinges on resuming a session by ID with a shared store attached:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query, type SessionStore } from "@anthropic-ai/claude-agent-sdk";

  declare const userInput: string;
  declare const sessionId: string;          // looked up from your database by user
  declare const sessionStore: SessionStore; // S3, Redis, Postgres, or your own adapter

  for await (const message of query({
    prompt: userInput,
    options: { resume: sessionId, sessionStore },
  })) {
    // ...
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, SessionStore
  import asyncio

  user_input: str = ...
  session_id: str = ...              # looked up from your database by user
  session_store: SessionStore = ...  # S3, Redis, Postgres, or your own adapter


  async def main():
      async for message in query(
          prompt=user_input,
          options=ClaudeAgentOptions(
              resume=session_id,
              session_store=session_store,
          ),
      ):
          ...


  asyncio.run(main())
  ```
</CodeGroup>

See [Session storage](/docs/en/agent-sdk/session-storage) for the full `SessionStore` interface and reference adapters.

### Multi-agent container

Run multiple SDK subprocesses inside one container. Best for agents that must collaborate closely, for example multi-agent simulations where the agents interact with each other in a shared environment.

Give each agent its own working directory so they do not overwrite each other's files, and isolate settings loading so per-agent `CLAUDE.md` files do not leak across agents. See [Multi-tenant isolation](#multi-tenant-isolation) for the specific options.

## Provision the container

### Container-based sandboxing

Run the SDK inside a sandboxed container for process isolation, resource limits, network control, and an ephemeral filesystem. Several providers specialize in sandboxed container environments that fit the Agent SDK's model.

Questions to answer when choosing a provider:

* **Who runs the sandbox**: a sandbox-as-a-service provider operates the infrastructure for you, while self-hosted options give you software to run on your own.
* **Cold-start latency**: how long from "create a sandbox" to "ready to accept the first request." Ephemeral patterns need sub-second starts. Long-running patterns tolerate more.
* **Persistent storage**: whether the provider offers durable volumes or only ephemeral disk. The hybrid pattern needs durable storage somewhere, whether in the sandbox or alongside it.
* **Pricing model**: per-second, per-request, or flat hourly billing. Per-second pricing suits bursty ephemeral workloads. Hourly suits long-running sessions.
* **Networking**: support for custom egress rules, outbound proxies, and private VPC peering for regulated environments.

Providers to evaluate:

* [Modal Sandbox](https://modal.com/docs/guide/sandbox), with a [demo implementation](https://modal.com/docs/examples/claude-slack-gif-creator)
* [Cloudflare Sandboxes](https://github.com/cloudflare/sandbox-sdk)
* [Daytona](https://www.daytona.io/)
* [E2B](https://e2b.dev/)
* [Fly Machines](https://fly.io/docs/machines/)
* [Vercel Sandbox](https://vercel.com/docs/functions/sandbox)

For self-hosted options such as Docker, gVisor, and Firecracker, and detailed isolation configuration, see [Isolation Technologies](/docs/en/agent-sdk/secure-deployment#isolation-technologies).

### Runtime dependencies

The container needs only your SDK's language runtime:

* Python 3.10+ for the Python SDK, or Node.js 18+ for the TypeScript SDK
* Both SDK packages bundle a native Claude Code binary for the host platform, so no separate Claude Code or Node.js install is needed for the spawned CLI

The bundled binary is pinned to the SDK package version, so updating the SDK is how you update the CLI. The SDK follows semver: take patch releases continuously and review the [TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md) or [Python](https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md) changelog before taking a minor.

### Resources

1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point for a freshly started instance. Memory usage grows with session length and tool activity, so size for the session lengths and concurrency you actually need rather than the idle baseline. See [Scaling and concurrency](#scaling-and-concurrency) for how to work out agents per host.

### Network

The SDK needs outbound HTTPS to `api.anthropic.com`, or to your provider's regional endpoint when running on Amazon Bedrock or Google Cloud's Agent Platform. If your agents use [MCP servers](/docs/en/agent-sdk/mcp) or external tools, they need outbound access to those endpoints as well. For production, route outbound traffic through an egress proxy that enforces domain allowlists, injects credentials, and logs requests. See [Secure Deployment](/docs/en/agent-sdk/secure-deployment) for the full pattern.

For inbound traffic, expose an HTTP or WebSocket port on the container. Your application handles client requests on that port and calls the SDK internally; the subprocess itself does not listen on the network.

## Handle production concerns

Work through these decisions before shipping a self-hosted agent.
