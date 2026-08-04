# LlamaIndex — running with NO LLM and NO embedding model, fully offline (0.14.23)

- **Source (authoritative):** the installed package,
  `C:\Users\dudib\AppData\Local\Programs\Python\Python314\Lib\site-packages\llama_index\core\`
  — `llama-index-core 0.14.23`
- **Retrieved / verified:** 2026-08-04

This is the page that governs every other decision in this project. All text below is
`VERBATIM (installed source)` unless marked otherwise.

---

## 1. `Settings.llm` is NOT lazy-safe — touching it raises

`llama_index/core/settings.py`:

```python
    # ---- LLM ----

    @property
    def llm(self) -> LLM:
        """Get the LLM."""
        if self._llm is None:
            self._llm = resolve_llm("default")

        if self._callback_manager is not None:
            self._llm.callback_manager = self._callback_manager

        return self._llm
```

`llama_index/core/llms/utils.py`:

```python
def resolve_llm(
    llm: Optional[LLMType] = None, callback_manager: Optional[CallbackManager] = None
) -> LLM:
    """Resolve LLM from string or LLM instance."""
    from llama_index.core.settings import Settings
    ...
    if llm == "default":
        # if testing return mock llm
        if os.getenv("IS_TESTING"):
            from llama_index.core.llms.mock import MockLLM

            llm = MockLLM()
            llm.callback_manager = callback_manager or Settings.callback_manager
            return llm

        # return default OpenAI model. If it fails, return LlamaCPP
        try:
            from llama_index.llms.openai import OpenAI  # pants: no-infer-dep
            from llama_index.llms.openai.utils import (
                validate_openai_api_key,
            )  # pants: no-infer-dep

            llm = OpenAI()
            validate_openai_api_key(llm.api_key)  # type: ignore
        except ImportError:
            raise ImportError(
                "`llama-index-llms-openai` package not found, "
                "please run `pip install llama-index-llms-openai`"
            )
        except ValueError as e:
            raise ValueError(
                "\n******\n"
                "Could not load OpenAI model. "
                "If you intended to use OpenAI, please check your OPENAI_API_KEY.\n"
                "Original error:\n"
                f"{e!s}"
                "\n******"
            )
```

and, for an explicit `None`:

```python
    elif llm is None:
        from llama_index.core.llms.mock import MockLLM

        print("LLM is explicitly disabled. Using MockLLM.")
        llm = MockLLM()
```

### Consequences — the three that matter

1. **`llama-index-llms-openai` is NOT installed in this environment** (verified: no `llama_index_llms_openai`
   dist-info in `site-packages`). Therefore **any code path that reads `Settings.llm` raises `ImportError`**
   at that moment, with the message `` `llama-index-llms-openai` package not found ``.
2. The **only** built-in escape hatch is the environment variable **`IS_TESTING`**. If set to any non-empty
   value, `resolve_llm("default")` returns a `MockLLM()`. This is the mechanism behind "`Settings.llm` is
   `MockLLM` in tests".
3. `resolve_llm(None)` returns `MockLLM` — but note `Settings.llm` never calls it with `None`; it calls it
   with the string `"default"`. Assigning `Settings.llm = None` goes through the **setter**
   (`self._llm = resolve_llm(llm)`) and does yield a `MockLLM`, printing
   `LLM is explicitly disabled. Using MockLLM.` to stdout.

**Practical rule for this project:** any component whose `__init__` contains `llm or Settings.llm` is
LLM-requiring *at construction time*, even if it never generates a token. Passing an explicit
`llm=MockLLM()` is what makes such a component usable — not the fact that it doesn't need an LLM logically.

---

## 2. The tokenizer is offline — the BPE cache ships in the wheel

`llama_index/core/utils.py`:

```python
def get_tokenizer(model_name: str = "gpt-3.5-turbo") -> Callable[[str], List]:
    import llama_index.core

    if llama_index.core.global_tokenizer is None:
        tiktoken_import_err = (
            "`tiktoken` package not found, please run `pip install tiktoken`"
        )
        try:
            import tiktoken
        except ImportError:
            raise ImportError(tiktoken_import_err)

        # set tokenizer cache temporarily
        should_revert = False
        if "TIKTOKEN_CACHE_DIR" not in os.environ:
            should_revert = True
            os.environ["TIKTOKEN_CACHE_DIR"] = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "_static/tiktoken_cache",
            )

        enc = tiktoken.encoding_for_model(model_name)
        tokenizer = partial(enc.encode, allowed_special="all")
        set_global_tokenizer(tokenizer)

        if should_revert:
            del os.environ["TIKTOKEN_CACHE_DIR"]

    assert llama_index.core.global_tokenizer is not None
    return llama_index.core.global_tokenizer
```

**Verified on disk 2026-08-04** — `llama_index/core/_static/tiktoken_cache/` contains:

```
.gitignore
9b5ad71b2ce5302211f9c61530b329a4922fc6a4
fb374d419588a4632f3f557e76b4b70aebbca790
```

Those two blobs are the cached BPE ranks. Because `TIKTOKEN_CACHE_DIR` is pointed at them before
`encoding_for_model` is called, **`get_tokenizer()` does not hit the network.** `tiktoken 0.13.0` is installed.

**Override hook** — set your own and `get_tokenizer()` never touches tiktoken at all:

```python
def set_global_tokenizer(tokenizer: Union[Tokenizer, Callable[[str], list]]) -> None:
    import llama_index.core

    if isinstance(tokenizer, Tokenizer):
        llama_index.core.global_tokenizer = tokenizer.encode
    else:
        llama_index.core.global_tokenizer = tokenizer
```

`global_tokenizer` is a module-level global on `llama_index.core`, so one call configures the whole process.

---

## 3. NLTK data is offline too — and Hebrew stopwords ship

`llama_index/core/utils.py`:

```python
    def wait_for_nltk_check(self) -> None:
        """Initialize NLTK data download."""
        from nltk.data import path as nltk_path

        # Set up NLTK data directory
        if "NLTK_DATA" in os.environ:
            self._nltk_data_dir = str(Path(os.environ["NLTK_DATA"]))
        else:
            # 1. Check for bundled static cache first
            bundled_path = (
                Path(os.path.dirname(os.path.abspath(__file__))) / "_static/nltk_cache"
            )

            # Use bundled cache ONLY if it exists and is not empty
            if bundled_path.exists() and any(bundled_path.iterdir()):
                self._nltk_data_dir = str(bundled_path)
            else:
                # 2. Fallback to user cache (prevents crash if bundled cache is missing)
                path = Path(platformdirs.user_cache_dir("llama_index"))
                self._nltk_data_dir = str(path / "_static/nltk_cache")
```

```python
    def _download_nltk_data(self) -> None:
        """Download NLTK data packages in the background."""
        from nltk import download
        from nltk.data import find as nltk_find

        try:
            # Download stopwords
            try:
                nltk_find("corpora/stopwords", paths=[self._nltk_data_dir])
            except LookupError:
                download("stopwords", download_dir=self._nltk_data_dir, quiet=True)

            # Download punkt tokenizer
            try:
                nltk_find("tokenizers/punkt_tab", paths=[self._nltk_data_dir])
            except LookupError:
                download("punkt_tab", download_dir=self._nltk_data_dir, quiet=True)

        except Exception as e:
            print(f"NLTK download error: {e}")
```

**Verified on disk 2026-08-04** — `llama_index/core/_static/nltk_cache/` is present and non-empty:

- `corpora/stopwords.zip` and an unpacked `corpora/stopwords/` with 30+ languages, **including
  `corpora/stopwords/hebrew`**.
- `tokenizers/punkt_tab.zip` and an unpacked `tokenizers/punkt_tab/` with czech, danish, dutch, english,
  estonian, finnish, french, german, greek, italian, malayalam, norwegian, polish, portuguese, russian,
  slovene, … **There is no `punkt_tab/hebrew`.**

Because the bundled cache exists and is non-empty, the `nltk_find` calls succeed and `download(...)` is
never reached. **No network.** `nltk 3.10.1` is installed.

The stopwords actually used by LlamaIndex's own keyword extraction are English-only:

```python
    @property
    def stopwords(self) -> List[str]:
        """Get stopwords, ensuring data is downloaded."""
        if self._stopwords is None:
            # Wait for stopwords to be available
            self.wait_for_nltk_check()

            from nltk.corpus import stopwords
            from nltk.tokenize import PunktSentenceTokenizer

            self._stopwords = stopwords.words("english")
            self._punkt_tokenizer = PunktSentenceTokenizer()

        return self._stopwords
```

Note `stopwords.words("english")` is hard-coded. The Hebrew list is on disk but LlamaIndex never loads it;
reaching it requires calling `nltk.corpus.stopwords.words("hebrew")` yourself.

---

## 4. Verified inventory of this environment (2026-08-04)

From `site-packages/*.dist-info/METADATA`:

| Package | Version | Relevance |
|---|---|---|
| `llama-index-core` | 0.14.23 | the framework |
| `llama-index-readers-file` | 0.6.0 | file readers |
| `llama-index-workflows` | 2.22.2 | transitive |
| `llama-index-instrumentation` | 0.5.0 | transitive |
| `tiktoken` | 0.13.0 | tokenizer, cache bundled |
| `nltk` | 3.10.1 | sentence splitting, cache bundled |
| `pypdf` | 6.14.2 | `PDFReader` backend |
| `pymupdf` | 1.28.0 | `PyMuPDFReader` backend |
| `beautifulsoup4` | 4.15.0 | `HTMLNodeParser` / `HTMLTagReader` |
| `html2text` | 2025.4.15 | `MarkdownReader` helper |
| `openpyxl` | 3.1.5 | `PandasExcelReader` |
| `striprtf` | 0.0.26 | `RTFReader` |
| `pandas` | 2.3.3 | tabular readers |
| `numpy` | 2.5.1 | — |

**Absent, and therefore blocking the features that need them:**

| Missing package | Blocks |
|---|---|
| `llama-index-llms-openai` | `Settings.llm` (raises `ImportError`) |
| `tree_sitter_language_pack` | `CodeSplitter` (raises `ImportError`) |
| `llama-index-retrievers-bm25` (+ `bm25s`, `PyStemmer`) | `BM25Retriever` |
| `docx2txt` | `DocxReader` |
