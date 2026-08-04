"""Translate LlamaIndex `MetadataFilters` into SQL over the JSONB metadata column.

Adopted because it is a vocabulary we do not have to invent and other people already know:
14 operators and three conditions, defined by the library rather than by us. Before this, the
store accepted `metadata_equals={...}` — equality only, no OR, no ranges, no negation, and a
different shape from anything a reader would recognise.

SAFETY. Metadata keys are interpolated into a JSON path (`$.key`), which is an injection point.
Keys are therefore validated against a conservative pattern and every VALUE is bound as a
parameter, never formatted into the SQL. The store's own test suite drives a `DROP TABLE`
attempt through this to prove it.

NOT SUPPORTED, and it raises rather than silently returning everything: `ANY` and `ALL` need
JSON array containment semantics this schema does not model, and `IS_EMPTY` is ambiguous
between "key absent" and "value null". A filter that quietly matches nothing — or everything —
is worse than one that refuses.
"""

from __future__ import annotations

import re
from typing import Any

from llama_index.core.vector_stores.types import (
    FilterCondition,
    FilterOperator,
    MetadataFilter,
    MetadataFilters,
)

__all__ = ["to_sql", "UnsupportedFilter"]

_SAFE_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")

_SIMPLE = {
    FilterOperator.EQ: "=",
    FilterOperator.NE: "!=",
    FilterOperator.GT: ">",
    FilterOperator.GTE: ">=",
    FilterOperator.LT: "<",
    FilterOperator.LTE: "<=",
}


class UnsupportedFilter(ValueError):
    """Raised for an operator this store cannot honour — never silently ignored."""


def _path(key: str) -> str:
    if not _SAFE_KEY.match(key):
        raise UnsupportedFilter(
            f"metadata key {key!r} is not a plain identifier; it is interpolated into a JSON "
            "path and cannot be accepted unvalidated"
        )
    return f"json_extract(metadata, '$.{key}')"


def _one(f: MetadataFilter) -> tuple[str, list[Any]]:
    op = f.operator
    col = _path(f.key)

    if op in _SIMPLE:
        return f"{col} {_SIMPLE[op]} ?", [f.value]

    if op in (FilterOperator.IN, FilterOperator.NIN):
        values = list(f.value or [])
        if not values:
            # An empty IN matches nothing and an empty NIN matches everything. Both are almost
            # certainly a caller bug, so say so instead of guessing which was meant.
            raise UnsupportedFilter(f"{op.value} needs a non-empty list for key {f.key!r}")
        marks = ",".join("?" * len(values))
        verb = "IN" if op is FilterOperator.IN else "NOT IN"
        return f"{col} {verb} ({marks})", values

    if op is FilterOperator.CONTAINS:
        return f"instr({col}, ?) > 0", [f.value]

    if op is FilterOperator.TEXT_MATCH:
        return f"{col} LIKE ?", [f"%{f.value}%"]

    if op is FilterOperator.TEXT_MATCH_INSENSITIVE:
        return f"lower({col}) LIKE ?", [f"%{str(f.value).lower()}%"]

    raise UnsupportedFilter(
        f"operator {op.value!r} is not supported by this store. ANY/ALL need JSON array "
        "containment this schema does not model, and IS_EMPTY is ambiguous between an absent "
        "key and a null value — both would match wrongly rather than obviously."
    )


def to_sql(filters: MetadataFilters | None) -> tuple[str, list[Any]]:
    """Return (sql_fragment, params). An empty/None filter set yields ('', []).

    Nested MetadataFilters are supported, so `(a AND b) OR c` round-trips.
    """
    if filters is None or not filters.filters:
        return "", []

    parts: list[str] = []
    params: list[Any] = []
    for f in filters.filters:
        if isinstance(f, MetadataFilters):
            sub, sub_params = to_sql(f)
            if sub:
                parts.append(f"({sub})")
                params += sub_params
        else:
            sql, p = _one(f)
            parts.append(sql)
            params += p

    if not parts:
        return "", []

    cond = filters.condition or FilterCondition.AND
    if cond is FilterCondition.NOT:
        return f"NOT ({' AND '.join(parts)})", params
    joiner = " OR " if cond is FilterCondition.OR else " AND "
    return joiner.join(parts), params
