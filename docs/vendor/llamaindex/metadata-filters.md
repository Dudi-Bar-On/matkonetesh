# LlamaIndex — MetadataFilters / FilterOperator / FilterCondition (0.14.23)

- **Source (authoritative):** the installed package,
  `llama_index/core/vector_stores/types.py` and `llama_index/core/vector_stores/utils.py`
  — `llama-index-core 0.14.23`
- **Source (docs site):** https://developers.llamaindex.ai/python/framework/module_guides/indexing/metadata_extraction/
- **Retrieved:** 2026-08-04

All code is `VERBATIM (installed source)`.

---

## `FilterOperator`

```python
class FilterOperator(str, Enum):
    """Vector store filter operator."""

    # TODO add more operators
    EQ = "=="  # default operator (string, int, float)
    GT = ">"  # greater than (int, float)
    LT = "<"  # less than (int, float)
    NE = "!="  # not equal to (string, int, float)
    GTE = ">="  # greater than or equal to (int, float)
    LTE = "<="  # less than or equal to (int, float)
    IN = "in"  # In array (string or number)
    NIN = "nin"  # Not in array (string or number)
    ANY = "any"  # Contains any (array of strings)
    ALL = "all"  # Contains all (array of strings)
    TEXT_MATCH = "text_match"  # full text match (allows you to search for a specific substring, token or phrase within the text field)
    TEXT_MATCH_INSENSITIVE = (
        "text_match_insensitive"  # full text match (case insensitive)
    )
    CONTAINS = "contains"  # metadata array contains value (string or number)
    IS_EMPTY = "is_empty"  # the field is not exist or empty (null or empty array)
```

## `FilterCondition`

```python
class FilterCondition(str, Enum):
    """Vector store filter conditions to combine different filters."""

    # TODO add more conditions
    AND = "and"
    OR = "or"
    NOT = "not"  # negates the filter condition
```

## `MetadataFilter`

```python
class MetadataFilter(BaseModel):
    r"""
    Comprehensive metadata filter for vector stores to support more operators.

    Value uses Strict types, as int, float and str are compatible types and were all
    converted to string before.

    See: https://docs.pydantic.dev/latest/usage/types/#strict-types
    """

    key: str
    value: Optional[
        Union[
            StrictInt,
            StrictFloat,
            StrictStr,
            List[StrictStr],
            List[StrictFloat],
            List[StrictInt],
        ]
    ]
    operator: FilterOperator = FilterOperator.EQ

    @classmethod
    def from_dict(
        cls,
        filter_dict: Dict,
    ) -> "MetadataFilter":
        """
        Create MetadataFilter from dictionary.

        Args:
            filter_dict: Dict with key, value and operator.

        """
        return MetadataFilter.model_validate(filter_dict)
```

Note the **Strict types**: `MetadataFilter(key="chunk_index", value=3)` is a `StrictInt`; passing `"3"`
is a `StrictStr` and will not coerce. This matters when filters cross a JSON boundary.

## `MetadataFilters`

```python
class MetadataFilters(BaseModel):
    """Metadata filters for vector stores."""

    # Exact match filters and Advanced filters with operators like >, <, >=, <=, !=, etc.
    filters: List[Union[MetadataFilter, ExactMatchFilter, "MetadataFilters"]]
    # and/or such conditions for combining different filters
    condition: Optional[FilterCondition] = FilterCondition.AND

    @classmethod
    @deprecated(
        "`from_dict()` is deprecated. "
        "Please use `MetadataFilters(filters=.., condition='and')` directly instead."
    )
    def from_dict(cls, filter_dict: Dict) -> "MetadataFilters":
        """Create MetadataFilters from json."""
        filters = []
        for k, v in filter_dict.items():
            filter = MetadataFilter(key=k, value=v, operator=FilterOperator.EQ)
            filters.append(filter)
        return cls(filters=filters)

    @classmethod
    def from_dicts(
        cls,
        filter_dicts: List[Dict],
        condition: Optional[FilterCondition] = FilterCondition.AND,
    ) -> "MetadataFilters":
        """
        Create MetadataFilters from dicts.

        This takes in a list of individual MetadataFilter objects, along
        with the condition.

        Args:
            filter_dicts: List of dicts, each dict is a MetadataFilter.
            condition: FilterCondition to combine different filters.
```

Note: `filters` is typed to allow a **nested `MetadataFilters`**, and `from_dict()` is deprecated in favour
of the constructor. `ExactMatchFilter = MetadataFilter` (alias, kept for `AutoRetriever`).

---

## The reference in-Python evaluator — usable with no store at all

`llama_index/core/vector_stores/utils.py`. **This is the piece that makes `MetadataFilters` adoptable as a
plain filter API**: it turns a `MetadataFilters` into a predicate over a metadata mapping, with no vector
store, no LLM and no embeddings anywhere.

```python
def build_metadata_filter_fn(
    metadata_lookup_fn: Callable[[str], Mapping[str, Any]],
    metadata_filters: Optional[MetadataFilters] = None,
) -> Callable[[str], bool]:
    """Build metadata filter function."""
    filter_list = metadata_filters.filters if metadata_filters else []
```

Operator semantics, verbatim:

```python
            if operator == FilterOperator.LTE:
                return metadata_value <= value
            if operator == FilterOperator.IN:
                return metadata_value in value
            if operator == FilterOperator.NIN:
                return metadata_value not in value
            if operator == FilterOperator.CONTAINS:
                return value in metadata_value
            if operator == FilterOperator.TEXT_MATCH:
                if isinstance(value, str) and isinstance(metadata_value, str):
                    return value in metadata_value
                raise TypeError(
                    "Both metadata_value and value should be strings to be used with a "
                    "TEXT_MATCH filter"
                )
            if operator == FilterOperator.TEXT_MATCH_INSENSITIVE:
                if isinstance(value, str) and isinstance(metadata_value, str):
                    return value.lower() in metadata_value.lower()
                raise TypeError(
                    "Both metadata_value and value should be strings to be used with a "
                    "TEXT_MATCH_INSENSITIVE filter"
                )
```

```python
            if isinstance(filter_, MetadataFilters):
                raise ValueError("Nested MetadataFilters are not supported.")

            filter_matches = True
            metadata_value = metadata.get(filter_.key, None)
            if filter_.operator == FilterOperator.IS_EMPTY:
                filter_matches = (
                    metadata_value is None
                    or metadata_value == ""
                    or metadata_value == []
                )
```

**Contradiction worth recording:** the `MetadataFilters.filters` type hint permits a nested
`MetadataFilters`, but this evaluator explicitly raises `ValueError("Nested MetadataFilters are not
supported.")`. Nesting is a store-by-store capability, not a guaranteed one.

`TEXT_MATCH` is a **substring test** (`value in metadata_value`), not tokenised full-text search, and
`TEXT_MATCH_INSENSITIVE` lowercases both sides.

---

## Mapping the operators onto SQLite/JSONB

For a store that already queries `json_extract(metadata, '$.key')`, the translation is direct and needs no
LlamaIndex code at runtime — `MetadataFilters` is then used purely as the **description language**:

| `FilterOperator` | SQL over `json_extract(metadata,'$.key')` |
|---|---|
| `EQ` / `NE` | `= ?` / `!= ?` |
| `GT` / `GTE` / `LT` / `LTE` | `> ?` / `>= ?` / `< ?` / `<= ?` |
| `IN` / `NIN` | `IN (…)` / `NOT IN (…)` |
| `TEXT_MATCH` | `LIKE '%'||?||'%'` |
| `TEXT_MATCH_INSENSITIVE` | `lower(...) LIKE '%'||lower(?)||'%'` |
| `CONTAINS` | `EXISTS (SELECT 1 FROM json_each(metadata,'$.key') WHERE value = ?)` |
| `ANY` / `ALL` | `json_each` join with `OR` / `AND` over the value list |
| `IS_EMPTY` | `IS NULL OR = '' OR json_array_length(...) = 0` |
| `FilterCondition.AND/OR/NOT` | `AND` / `OR` / `NOT (...)` |

The value being a `key` + `operator` + strictly-typed `value` triple is what makes this safe: the key can be
validated against an allow-list before interpolation into a JSON path, and the value always goes through a
bound parameter.
