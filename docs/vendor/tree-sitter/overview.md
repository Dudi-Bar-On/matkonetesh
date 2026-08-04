---
name: tree-sitter-overview
description: "tree-sitter — query/pattern syntax (S-expressions, captures, fields, wildcards, negated fields, supertypes) and where the grammar defines node types (tree-sitter.github.io)"
type: reference
---

<!-- source: https://tree-sitter.github.io/tree-sitter/ -->
<!-- source: https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY, AND IT IS INCOMPLETE.**
> Retrieved 2026-08-05 via `WebFetch`, which is **model-mediated** and refused verbatim reproduction
> (~125-character quote cap). Bash was disabled, so `node -e "fetch(...)"` and `curl` were unavailable.
> Several query features **were not returned by the fetch** and are marked **NOT CAPTURED** below rather
> than filled in from memory. **Do not treat absence here as absence in tree-sitter.**
>
> **For the Python API, do not use this file — use `python-binding.md`**, which is verbatim from the
> installed 0.26.0 stub.

---

## Where node types come from — the root of our `Header_2` mistake

**Node type names are defined by the individual GRAMMAR, not by tree-sitter and not by the Python
binding.** `python-binding.md` tells you `node.type` exists; it cannot tell you which values are legal.
Those come from the grammar package (`tree_sitter_python`, `tree_sitter_javascript`, ...).

**Enumerate them at runtime instead of guessing.** The installed API exposes exactly this
(`VERBATIM`, from the 0.26.0 stub):

```python
    @property
    def node_kind_count(self) -> int: ...
    def node_kind_for_id(self, id: int, /) -> str | None: ...
    def id_for_node_kind(self, kind: str, named: bool, /) -> int | None: ...
    def node_kind_is_named(self, id: int, /) -> bool: ...
```

`id_for_node_kind("Header_2", True)` returning `None` is a **one-line proof** that a node type does not
exist. Use it before shipping a query that silently matches nothing.

## Query syntax — what the fetch confirmed

**Named nodes** are S-expressions in parentheses:

```
(binary_expression (number_literal) (number_literal))
```

**Fields** use `name:` prefixes:

```
left: (member_expression object: (call_expression))
```

**Captures** are an `@name` suffix:

```
(identifier) @class_name
```

**Anonymous nodes** are quoted strings — e.g. `operator: "!="`, alongside named nodes like `right: (null)`.

**Wildcards:** `(_)` matches any **named** node; bare `_` matches **any** node, named or anonymous.
Example given: `(call (_) @call.inner)`.

**Negated fields:** prefix `!` to require the field's **absence** — `!type_parameters` matches nodes
lacking that field.

**Error/missing nodes:** `(ERROR)` for unrecognised text; `(MISSING)` for nodes inserted by error recovery.

**Supertypes:** the `(supertype/subtype)` form, e.g. `(expression/binary_expression)`, matches a subtype
through its supertype. (The installed `Language` class correspondingly exposes `supertypes` and
`subtypes(...)` — see `python-binding.md`.)

## NOT CAPTURED — fetch did not return these

The following were explicitly asked for and **not returned**; they are documented on the page but this
retrieval failed to extract them. **Consult the URL, do not improvise:**

- **Quantifiers** `?`, `*`, `+` — *note*: their existence is nevertheless confirmed independently by the
  installed stub, which returns them as a literal type:
  `def capture_quantifier(...) -> Literal["", "?", "*", "+"]` (`VERBATIM`, 0.26.0). The **semantics**
  were not captured.
- **Alternations** `[...]` and **groups** `(...)` — not captured.
- **Anchors** — the `.` operator and its meaning in different positions — not captured.
- **Predicates** `#eq?`, `#match?`, `#any-of?` — not captured, including the important point about
  whether the core library evaluates them.

> **On predicates, one thing IS settled by the installed stub:** the binding takes an explicit
> `predicate: QueryPredicate | None` callback on `QueryCursor.captures()` / `.matches()`, and defines
> `QueryPredicate` as a `Protocol` the caller implements. That is consistent with predicate evaluation
> being the **caller's** responsibility rather than the core library's — but the doc sentence stating so
> was **not captured**, so this is an inference from the API shape, not a quotation.

---

## Re-pull raw when Bash is available

```
node -e "fetch('https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html').then(r=>r.text()).then(t=>require('fs').writeFileSync('ts-query-syntax.raw.html',t))"
```

Sibling chapters under `using-parsers/queries/` cover the operators listed as NOT CAPTURED above.

---

## ⚠️ RE-CHECKED 2026-08-05 — the "stale finding" suspicion was wrong

The research pass noticed that `tree_sitter_language_pack` **1.14.1 is installed** and exports
`get_parser`/`get_language`, and flagged that the project's "no windows-x86_64 build" note might
simply be out of date. It is a fair suspicion and it is worth writing down that it was tested
rather than argued about. Run on this machine:

```
tree_sitter_language_pack 1.14.1  ·  get_parser present: True
  get_parser('javascript') -> DownloadError: No pre-built parsers available for
                              platform 'windows-x86_64'. Available: [linux-x86_64,
                              macos-arm64, linux-aarch64, macos-x86_64]
  get_parser('python')     -> same
  get_parser('typescript') -> same
```

**The package and the API are present; the parsers are not.** The original finding stands, and so
does the workaround: `src/memory/agent_memory.py::_code_parser` builds `Parser(Language(...))`
from the per-language wheels (`tree_sitter_javascript`, `tree_sitter_python`,
`tree_sitter_typescript`), which do have Windows builds, and passes it to `CodeSplitter(parser=…)`.

The distinction that cost an hour to find, stated plainly: **a language PACK with no Windows build
is not the same fact as a LANGUAGE with no Windows wheel.**
