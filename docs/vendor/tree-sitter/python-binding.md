---
name: tree-sitter-python-binding
description: "py-tree-sitter 0.26.0 — the COMPLETE installed API surface (Language/Parser/Node/Query/QueryCursor) verbatim from the local type stub, plus the official README"
type: reference
---

<!-- source (VERBATIM, local install): Python314/Lib/site-packages/tree_sitter/__init__.pyi — tree-sitter 0.26.0 -->
<!-- source (VERBATIM, local install): Python314/Lib/site-packages/tree_sitter-0.26.0.dist-info/METADATA (the official README) -->
<!-- source: https://tree-sitter.github.io/py-tree-sitter/ -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — THIS FILE IS VERBATIM AND VERSION-EXACT.**
> Everything below is copied byte-for-byte from the **installed** package in this project
> (`tree-sitter` **0.26.0**), not from a website and not through any summarising tool. It is therefore
> the authoritative answer to "does this attribute exist in *our* version".
>
> **This file exists to end a specific class of bug.** We were twice handed example code using APIs that
> **do not exist here** — `node.parent_node` (the real attribute is **`node.parent`**) and a node type
> `Header_2`. **If it is not in the stub below, it does not exist. Check here before writing traversal code.**

---

## Read this first — the API-invention checklist

| Claimed | Reality in 0.26.0 |
|---|---|
| `node.parent_node` | ❌ does not exist — it is **`node.parent`** |
| `node.children_count` | ❌ — it is **`node.child_count`** |
| `query.captures(node)` | ❌ **moved** — `Query` has no `captures`; use **`QueryCursor(query).captures(node)`** |
| `Parser(); parser.set_language(L)` | ❌ no `set_language` method — pass to the constructor `Parser(L)` or assign the **`language` property** |
| node type `Header_2` | ❌ node type names come from the **grammar**, not the binding; there is no such node in these grammars |

Note the **0.26 breaking change**: `captures()` and `matches()` live on **`QueryCursor`**, not on `Query`.
Most examples on the internet predate this and will fail.

## Constructing a parser — the Windows-relevant path

`VERBATIM (installed source)` — the official README's recommended form:

```python
import tree_sitter_python as tspython
from tree_sitter import Language, Parser

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)
```

**Our context.** We build `Parser(Language(mod.language()))` from the **individual** grammar packages
rather than going through `tree_sitter_language_pack`. The individually installed grammars here are
`tree_sitter_python` **0.25.0**, `tree_sitter_javascript` **0.25.0**, `tree_sitter_typescript` **0.23.2**.

> **OBSERVATION, not a conclusion.** `tree_sitter_language_pack` **1.14.1 is installed** in this
> environment and does expose `get_parser` / `get_language` / `available_languages` (plus a native module
> with a `DownloadManager`). That is a *newer, differently-shaped* package than the one the
> "no windows-x86_64 build" note describes. Whether grammars actually load on this machine was **not
> tested** — Bash was disabled, so nothing could be executed. Flagging it only because the assumption may
> now be stale and worth a 30-second re-check.

## THE COMPLETE TYPE STUB — `tree_sitter/__init__.pyi`, 0.26.0, verbatim

```python
from enum import IntEnum
from collections.abc import ByteString, Callable, Iterator, Sequence
from typing import Annotated, Any, Final, Literal, Protocol, Self, final, overload
from typing_extensions import deprecated

class _SupportsFileno(Protocol):
    def fileno(self) -> int: ...

class LogType(IntEnum):
    PARSE: int
    LEX: int

@final
class Language:
    @overload
    @deprecated("int argument support is deprecated")
    def __init__(self, ptr: Annotated[int, "TSLanguage *"], /) -> None: ...
    @overload
    def __init__(self, ptr: Annotated[object, "TSLanguage *"], /) -> None: ...
    @property
    def name(self) -> str | None: ...
    @property
    def abi_version(self) -> int: ...
    @property
    def semantic_version(self) -> tuple[int, int, int] | None: ...
    @property
    def node_kind_count(self) -> int: ...
    @property
    def parse_state_count(self) -> int: ...
    @property
    def field_count(self) -> int: ...
    @property
    def supertypes(self) -> tuple[int, ...]: ...
    def subtypes(self, supertype: int, /) -> tuple[int, ...]: ...
    def node_kind_for_id(self, id: int, /) -> str | None: ...
    def id_for_node_kind(self, kind: str, named: bool, /) -> int | None: ...
    def node_kind_is_named(self, id: int, /) -> bool: ...
    def node_kind_is_visible(self, id: int, /) -> bool: ...
    def node_kind_is_supertype(self, id: int, /) -> bool: ...
    def field_name_for_id(self, field_id: int, /) -> str | None: ...
    def field_id_for_name(self, name: str, /) -> int | None: ...
    def next_state(self, state: int, id: int, /) -> int: ...
    def lookahead_iterator(self, state: int, /) -> LookaheadIterator | None: ...
    def copy(self) -> Language: ...
    def __repr__(self) -> str: ...
    def __eq__(self, other: Any, /) -> bool: ...
    def __ne__(self, other: Any, /) -> bool: ...
    def __hash__(self) -> int: ...
    def __copy__(self) -> Language: ...

@final
class Node:
    @property
    def id(self) -> int: ...
    @property
    def kind_id(self) -> int: ...
    @property
    def grammar_id(self) -> int: ...
    @property
    def grammar_name(self) -> str: ...
    @property
    def type(self) -> str: ...
    @property
    def is_named(self) -> bool: ...
    @property
    def is_extra(self) -> bool: ...
    @property
    def has_changes(self) -> bool: ...
    @property
    def has_error(self) -> bool: ...
    @property
    def is_error(self) -> bool: ...
    @property
    def parse_state(self) -> int: ...
    @property
    def next_parse_state(self) -> int: ...
    @property
    def is_missing(self) -> bool: ...
    @property
    def start_byte(self) -> int: ...
    @property
    def end_byte(self) -> int: ...
    @property
    def byte_range(self) -> tuple[int, int]: ...
    @property
    def range(self) -> Range: ...
    @property
    def start_point(self) -> Point: ...
    @property
    def end_point(self) -> Point: ...
    @property
    def children(self) -> list[Node]: ...
    @property
    def child_count(self) -> int: ...
    @property
    def named_children(self) -> list[Node]: ...
    @property
    def named_child_count(self) -> int: ...
    @property
    def parent(self) -> Node | None: ...
    @property
    def next_sibling(self) -> Node | None: ...
    @property
    def prev_sibling(self) -> Node | None: ...
    @property
    def next_named_sibling(self) -> Node | None: ...
    @property
    def prev_named_sibling(self) -> Node | None: ...
    @property
    def descendant_count(self) -> int: ...
    @property
    def text(self) -> bytes | None: ...
    def walk(self) -> TreeCursor: ...
    def edit(
        self,
        start_byte: int,
        old_end_byte: int,
        new_end_byte: int,
        start_point: Point | tuple[int, int],
        old_end_point: Point | tuple[int, int],
        new_end_point: Point | tuple[int, int],
    ) -> None: ...
    def child(self, index: int, /) -> Node | None: ...
    def named_child(self, index: int, /) -> Node | None: ...
    def first_child_for_byte(self, byte: int, /) -> Node | None: ...
    def first_named_child_for_byte(self, byte: int, /) -> Node | None: ...
    def child_by_field_id(self, id: int, /) -> Node | None: ...
    def child_by_field_name(self, name: str, /) -> Node | None: ...
    def child_with_descendant(self, descendant: Node, /) -> Node | None: ...
    def children_by_field_id(self, id: int, /) -> list[Node]: ...
    def children_by_field_name(self, name: str, /) -> list[Node]: ...
    def field_name_for_child(self, child_index: int, /) -> str | None: ...
    def field_name_for_named_child(self, child_index: int, /) -> str | None: ...
    def descendant_for_byte_range(
        self,
        start_byte: int,
        end_byte: int,
        /,
    ) -> Node | None: ...
    def named_descendant_for_byte_range(
        self,
        start_byte: int,
        end_byte: int,
        /,
    ) -> Node | None: ...
    def descendant_for_point_range(
        self,
        start_point: Point | tuple[int, int],
        end_point: Point | tuple[int, int],
        /,
    ) -> Node | None: ...
    def named_descendant_for_point_range(
        self,
        start_point: Point | tuple[int, int],
        end_point: Point | tuple[int, int],
        /,
    ) -> Node | None: ...
    def __repr__(self) -> str: ...
    def __str__(self) -> str: ...
    def __eq__(self, other: Any, /) -> bool: ...
    def __ne__(self, other: Any, /) -> bool: ...
    def __hash__(self) -> int: ...

@final
class Tree:
    @property
    def root_node(self) -> Node: ...
    @property
    def included_ranges(self) -> list[Range]: ...
    @property
    def language(self) -> Language: ...
    def root_node_with_offset(
        self,
        offset_bytes: int,
        offset_extent: Point | tuple[int, int],
        /,
    ) -> Node | None: ...
    def copy(self) -> Tree: ...
    def edit(
        self,
        start_byte: int,
        old_end_byte: int,
        new_end_byte: int,
        start_point: Point | tuple[int, int],
        old_end_point: Point | tuple[int, int],
        new_end_point: Point | tuple[int, int],
    ) -> None: ...
    def walk(self) -> TreeCursor: ...
    def changed_ranges(self, new_tree: Tree, /) -> list[Range]: ...
    def print_dot_graph(self, file: _SupportsFileno, /) -> None: ...
    def __copy__(self) -> Tree: ...

@final
class TreeCursor:
    @property
    def node(self) -> Node | None: ...
    @property
    def field_id(self) -> int | None: ...
    @property
    def field_name(self) -> str | None: ...
    @property
    def depth(self) -> int: ...
    @property
    def descendant_index(self) -> int: ...
    def copy(self) -> TreeCursor: ...
    def reset(self, node: Node, /) -> None: ...
    def reset_to(self, cursor: TreeCursor, /) -> None: ...
    def goto_first_child(self) -> bool: ...
    def goto_last_child(self) -> bool: ...
    def goto_parent(self) -> bool: ...
    def goto_next_sibling(self) -> bool: ...
    def goto_previous_sibling(self) -> bool: ...
    def goto_descendant(self, index: int, /) -> None: ...
    def goto_first_child_for_byte(self, byte: int, /) -> int | None: ...
    def goto_first_child_for_point(self, point: Point | tuple[int, int], /) -> int | None: ...
    def __copy__(self) -> TreeCursor: ...

@final
class Parser:
    def __init__(
        self,
        language: Language | None = None,
        *,
        included_ranges: Sequence[Range] | None = None,
        logger: Callable[[LogType, str], None] | None = None,
    ) -> None: ...
    @property
    def language(self) -> Language | None: ...
    @language.setter
    def language(self, language: Language) -> None: ...
    @language.deleter
    def language(self) -> None: ...
    @property
    def included_ranges(self) -> list[Range]: ...
    @included_ranges.setter
    def included_ranges(self, ranges: Sequence[Range]) -> None: ...
    @included_ranges.deleter
    def included_ranges(self) -> None: ...
    @property
    def logger(self) -> Callable[[LogType, str], None] | None: ...
    @logger.setter
    def logger(self, logger: Callable[[LogType, str], None]) -> None: ...
    @logger.deleter
    def logger(self) -> None: ...
    @overload
    def parse(
        self,
        source: ByteString,
        /,
        old_tree: Tree | None = None,
        encoding: Literal["utf8", "utf16", "utf16le", "utf16be"] = "utf8",
    ) -> Tree: ...
    @overload
    def parse(
        self,
        read_callback: Callable[[int, Point], ByteString | None],
        /,
        old_tree: Tree | None = None,
        encoding: Literal["utf8", "utf16", "utf16le", "utf16be"] = "utf8",
        progress_callback: Callable[[int, bool], bool] | None = None,
    ) -> Tree: ...
    def reset(self) -> None: ...
    def print_dot_graphs(self, file: _SupportsFileno | None, /) -> None: ...

class QueryError(ValueError): ...

class QueryPredicate(Protocol):
    def __call__(
        self,
        predicate: str,
        args: list[tuple[str, Literal["capture", "string"]]],
        pattern_index: int,
        captures: dict[str, list[Node]],
    ) -> bool: ...

@final
class Query:
    def __new__(cls, language: Language, source: str, /) -> Self: ...
    @property
    def pattern_count(self) -> int: ...
    @property
    def capture_count(self) -> int: ...
    @property
    def string_count(self) -> int: ...
    def start_byte_for_pattern(self, index: int, /) -> int: ...
    def end_byte_for_pattern(self, index: int, /) -> int: ...
    def is_pattern_rooted(self, index: int, /) -> bool: ...
    def is_pattern_non_local(self, index: int, /) -> bool: ...
    def is_pattern_guaranteed_at_step(self, index: int, /) -> bool: ...
    def capture_name(self, index: int, /) -> str: ...
    def capture_quantifier(
        self,
        pattern_index: int,
        capture_index: int,
        /
    ) -> Literal["", "?", "*", "+"]: ...
    def string_value(self, index: int, /) -> str: ...
    def disable_capture(self, name: str, /) -> None: ...
    def disable_pattern(self, index: int, /) -> None: ...
    def pattern_settings(self, index: int, /) -> dict[str, str | None]: ...
    def pattern_assertions(self, index: int, /) -> dict[str, tuple[str | None, bool]]: ...

@final
class QueryCursor:
    def __init__(self, query: Query, *, match_limit: int = 0xFFFFFFFF) -> None: ...
    @property
    def match_limit(self) -> int: ...
    @match_limit.setter
    def match_limit(self, limit: int) -> None: ...
    @match_limit.deleter
    def match_limit(self) -> None: ...
    @property
    def did_exceed_match_limit(self) -> bool: ...
    def set_max_start_depth(self, depth: int, /) -> None: ...
    def set_byte_range(self, start: int, end: int, /) -> None: ...
    def set_containing_byte_range(self, start: int, end: int, /) -> None: ...
    def set_point_range(
        self,
        start: Point | tuple[int, int],
        end: Point | tuple[int, int],
        /,
    ) -> None: ...
    def set_containing_point_range(
        self,
        start: Point | tuple[int, int],
        end: Point | tuple[int, int],
        /,
    ) -> None: ...
    def captures(
        self,
        node: Node,
        predicate: QueryPredicate | None = None,
        progress_callback: Callable[[int], bool] | None = None,
        /,
    ) -> dict[str, list[Node]]: ...
    def matches(
        self,
        node: Node,
        predicate: QueryPredicate | None = None,
        progress_callback: Callable[[int], bool] | None = None,
        /,
    ) -> list[tuple[int, dict[str, list[Node]]]]: ...

@final
class LookaheadIterator(Iterator[tuple[int, str]]):
    @property
    def language(self) -> Language: ...
    @property
    def current_symbol(self) -> int: ...
    @property
    def current_symbol_name(self) -> str: ...
    def reset(self, state: int, /, language: Language | None = None) -> bool: ...
    def names(self) -> list[str]: ...
    def symbols(self) -> list[int]: ...
    def __next__(self) -> tuple[int, str]: ...

@final
class Point(tuple[int, int]):
    def __new__(cls, row: int, column: int) -> Self: ...
    @property
    def row(self) -> int: ...
    @property
    def column(self) -> int: ...
    def edit(
        self,
        start_byte: int,
        old_end_byte: int,
        new_end_byte: int,
        start_point: Point | tuple[int, int],
        old_end_point: Point | tuple[int, int],
        new_end_point: Point | tuple[int, int],
    ) -> tuple[Point, int]: ...
    def __repr__(self) -> str: ...

@final
class Range:
    def __init__(
        self,
        start_point: Point | tuple[int, int],
        end_point: Point | tuple[int, int],
        start_byte: int,
        end_byte: int,
    ) -> None: ...
    @property
    def start_point(self) -> Point: ...
    @property
    def end_point(self) -> Point: ...
    @property
    def start_byte(self) -> int: ...
    @property
    def end_byte(self) -> int: ...
    def edit(
        self,
        start_byte: int,
        old_end_byte: int,
        new_end_byte: int,
        start_point: Point | tuple[int, int],
        old_end_point: Point | tuple[int, int],
        new_end_point: Point | tuple[int, int],
    ) -> None: ...
    def __eq__(self, other: Any, /) -> bool: ...
    def __ne__(self, other: Any, /) -> bool: ...
    def __repr__(self) -> str: ...
    def __hash__(self) -> int: ...

LANGUAGE_VERSION: Final[int]

MIN_COMPATIBLE_LANGUAGE_VERSION: Final[int]

__version__: Final[str]
```

---

## The official README, verbatim (from the installed `dist-info/METADATA`)

### Parsing

```python
tree = parser.parse(
    bytes(
        """
def foo():
    if bar:
        baz()
""",
        "utf8"
    )
)
```

> "If you have your source code in some data structure other than a bytes object, you can pass a "read"
> callable to the parse function."
>
> "The read callable can use either the byte offset or point tuple to read from buffer and return source
> code as bytes object. An empty bytes object or None terminates parsing for that line. The bytes must be
> encoded as UTF-8 or UTF-16."

```python
def read_callable_byte_offset(byte_offset, point):
    return src[byte_offset : byte_offset + 1]


tree = parser.parse(read_callable_byte_offset, encoding="utf8")
```

```python
src_lines = ["\n", "def foo():\n", "    if bar:\n", "        baz()\n"]


def read_callable_point(byte_offset, point):
    row, column = point
    if row >= len(src_lines) or column >= len(src_lines[row]):
        return None
    return src_lines[row][column:].encode("utf8")


tree = parser.parse(read_callable_point, encoding="utf8")
```

### Inspecting the tree — note `child_by_field_name`, `children[i]`, `child(i)`

```python
root_node = tree.root_node
assert root_node.type == 'module'
assert root_node.start_point == (1, 0)
assert root_node.end_point == (4, 0)

function_node = root_node.children[0]
assert function_node.type == 'function_definition'
assert function_node.child_by_field_name('name').type == 'identifier'

function_body_node = function_node.child_by_field_name("body")

if_statement_node = function_body_node.child(0)
assert if_statement_node.type == "if_statement"
```

### Walking with a cursor

```python
cursor = tree.walk()

assert cursor.node.type == "module"

assert cursor.goto_first_child()
assert cursor.node.type == "function_definition"

assert cursor.goto_first_child()
assert cursor.node.type == "def"

# Returns `False` because the `def` node has no children
assert not cursor.goto_first_child()

assert cursor.goto_next_sibling()
assert cursor.node.type == "identifier"
```

> "Keep in mind that the cursor can only walk into children of the node that it started from."

### Incremental re-parsing

```python
tree.edit(
    start_byte=5,
    old_end_byte=5,
    new_end_byte=5 + 2,
    start_point=(0, 5),
    old_end_point=(0, 5),
    new_end_point=(0, 5 + 2),
)
```

```python
new_tree = parser.parse(new_src, tree)
```

> "This will run much faster than if you were parsing from scratch."

`Tree.changed_ranges` is called on the **old** tree:

```python
for changed_range in tree.changed_ranges(new_tree):
```

### Queries — the 0.26 shape

```python
query = Query(
    PY_LANGUAGE,
    """
(function_definition
  name: (identifier) @function.def
  body: (block) @function.block)

(call
  function: (identifier) @function.call
  arguments: (argument_list) @function.args)
""",
)
```

**Captures — via `QueryCursor`, returning a dict keyed by capture name:**

```python
query_cursor = QueryCursor(query)
captures = query_cursor.captures(tree.root_node)
assert len(captures) == 4
assert captures["function.def"][0] == function_name_node
```

**Matches — grouped per match, a list of `(pattern_index, captures_dict)`:**

```python
matches = query_cursor.matches(tree.root_node)
assert len(matches) == 2

# first match
assert matches[0][1]["function.def"] == [function_name_node]
assert matches[0][1]["function.block"] == [function_body_node]
```

> "The difference between the two methods is that `QueryCursor.matches()` groups captures into matches,
> which is much more useful when your captures within a query relate to each other."

---

## Package facts (from installed METADATA, verbatim)

```
Name: tree-sitter
Version: 0.26.0
Requires-Python: >=3.10
Project-URL, Homepage: https://tree-sitter.github.io/tree-sitter/
Project-URL, Source: https://github.com/tree-sitter/py-tree-sitter
Project-URL, Documentation: https://tree-sitter.github.io/py-tree-sitter/
```

> "The package has no library dependencies and provides pre-compiled wheels for all major platforms."
