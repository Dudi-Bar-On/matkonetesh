---
name: claude-code-docs-64
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 64/66 (code.claude.com)"
type: reference
---

## How telemetry flows from the SDK

The Agent SDK runs the Claude Code CLI as a child process and communicates with it over a local pipe. The CLI has OpenTelemetry instrumentation built in: it records spans around each model request and tool execution, emits metrics for token and cost counters, and emits structured log events for prompts and tool results. The SDK does not produce telemetry of its own. Instead, it passes configuration through to the CLI process, and the CLI exports directly to your collector.

Configuration is passed as environment variables. By default, the child process inherits your application's environment, so you can configure telemetry in either of two places:

* **Process environment:** set the variables in your shell, container, or orchestrator before your application starts. Every `query()` call picks them up automatically with no code change. This is the recommended approach for production deployments.
* **Per-call options:** set the variables in `ClaudeAgentOptions.env` (Python) or `options.env` (TypeScript). Use this when different agents in the same process need different telemetry settings. In Python, `env` is merged on top of the inherited environment. In TypeScript, `env` replaces the inherited environment entirely, so include `...process.env` in the object you pass.

The CLI exports three independent OpenTelemetry signals. Each has its own enable switch and its own exporter, so you can turn on only the ones you need.

| Signal     | What it contains                                                            | Enable with                                                         |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Metrics    | Counters for tokens, cost, sessions, lines of code, and tool decisions      | `OTEL_METRICS_EXPORTER`                                             |
| Log events | Structured records for each prompt, API request, API error, and tool result | `OTEL_LOGS_EXPORTER`                                                |
| Traces     | Spans for each interaction, model request, tool call, and hook (beta)       | `OTEL_TRACES_EXPORTER` plus `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` |

For the complete list of metric names, event names, and attributes, see the Claude Code [Monitoring](/docs/en/monitoring-usage) reference. The Agent SDK emits the same data because it runs the same CLI. Span names are listed in [Read agent traces](#read-agent-traces) below.

## Enable telemetry export

Telemetry is off until you set `CLAUDE_CODE_ENABLE_TELEMETRY=1` and choose at least one exporter. The most common configuration sends all three signals over OTLP HTTP to a collector.

The following example sets the variables in a dictionary and passes them through `options.env`. The agent runs a single task, and the CLI exports spans, metrics, and events to the collector at `collector.example.com` while the loop consumes the response stream:

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions

  OTEL_ENV = {
      "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
      # Required for traces, which are in beta. Metrics and log events do not need this.
      "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA": "1",
      # Choose an exporter per signal. Use otlp for the SDK; see the Note below.
      "OTEL_TRACES_EXPORTER": "otlp",
      "OTEL_METRICS_EXPORTER": "otlp",
      "OTEL_LOGS_EXPORTER": "otlp",
      # Standard OTLP transport configuration.
      "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
      "OTEL_EXPORTER_OTLP_ENDPOINT": "http://collector.example.com:4318",
      "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer your-token",
  }


  async def main():
      options = ClaudeAgentOptions(env=OTEL_ENV)
      async for message in query(
          prompt="List the files in this directory", options=options
      ):
          print(message)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const otelEnv = {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    // Required for traces, which are in beta. Metrics and log events do not need this.
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
    // Choose an exporter per signal. Use otlp for the SDK; see the Note below.
    OTEL_TRACES_EXPORTER: "otlp",
    OTEL_METRICS_EXPORTER: "otlp",
    OTEL_LOGS_EXPORTER: "otlp",
    // Standard OTLP transport configuration.
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.example.com:4318",
    OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer your-token",
  };

  for await (const message of query({
    prompt: "List the files in this directory",
    // env replaces the inherited environment in TypeScript, so spread
    // process.env first to keep PATH, ANTHROPIC_API_KEY, and other variables.
    options: { env: { ...process.env, ...otelEnv } },
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

Because the child process inherits your application's environment by default, you can achieve the same result by exporting these variables in a Dockerfile, Kubernetes manifest, or shell profile and omitting `options.env` entirely.

To confirm that export is working, check your collector's logs for incoming spans, metrics, and log events after the task completes. The CLI fails silently on export errors by default: if the endpoint is unreachable or rejects the data, the agent still runs normally and the CLI drops the telemetry without surfacing an error in your application. To surface exporter errors, set [`CLAUDE_CODE_OTEL_DIAG_STDERR=1`](/docs/en/env-vars) alongside the exporter variables and read the diagnostics through the SDK's `stderr` callback (Python) or `stderr` option (TypeScript). {/* min-version: 2.1.179 */}Requires Claude Code v2.1.179 or later.

<Note>
  The `console` exporter writes telemetry to standard output, which the SDK uses
  as its message channel. Do not set `console` as an exporter value when running
  through the SDK. To inspect telemetry locally, point
  `OTEL_EXPORTER_OTLP_ENDPOINT` at a local collector or an all-in-one Jaeger
  container instead.
</Note>

### Flush telemetry from short-lived calls

The CLI batches telemetry and exports on an interval. On a clean process exit it attempts to flush pending data, but the flush is bounded by a short timeout, so spans can still be dropped if the collector is slow to respond. If your process is killed before the CLI shuts down, anything still in the batch buffer is lost. Lowering the export intervals reduces both windows.

By default, metrics export every 60 seconds and traces and logs export every 5 seconds. The following example shortens all three intervals so that data reaches the collector while a short task is still running:

<CodeGroup>
  ```python Python theme={null}
  OTEL_ENV = {
      # ... exporter configuration from the previous example ...
      "OTEL_METRIC_EXPORT_INTERVAL": "1000",
      "OTEL_LOGS_EXPORT_INTERVAL": "1000",
      "OTEL_TRACES_EXPORT_INTERVAL": "1000",
  }
  ```

  ```typescript TypeScript theme={null}
  const otelEnv = {
    // ... exporter configuration from the previous example ...
    OTEL_METRIC_EXPORT_INTERVAL: "1000",
    OTEL_LOGS_EXPORT_INTERVAL: "1000",
    OTEL_TRACES_EXPORT_INTERVAL: "1000",
  };
  ```
</CodeGroup>
