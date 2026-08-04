# LlamaIndex — llama-index-readers-file 0.6.0

- **Source (authoritative):** the installed package,
  `C:\Users\dudib\AppData\Local\Programs\Python\Python314\Lib\site-packages\llama_index\readers\file\`
  — `llama-index-readers-file 0.6.0`
- **Source (docs site):** https://developers.llamaindex.ai/python/framework/module_guides/loading/connector/
- **Retrieved:** 2026-08-04

All code is `VERBATIM (installed source)`.

---

## What is exported

`llama_index/readers/file/__init__.py`:

```python
__all__ = [
    "DocxReader",
    "HWPReader",
    "PDFReader",
    "EpubReader",
    "FlatReader",
    "HTMLTagReader",
    "ImageCaptionReader",
    "ImageReader",
    "ImageVisionLLMReader",
    "IPYNBReader",
    "MarkdownReader",
    "MboxReader",
    "PptxReader",
    "PandasCSVReader",
    "PandasExcelReader",
    "VideoAudioReader",
    "UnstructuredReader",
    "PyMuPDFReader",
    "ImageTabularChartReader",
    "XMLReader",
    "PagedCSVReader",
    "CSVReader",
    "RTFReader",
]
```

---

## Availability in THIS environment (verified 2026-08-04)

Determined by reading each reader's `raise ImportError(...)` guard and checking `site-packages`.

| Reader | Extra dependency | Installed here? | Needs a model? |
|---|---|---|---|
| `PDFReader` | `pypdf` | ✅ 6.14.2 | no |
| `PyMuPDFReader` | `pymupdf` | ✅ 1.28.0 | no |
| `CSVReader` / `PagedCSVReader` | stdlib `csv` | ✅ | no |
| `PandasCSVReader` / `PandasExcelReader` | `pandas`, `openpyxl` | ✅ 2.3.3 / 3.1.5 | no |
| `XMLReader` | stdlib | ✅ | no |
| `HTMLTagReader` | `bs4` | ✅ 4.15.0 | no |
| `MarkdownReader` | `html2text` | ✅ 2025.4.15 | no |
| `RTFReader` | `striprtf` | ✅ 0.0.26 | no |
| `FlatReader` | none | ✅ | no |
| `MboxReader` | `beautifulsoup4` | ✅ | no |
| `VideoAudioReader` | `tinytag` (+ whisper for transcription) | partial | transcription = model |
| `DocxReader` | `docx2txt` | ❌ | no |
| `IPYNBReader` | `nbconvert` | ❌ | no |
| `EpubReader` | `EbookLib`, `html2text` | ❌ (`EbookLib` missing) | no |
| `PptxReader` | `python-pptx` (+ torch/transformers for image captions) | ❌ | image caption = model |
| `HWPReader` | — | (Korean HWP) | no |
| `UnstructuredReader` | `unstructured` | ❌ | no |
| `ImageReader` | `pytesseract` **or** `torch transformers sentencepiece Pillow` | ❌ | OCR/model |
| `ImageCaptionReader` | `torch transformers sentencepiece Pillow` | ❌ | **model** |
| `ImageVisionLLMReader` | `torch transformers sentencepiece Pillow` | ❌ | **model** |
| `ImageTabularChartReader` | `torch transformers Pillow` | ❌ | **model** |

The exact guard messages, verbatim:

```
"pypdf is required to read PDF files: `pip install pypdf`"
"docx2txt is required to read Microsoft Word files: `pip install docx2txt`"
"Please install extra dependencies that are required for the EpubReader: `pip install EbookLib html2text`"
"`beautifulsoup4` package not found: `pip install beautifulsoup4`"
"bs4 is required to read HTML files."
"Please install extra dependencies that are required for the ImageReader when text_type is 'plain_text': `pip install pytesseract`"
"Please install extra dependencies that are required for the ImageCaptionReader: `pip install torch transformers sentencepiece Pillow`"
"Please install nbconvert 'pip install nbconvert' "
"Please install extra dependencies that are required for the ImageCaptionReader: `pip install torch transformers Pillow`"
"Unstructured is not installed. Please install it using 'pip install -U unstructured'."
"csv module is required to read CSV files."
```

---

## `PDFReader` — full source of the part that matters

```python
class PDFReader(BaseReader):
    """PDF parser."""

    def __init__(self, return_full_document: Optional[bool] = False) -> None:
        """
        Initialize PDFReader.
        """
        self.return_full_document = return_full_document

    @retry(
        stop=stop_after_attempt(RETRY_TIMES),
    )
    def load_data(
        self,
        file: Union[Path, PurePosixPath],
        extra_info: Optional[Dict] = None,
        fs: Optional[AbstractFileSystem] = None,
    ) -> List[Document]:
        """Parse file."""
        fs = fs or get_default_fs()
        _Path = Path if is_default_fs(fs) else PurePosixPath
        if not isinstance(file, (Path, PurePosixPath)):
            file = _Path(file)

        try:
            import pypdf
        except ImportError:
            raise ImportError(
                "pypdf is required to read PDF files: `pip install pypdf`"
            )

        with fs.open(str(file), "rb") as fp:
            # Load the file in memory if the filesystem is not the default one to avoid
            # issues with pypdf
            stream = fp if is_default_fs(fs) else io.BytesIO(fp.read())

            # Create a PDF object
            pdf = pypdf.PdfReader(stream)

            # Get the number of pages in the PDF document
            num_pages = len(pdf.pages)

            docs = []

            # This block returns a whole PDF as a single Document
            if self.return_full_document:
                metadata = {"file_name": file.name}
                if extra_info is not None:
                    metadata.update(extra_info)

                # Join text extracted from each page
                text = "\n".join(
                    pdf.pages[page].extract_text() for page in range(num_pages)
                )

                docs.append(Document(text=text, metadata=metadata))

            # This block returns each page of a PDF as its own Document
```

and per-page:

```python
                    page_text = pdf.pages[page].extract_text()
                    page_label = pdf.page_labels[page]

                    metadata = {"page_label": page_label, "file_name": file.name}
                    if extra_info is not None:
                        metadata.update(extra_info)

                    docs.append(Document(text=page_text, metadata=metadata))
```

Behaviour worth knowing:
- **Default is one `Document` per page**, each carrying `page_label` and `file_name` in metadata.
  `return_full_document=True` collapses to a single `Document` and **drops `page_label`**.
- It is wrapped in `@retry(stop=stop_after_attempt(RETRY_TIMES))` with `RETRY_TIMES = 3` — a tenacity retry
  around a *local file read*, which is only meaningful for a remote `fs`.
- `pypdf.extract_text()` is a plain text extraction: **no OCR, no layout reconstruction, no table structure.**
  Column layouts and tables come out as run-together text.
- Nothing here touches an LLM or an embedding model.

`DocxReader` for comparison:

```python
class DocxReader(BaseReader):
    """Docx parser."""

    def load_data(
        self,
        file: Path,
        extra_info: Optional[Dict] = None,
        fs: Optional[AbstractFileSystem] = None,
    ) -> List[Document]:
```
