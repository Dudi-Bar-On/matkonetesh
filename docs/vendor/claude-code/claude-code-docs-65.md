---
name: claude-code-docs-65
description: "Claude Code (the CLI — Phase-4 parity north-star) — vendor doc 65/66 (code.claude.com)"
type: reference
---

## Read agent traces

Traces give you the most detailed view of an agent run. With `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` set, each step of the agent loop becomes a span you can inspect in your tracing backend:

* **`claude_code.interaction`:** wraps a single turn of the agent loop, from receiving a prompt to producing a response.
* **`claude_code.llm_request`:** wraps each call to the Claude API, with model name, latency, and token counts as attributes.
* **`claude_code.tool`:** wraps each tool invocation, with child spans for the permission wait (`claude_code.tool.blocked_on_user`) and the execution itself (`claude_code.tool.execution`).
* **`claude_code.hook`:** wraps each [hook](/docs/en/agent-sdk/hooks) execution. Requires detailed beta tracing (`ENABLE_BETA_TRACING_DETAILED=1` and `BETA_TRACING_ENDPOINT`) in addition to the variables above.

The `llm_request`, `tool`, and `hook` spans are children of the enclosing `claude_code.interaction` span. When the agent spawns a subagent through the Task tool, the subagent's `llm_request` and `tool` spans nest under the parent agent's `claude_code.tool` span, so the full delegation chain appears as one trace.

Spans carry a `session.id` attribute by default. When you make several `query()` calls against the same [session](/docs/en/agent-sdk/sessions), filter on `session.id` in your backend to see them as one timeline. Claude Code omits the attribute if you set `OTEL_METRICS_INCLUDE_SESSION_ID` to a falsy value.

<Note>
  Tracing is in beta. Span names and attributes may change between releases. See
  [Traces (beta)](/docs/en/monitoring-usage#traces-beta) in the Monitoring reference
  for the trace exporter configuration variables.
</Note>

## Link traces to your application

The SDK automatically propagates W3C trace context into the CLI subprocess. When you call `query()` while an OpenTelemetry span is active in your application, the SDK injects `TRACEPARENT` and `TRACESTATE` into the child process environment, and the CLI reads them so its `claude_code.interaction` span becomes a child of your span. The agent run then appears inside your application's trace instead of as a disconnected root.

OTLP event log records emitted during the run carry the same trace context: with `TRACEPARENT` set, each record's `trace_id` and `span_id` match your application's trace, so you can join [events](/docs/en/monitoring-usage#events) to spans in your backend. {/* min-version: 2.1.212 */}Before v2.1.212, event records emitted outside an active span didn't carry `trace_id` or `span_id`.

When trace-context propagation is enabled, the CLI also forwards `TRACEPARENT` to every Bash and PowerShell command it runs. If a command launched through the Bash tool emits its own OpenTelemetry spans, those spans nest under the `claude_code.tool.execution` span that wraps the command.

Auto-injection is skipped when you set `TRACEPARENT` explicitly in `options.env`, so you can pin a specific parent context if needed. Interactive CLI sessions ignore inbound `TRACEPARENT` entirely; only Agent SDK and `claude -p` runs honor it. See [Traces (beta)](/docs/en/monitoring-usage#traces-beta) in the Monitoring reference for the full span and attribute reference.

## Tag telemetry from your agent

By default, the CLI reports `service.name` as `claude-code`. If you run several agents, or run the SDK alongside other services that export to the same collector, override the service name and add resource attributes so you can filter by agent in your backend.

The following example renames the service and attaches deployment metadata. These values are applied as OpenTelemetry resource attributes on every span, metric, and event the agent emits:

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      env={
          # ... exporter configuration from the Enable telemetry export example ...
          "OTEL_SERVICE_NAME": "support-triage-agent",
          "OTEL_RESOURCE_ATTRIBUTES": "service.version=1.4.0,deployment.environment=production",
      },
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    env: {
      ...process.env,
      // ... exporter configuration from the Enable telemetry export example ...
      OTEL_SERVICE_NAME: "support-triage-agent",
      OTEL_RESOURCE_ATTRIBUTES:
        "service.version=1.4.0,deployment.environment=production",
    },
  };
  ```
</CodeGroup>

## Attribute actions to your end users

The CLI attaches [identity attributes](/docs/en/monitoring-usage#standard-attributes) to every event based on the credential it uses to call Anthropic. When you build an application that serves many end users from one deployment, these attributes identify your service's credential, not the end user on whose behalf the agent acted.

To make tool calls and MCP activity attributable to your application's end users, inject end-user identity as resource attributes on each `query()` call. Percent-encode values before interpolating them, since `OTEL_RESOURCE_ATTRIBUTES` [reserves commas, spaces, and equals signs](/docs/en/monitoring-usage#multi-team-organization-support). The following example attaches the requesting user and tenant to every span and event from one request. It assumes a `request` object from your web framework carrying the user and tenant IDs:

<CodeGroup>
  ```python Python theme={null}
  from urllib.parse import quote

  options = ClaudeAgentOptions(
      env={
          # ... exporter configuration from the Enable telemetry export example ...
          # request is the incoming request object from your web framework.
          "OTEL_RESOURCE_ATTRIBUTES": f"enduser.id={quote(request.user_id)},tenant.id={quote(request.tenant_id)}",
      },
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    env: {
      ...process.env,
      // ... exporter configuration from the Enable telemetry export example ...
      // request is the incoming request object from your web framework.
      OTEL_RESOURCE_ATTRIBUTES: `enduser.id=${encodeURIComponent(request.userId)},tenant.id=${encodeURIComponent(request.tenantId)}`,
    },
  };
  ```
</CodeGroup>

With end-user identity attached, the `tool_decision`, `tool_result`, `mcp_server_connection`, and `permission_mode_changed` events, which export as log records named with a `claude_code.` prefix, become a per-user audit trail you can forward to a Security Information and Event Management (SIEM) platform. See [Audit security events](/docs/en/monitoring-usage#audit-security-events) in the Monitoring reference for the full list of security-relevant events and the attributes each one carries.
