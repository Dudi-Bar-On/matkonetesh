"""The eight metadata filter axes, compiled to parameterised SQL.

The prompt, Phase 5: "Metadata filtering for: namespace; source type; document status; revision
status; source authority; repository; document path; timestamps."

WHY A WHITELIST AND NOT A DICT PASSED THROUGH.

A retrieval operation takes filters from a caller that may ultimately be a subagent acting on text
it read somewhere. If the filter dict reached SQL by string formatting, that is an injection with
extra steps. So each axis is a named field with a known column and a known operator, values always
travel as bind parameters, and an unknown axis is REFUSED rather than ignored.

Refused, not ignored, is the load-bearing half. A filter that is silently dropped returns MORE
rows than the caller asked for while looking like it worked — the same shape as an empty answer
that looks like a real one, which this project has paid for repeatedly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .graph_schema import SchemaViolation


class UnknownFilter(SchemaViolation):
    """A filter axis that is not on the whitelist."""


@dataclass(frozen=True)
class Axis:
    column: str          # fully qualified, so a caller cannot choose the table
    operator: str        # '=', 'IN', '>=', '<=', 'LIKE'
    description: str


# column names here are literals in THIS file and never come from a caller.
AXES: dict[str, Axis] = {
    "namespace":        Axis("d.namespace", "IN", "which corpus"),
    "source_type":      Axis("d.doc_kind", "IN", "markdown / code / tool_spec"),
    "document_status":  Axis("dr.status", "IN", "status of the document's current revision"),
    "revision_status":  Axis("dr.status", "IN", "revision lifecycle status"),
    "source_authority": Axis("dr.source_authority", "IN", "primary_source / vendor_doc / ..."),
    "repository":       Axis("dr.source_commit", "IN", "the commit a revision came from"),
    "document_path":    Axis("d.source_path", "LIKE", "path prefix match"),
    "created_after":    Axis("dr.created_at", ">=", "timestamps"),
    "created_before":   Axis("dr.created_at", "<=", "timestamps"),
}


def compile_filters(filters: dict[str, Any] | None) -> tuple[str, list[Any]]:
    """Return (sql_fragment, params). The fragment is always safe to concatenate.

    Every value is a bind parameter. The only text taken from `filters` is the KEY, and a key that
    is not in AXES raises rather than reaching SQL at all.
    """
    if not filters:
        return "", []

    unknown = sorted(set(filters) - set(AXES))
    if unknown:
        raise UnknownFilter(
            f"unknown filter axis/axes: {', '.join(unknown)}. "
            f"Allowed: {', '.join(sorted(AXES))}. "
            "Refused rather than ignored — a dropped filter returns more rows than asked for "
            "while looking like it worked."
        )

    clauses: list[str] = []
    params: list[Any] = []
    for key in sorted(filters):          # sorted so the SQL is deterministic and cacheable
        value = filters[key]
        if value is None:
            continue
        axis = AXES[key]
        if axis.operator == "IN":
            values = list(value) if isinstance(value, (list, tuple, set)) else [value]
            if not values:
                raise UnknownFilter(f"filter {key!r} was given an empty list — that matches nothing; omit it instead")
            clauses.append(f"{axis.column} = ANY(%s)")
            params.append([str(v) for v in values])
        elif axis.operator == "LIKE":
            clauses.append(f"{axis.column} LIKE %s")
            # Prefix match, and the wildcard is added HERE so a caller cannot smuggle one in the
            # middle and widen the query beyond what they described.
            params.append(str(value).replace("%", r"\%").replace("_", r"\_") + "%")
        else:
            clauses.append(f"{axis.column} {axis.operator} %s")
            params.append(value)

    if not clauses:
        return "", []
    return " AND " + " AND ".join(clauses), params


def describe_axes() -> str:
    """Human-readable list, for a tool description handed to an agent."""
    return "\n".join(f"  {name}: {a.description}" for name, a in sorted(AXES.items()))
