---
name: claude-code-docs-52
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 52/66 (code.claude.com)"
type: reference
---

### Session and state persistence

Default local disk is lost on restart, scale-down, or a move to a different node. For any session a user expects to resume, mirror the transcript to durable storage with a [`SessionStore` adapter](/docs/en/agent-sdk/session-storage). See [Reference implementations](/docs/en/agent-sdk/session-storage#reference-implementations) for S3, Redis, and Postgres adapters and a conformance suite for your own.

Three things to know about how `SessionStore` behaves:

* **Transcripts only**: `SessionStore` mirrors transcripts, not `CLAUDE.md` memory files or other working-directory artifacts. Mount a shared volume or sync those separately.
* **Mirror, not replacement**: the subprocess writes to local disk first, and the store receives a copy of each batch. Local writes remain authoritative.
* **`mirror_error` messages**: a batch the store rejects is sent up to three times in total, with a short backoff before each retry; a timed-out call isn't retried. If the batch still fails, the SDK drops it, emits a `{ type: "system", subtype: "mirror_error" }` message, and continues the query. Alert on these if store durability matters.

### Observability

Agent SDK agents are long-lived processes that spawn tool calls across many API round-trips. Without telemetry you cannot see which tools ran, how long they took, or where a session stalled.

The SDK inherits OpenTelemetry configuration from the environment. Set the OTEL environment variables at the container or orchestrator level so every `query()` call exports spans, metrics, and log events to your collector. The example below enables OTLP export for all three signals. `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` is required only for traces; omit it if you export metrics and logs alone.

```bash title=".env" theme={null}
CLAUDE_CODE_ENABLE_TELEMETRY=1
CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.example.com:4318
```

Prompt text and tool inputs are not included in exports by default. See [Control sensitive data in exports](/docs/en/agent-sdk/observability#control-sensitive-data-in-exports) for the opt-in flags, and [Observability](/docs/en/agent-sdk/observability) for the full signal catalog.

### Auth and secrets

Three auth concerns matter at hosting time:

* **Anthropic API**: the subprocess reads `ANTHROPIC_API_KEY` from its environment. Supply it from your secret manager, or set `ANTHROPIC_BASE_URL` to route model calls through a proxy that injects the key outside the container. See [Credential management](/docs/en/agent-sdk/secure-deployment#credential-management) for the proxy pattern and [Setup in the SDK quickstart](/docs/en/agent-sdk/quickstart#setup) for supported authentication methods.
* **Inbound**: put authentication at a gateway in front of the agent container. The agent should receive pre-authenticated requests and should not be the component that validates user tokens.
* **Outbound tools**: keep tool credentials out of the agent environment. Route outbound calls through a proxy that injects API keys after the request leaves the container. The agent makes the call; the proxy adds the credential.

### Scaling and concurrency

Each session runs in its own subprocess, so concurrency on a host is bounded by how many subprocesses its RAM can hold.

Size each host with this formula:

```text theme={null}
agents per host = (host RAM - overhead) / (per-session RAM ceiling)
```

Measure the per-session ceiling by running a representative session to your target length under your expected tool load and recording peak RSS. The 1 GiB starting point in [Resources](#resources) is a floor, not the ceiling.

Horizontal-scale routing depends on your pattern. For long-running sessions, where containers hold many sessions, run a pool of containers behind a load balancer and pin each session to one container using consistent hashing on `sessionId`. A pinned session keeps hitting the same container, and therefore the same running subprocess, until it is evicted or the container restarts.

Large fanouts of concurrent [subagents](/docs/en/agent-sdk/subagents) from a single session can hit API rate limits. Break the work into smaller batches rather than issuing one wide dispatch.

### Cost

Anthropic token cost typically dominates container infrastructure cost by an order of magnitude or more. A minimally provisioned container runs roughly \$0.05 per hour, while a single long agent session can spend dollars in tokens. See [Cost tracking](/docs/en/agent-sdk/cost-tracking) for per-session token accounting.

### Multi-tenant isolation

Default SDK behavior reads settings and `CLAUDE.md` memory files from the filesystem. In a shared container that serves multiple tenants, those files can leak one tenant's context into another tenant's session.

To isolate tenants inside a shared container:

* Pass `settingSources: []` in TypeScript or `setting_sources=[]` in Python so no filesystem settings load.
* Set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in `env`. [Auto memory](/docs/en/memory#auto-memory) at `~/.claude/projects/<project>/memory/` loads into the system prompt regardless of `settingSources`. See [What settingSources does not control](/docs/en/agent-sdk/claude-code-features#what-settingsources-does-not-control) for the other inputs that load unconditionally.
* Point `CLAUDE_CONFIG_DIR` at a per-tenant directory so tenants do not share the `~/.claude.json` global config.
* Use a per-tenant working directory. Pass `cwd` explicitly on every `query()` call.
* Apply per-tenant egress rules at your proxy, such as distinct outbound IPs, credentials, or domain allowlists, so a compromised tenant cannot exfiltrate data via another tenant's outbound policy.

The example below applies the four SDK-level options together. Construct `tenantDir` and `configDir` so each tenant gets a path no other tenant can read. In TypeScript, `env` replaces the subprocess environment, so spread `...process.env` to keep inherited variables like `PATH` and `ANTHROPIC_API_KEY`. In Python, `env` is merged on top of the inherited environment.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  declare const prompt: string;
  declare const tenantDir: string;
  declare const configDir: string;

  for await (const message of query({
    prompt,
    options: {
      cwd: tenantDir,
      settingSources: [],
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: configDir,
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      },
    },
  })) {
    // ...
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions
  import asyncio

  prompt: str = ...
  tenant_dir: str = ...
  config_dir: str = ...


  async def main():
      async for message in query(
          prompt=prompt,
          options=ClaudeAgentOptions(
              cwd=tenant_dir,
              setting_sources=[],
              env={
                  "CLAUDE_CONFIG_DIR": config_dir,
                  "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
              },
          ),
      ):
          ...


  asyncio.run(main())
  ```
</CodeGroup>

For per-tenant network controls, see [Secure Deployment](/docs/en/agent-sdk/secure-deployment).
