# LlamaIndex — Node Parsers (0.14.23)

- **Source (docs site):** https://developers.llamaindex.ai/python/framework/module_guides/loading/node_parsers/modules/
  (redirected from `https://docs.llamaindex.ai/en/stable/module_guides/loading/node_parsers/modules/`)
- **Source (authoritative):** the installed package,
  `C:\Users\dudib\AppData\Local\Programs\Python\Python314\Lib\site-packages\llama_index\core\node_parser\`
  — `llama-index-core 0.14.23`
- **Retrieved:** 2026-08-04

> **Provenance note.** Text marked `VERBATIM (installed source)` is copied character-for-character out of the
> installed `.py` files and is authoritative for this project. Text marked `docs site (paraphrased)` came back
> through a summarising fetch layer and must NOT be treated as an API contract. Where the two differ, the
> installed source wins.

---

## The full export list

`VERBATIM (installed source)` — `llama_index/core/node_parser/__init__.py`

```python
__all__ = [
    "TokenTextSplitter",
    "SentenceSplitter",
    "CodeSplitter",
    "SimpleFileNodeParser",
    "HTMLNodeParser",
    "MarkdownNodeParser",
    "JSONNodeParser",
    "SentenceWindowNodeParser",
    "SemanticSplitterNodeParser",
    "SemanticDoubleMergingSplitterNodeParser",
    "LanguageConfig",
    "NodeParser",
    "HierarchicalNodeParser",
    "TextSplitter",
    "MarkdownElementNodeParser",
    "MetadataAwareTextSplitter",
    "LangchainNodeParser",
    "UnstructuredElementNodeParser",
    "get_leaf_nodes",
    "get_root_nodes",
    "get_child_nodes",
    "get_deeper_nodes",
    "LlamaParseJsonNodeParser",
    # deprecated, for backwards compatibility
    "SimpleNodeParser",
]
```

Also present in that file:

```python
# deprecated, for backwards compatibility
SimpleNodeParser = SentenceSplitter
```

---

## MarkdownNodeParser — what we already use

`VERBATIM (installed source)` — `node_parser/file/markdown.py`

```python
class MarkdownNodeParser(NodeParser):
    """
    Markdown node parser.

    Splits a document into Nodes using Markdown header-based splitting logic.
    Each node contains its text content and the path of headers leading to it.

    Args:
        include_metadata (bool): whether to include metadata in nodes
        include_prev_next_rel (bool): whether to include prev/next relationships
        header_path_separator (str): separator char used for section header path metadata

    """

    header_path_separator: str = Field(
        default="/", description="Separator char used for section header path metadata."
    )
```

The only metadata key it writes:

```python
    def _build_node_from_split(
        self,
        text_split: str,
        node: BaseNode,
        header_path: str,
    ) -> TextNode:
        """Build node from single text split."""
        node = build_nodes_from_splits([text_split], node, id_func=self.id_func)[0]

        if self.include_metadata:
            separator = self.header_path_separator
            node.metadata["header_path"] = (
                # ex: "/header1/header2/" || "/"
                separator + header_path + separator if header_path else separator
            )

        return node
```

**Confirmed: there is no `Header_1` / `Header_2` key in 0.14.23.** `header_path` is the only key emitted.
Deriving `Header_N` by splitting `header_path` (what `src/memory/agent_memory.py` does) is the correct
approach for this version.

Two further verbatim behaviours worth knowing:

```python
            # Track if we're inside a code block to avoid parsing headers in code
            if line.lstrip().startswith("```"):
                code_block = not code_block
```

```python
                    # Compare against top-of-stack item's markdown level.
                    # Pop headers of equal or higher markdown level; not necessarily current stack size / depth.
                    # Hierarchy depth gets deeper one level at a time, but markdown headers can jump from H1 to H3, for example.
                    while header_stack and header_stack[-1][0] >= header_level:
                        header_stack.pop()
```

Header regex: `re.match(r"^(#+)\s(.*)", line)`.

**Note:** the header path written to a node is `header_stack[:-1]` — i.e. the *ancestor* path, excluding the
node's own heading. The node's own heading is present only in the text body (`current_section` starts with
`"#" * header_level + f" {header_text}\n"`).

**Note:** `MarkdownNodeParser` sets no `PARENT` relationship, so `node.parent_node` is always `None` for its
output.

---

## CodeSplitter

`VERBATIM (installed source)` — `node_parser/text/code.py`

```python
DEFAULT_CHUNK_LINES = 40
DEFAULT_LINES_OVERLAP = 15
DEFAULT_MAX_CHARS = 1500
DEFAULT_MAX_TOKENS = 512


class CodeSplitter(TextSplitter):
    """
    Split code using a AST parser.

    Thank you to Kevin Lu / SweepAI for suggesting this elegant code splitting solution.
    https://docs.sweep.dev/blogs/chunking-2m-files

    Supports both character-based and token-based chunking modes for more precise
    control over chunk sizes when working with language models.
    """
```

Full constructor:

```python
    def __init__(
        self,
        language: str,
        chunk_lines: int = DEFAULT_CHUNK_LINES,
        chunk_lines_overlap: int = DEFAULT_LINES_OVERLAP,
        max_chars: int = DEFAULT_MAX_CHARS,
        count_mode: Literal["token", "char"] = "char",
        max_tokens: int = DEFAULT_MAX_TOKENS,
        tokenizer: Optional[Callable] = None,
        parser: Any = None,
        callback_manager: Optional[CallbackManager] = None,
        include_metadata: bool = True,
        include_prev_next_rel: bool = True,
        id_func: Optional[Callable[[int, Document], str]] = None,
    ) -> None:
```

**The hard dependency** — verbatim:

```python
        if parser is None:
            try:
                import tree_sitter_language_pack  # pants: no-infer-dep

                parser = tree_sitter_language_pack.get_parser(language)  # type: ignore
            except ImportError:
                raise ImportError(
                    "Please install tree_sitter_language_pack to use CodeSplitter."
                    "Or pass in a parser object."
                )
```

and a version guard:

```python
        if not hasattr(parser, "parse"):
            raise ImportError(
                "The installed version of tree-sitter-language-pack is not compatible. "
                "Please install a compatible version: "
                "pip install 'tree-sitter-language-pack<1.0'"
            )
```

**Failure mode on unparseable input** — verbatim:

```python
            if (
                not tree.root_node.children
                or tree.root_node.children[0].type != "ERROR"
            ):
                ...
                return chunks
            else:
                raise ValueError(f"Could not parse code with language {self.language}.")
```

**Status in this project (verified 2026-08-04):** `tree_sitter_language_pack` is **NOT installed** — a glob of
`site-packages` for `tree_sitter*` returns nothing. `CodeSplitter` therefore raises `ImportError` today.
No LLM and no embedding model is involved; it is a pure AST transformation.

**Tokenizer caveat:** `self._tokenizer = tokenizer or get_tokenizer()` runs unconditionally in `__init__`,
even when `count_mode="char"`. See `offline-and-no-model.md`.

---

## SentenceSplitter

`VERBATIM (installed source)` — `node_parser/text/sentence.py`

```python
SENTENCE_CHUNK_OVERLAP = 200
CHUNKING_REGEX = "[^,.;。？！]+[,.;。？！]?|[,.;。？！]"
DEFAULT_PARAGRAPH_SEP = "\n\n\n"


class SentenceSplitter(MetadataAwareTextSplitter):
    """
    Parse text with a preference for complete sentences.

    In general, this class tries to keep sentences and paragraphs together. Therefore
    compared to the original TokenTextSplitter, there are less likely to be
    hanging sentences or parts of sentences at the end of the node chunk.
    """
```

```python
    def __init__(
        self,
        separator: str = " ",
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = SENTENCE_CHUNK_OVERLAP,
        tokenizer: Optional[Callable] = None,
        paragraph_separator: str = DEFAULT_PARAGRAPH_SEP,
        chunking_tokenizer_fn: Optional[Callable[[str], List[str]]] = None,
        secondary_chunking_regex: Optional[str] = CHUNKING_REGEX,
        callback_manager: Optional[CallbackManager] = None,
        include_metadata: bool = True,
        include_prev_next_rel: bool = True,
        id_func: Optional[Callable] = None,
    ):
```

Guard, verbatim:

```python
        if chunk_overlap > chunk_size:
            raise ValueError(
                f"Got a larger chunk overlap ({chunk_overlap}) than chunk size "
                f"({chunk_size}), should be smaller."
            )
```

Dependencies it wires up:

```python
        self._chunking_tokenizer_fn = (
            chunking_tokenizer_fn or split_by_sentence_tokenizer()
        )
        self._tokenizer = tokenizer or get_tokenizer()
```

`split_by_sentence_tokenizer()` uses NLTK punkt; `get_tokenizer()` uses tiktoken. **Both ship bundled
offline caches** — see `offline-and-no-model.md`. No LLM, no embeddings.

**Note on the `CHUNKING_REGEX`:** it is a sentence-terminator set of `, . ; 。 ？ ！`. Hebrew uses the same
`.` `,` `;` terminators, so it degrades gracefully, but the NLTK punkt models bundled do not include Hebrew.

---

## HierarchicalNodeParser

`VERBATIM (installed source)` — `node_parser/relational/hierarchical.py`

```python
    chunk_sizes: Optional[List[int]] = Field(
        default=None,
        description=(
            "The chunk sizes to use when splitting documents, in order of level."
        ),
    )
    node_parser_ids: List[str] = Field(
        default_factory=list,
        description=(
            "List of ids for the node parsers to use when splitting documents, "
            + "in order of level (first id used for first level, etc.)."
        ),
    )
    node_parser_map: Dict[str, NodeParser] = Field(
        description="Map of node parser id to node parser.",
    )
```

```python
    @classmethod
    def from_defaults(
        cls,
        chunk_sizes: Optional[List[int]] = None,
        chunk_overlap: int = 20,
        node_parser_ids: Optional[List[str]] = None,
        node_parser_map: Optional[Dict[str, NodeParser]] = None,
        include_metadata: bool = True,
        include_prev_next_rel: bool = True,
        callback_manager: Optional[CallbackManager] = None,
    ) -> "HierarchicalNodeParser":
        callback_manager = callback_manager or CallbackManager([])

        if node_parser_ids is None:
            if chunk_sizes is None:
                chunk_sizes = [2048, 512, 128]

            node_parser_ids = [f"chunk_size_{chunk_size}" for chunk_size in chunk_sizes]
            node_parser_map = {}
            for chunk_size, node_parser_id in zip(chunk_sizes, node_parser_ids):
                node_parser_map[node_parser_id] = SentenceSplitter(
                    chunk_size=chunk_size,
                    callback_manager=callback_manager,
                    chunk_overlap=chunk_overlap,
                    include_metadata=include_metadata,
                    include_prev_next_rel=include_prev_next_rel,
                )
        else:
            if chunk_sizes is not None:
                raise ValueError("Cannot specify both node_parser_ids and chunk_sizes.")
            if node_parser_map is None:
                raise ValueError(
                    "Must specify node_parser_map if using node_parser_ids."
                )
```

Relationship helpers, verbatim:

```python
def _add_parent_child_relationship(parent_node: BaseNode, child_node: BaseNode) -> None:
    """Add parent/child relationship between nodes."""
    child_list = parent_node.child_nodes or []
    child_list.append(child_node.as_related_node_info())
    parent_node.relationships[NodeRelationship.CHILD] = child_list

    child_node.relationships[NodeRelationship.PARENT] = (
        parent_node.as_related_node_info()
    )


def get_leaf_nodes(nodes: List[BaseNode]) -> List[BaseNode]:
    """Get leaf nodes."""
    leaf_nodes = []
    for node in nodes:
        if NodeRelationship.CHILD not in node.relationships:
            leaf_nodes.append(node)
    return leaf_nodes


def get_root_nodes(nodes: List[BaseNode]) -> List[BaseNode]:
    """Get root nodes."""
    root_nodes = []
    for node in nodes:
        if NodeRelationship.PARENT not in node.relationships:
            root_nodes.append(node)
    return root_nodes
```

**No LLM, no embeddings** — it composes `SentenceSplitter`s. This is the ONLY core parser that populates
`node.parent_node` / `node.child_nodes`.

---

## JSONNodeParser

`VERBATIM (installed source)` — `node_parser/file/json.py`

```python
class JSONNodeParser(NodeParser):
    """
    JSON node parser.

    Splits a document into Nodes using custom JSON splitting logic.

    Args:
        include_metadata (bool): whether to include metadata in nodes
        include_prev_next_rel (bool): whether to include prev/next relationships

    """
```

```python
    def get_nodes_from_node(self, node: BaseNode) -> List[TextNode]:
        """Get nodes from document."""
        text = node.get_content(metadata_mode=MetadataMode.NONE)
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Handle invalid JSON input here
            return []

        json_nodes = []
        if isinstance(data, dict):
            lines = [*self._depth_first_yield(data, 0, [])]
            json_nodes.extend(
                build_nodes_from_splits(["\n".join(lines)], node, id_func=self.id_func)
            )
        elif isinstance(data, list):
            for json_object in data:
                lines = [*self._depth_first_yield(json_object, 0, [])]
                json_nodes.extend(
                    build_nodes_from_splits(
                        ["\n".join(lines)], node, id_func=self.id_func
                    )
                )
        else:
            raise ValueError("JSON is invalid")

        return json_nodes
```

```python
    def _depth_first_yield(
        self, json_data: Dict, levels_back: int, path: List[str]
    ) -> Generator[str, None, None]:
        """
        Do depth first yield of all of the leaf nodes of a JSON.

        Combines keys in the JSON tree using spaces.

        If levels_back is set to 0, prints all levels.

        """
```

**Two traps, verbatim from the source above:** a `dict` input produces **exactly one node** regardless of
size (all leaves joined with `\n`), and invalid JSON returns `[]` **silently** rather than raising.
No LLM, no embeddings.

---

## SemanticSplitterNodeParser — requires embeddings

`VERBATIM (installed source)` — `node_parser/text/semantic_splitter.py`

```python
class SemanticSplitterNodeParser(NodeParser):
    """
    Semantic node parser.

    Splits a document into Nodes, with each node being a group of semantically related sentences.

    Args:
        buffer_size (int): number of sentences to group together when evaluating semantic similarity
        embed_model: (BaseEmbedding): embedding model to use
        sentence_splitter (Optional[Callable]): splits text into sentences
        breakpoint_percentile_threshold (int): dissimilarity threshold for creating semantic breakpoints, lower value will generate more nodes
        include_metadata (bool): whether to include metadata in nodes
        include_prev_next_rel (bool): whether to include prev/next relationships
```

```python
    embed_model: SerializeAsAny[BaseEmbedding] = Field(
        description="The embedding model to use to for semantic comparison",
    )
```

**`embed_model` is a required pydantic field with no default.** This parser cannot be constructed without an
embedding model. Hard-excluded under the no-model constraint.

`docs site (paraphrased)`: "The documentation notes that semantic chunking works primarily with English and
may require threshold tuning."

---

## Other parsers, briefly

`docs site (paraphrased)` — treat as orientation only, not as an API contract:

- **SimpleFileNodeParser**: "Automatically selects the appropriate parser for different file types."
  Recommended in combination with `FlatFileReader`.
- **HTMLNodeParser**: "Uses BeautifulSoup to process raw HTML. Default tags include
  `["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "b", "i", "u", "section"]`, with customization available."
  (`beautifulsoup4 4.15.0` is installed.)
- **TokenTextSplitter**: "Splits text to consistent chunk sizes based on raw token counts."
- **SentenceWindowNodeParser**: "Splits documents into sentences while preserving surrounding context in
  metadata for embedding generation."
- **LangchainNodeParser**: "Wraps existing Langchain text splitters for compatibility." (langchain is not
  installed here.)
- **MarkdownElementNodeParser** / **UnstructuredElementNodeParser** / **LlamaParseJsonNodeParser**: relational
  element parsers. `relational/base_element.py` drives an LLM to summarise extracted tables — **LLM-requiring**.
