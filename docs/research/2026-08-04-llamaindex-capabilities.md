# LlamaIndex — מה עוד אפשר להוציא ממנו עבור זיכרון-הסוכן

**תאריך:** 2026-08-04 · **גרסאות:** `llama-index-core 0.14.23`, `llama-index-readers-file 0.6.0`, Python 3.14 / SQLite 3.50.4
**מצב קיים:** ‏11,674 רשומות · ‏301 מסמכי `.md` → 4,847 צמתים · ‏9 מפרטי כלים · ‏`src/memory/agent_memory.py` + `scripts/memsync.py`

---

## 0 · שיטת האימות — מה נבדק בפועל, ומה לא

**‏Bash מושבת ב-session הזה.** לא הרצתי `python`, לא `pip`, ולא `help()`. במקום זה **קראתי את קוד המקור
המותקן עצמו** תחת
`C:\Users\dudib\AppData\Local\Programs\Python\Python314\Lib\site-packages\llama_index\` —
חתימות, שדות pydantic, מחרוזות `raise ImportError`, ורשימות `__all__`. זו ראיה חזקה יותר מדף תיעוד, אבל
**חלשה יותר מהרצה**: היא מוכיחה מה הקוד אומר, לא מה קורה ב-runtime.

| מה | דרגת ודאות |
|---|---|
| חתימות, ברירות-מחדל, `__all__`, שדות חובה, הודעות ImportError | **נקרא מהמקור המותקן** — ודאות גבוהה |
| אילו חבילות מותקנות/חסרות | **נבדק** מול `site-packages/*.dist-info/METADATA` וגלוב על התיקייה |
| קיום מטמוני `_static` (tiktoken/nltk) | **נבדק** בגלוב על הדיסק — הקבצים קיימים |
| ‏`BM25Retriever` | **לא מותקן.** המקור נמשך מ-GitHub `main` — **לא הורץ, לא אומת ב-runtime** |
| התנהגות bm25s על עברית, התקנת PyStemmer על CPython 3.14 | **לא נבדק** — מסומן ככזה בכל מקום |

⚠️ **‏WebFetch מסכם ולא מחזיר טקסט מילולי.** ביקשתי verbatim מדפי התיעוד וקיבלתי פרפרזה. לכן **ההפקדה
מעוגנת בקוד המותקן** (מילולי, אמין), ותוכן מדף התיעוד מסומן במפורש `docs site (paraphrased)` ואסור להסתמך
עליו כחוזה API.

---

## 1 · הממצא שקובע הכול — `Settings.llm` מתפוצץ, לא נסוג בעדינות

```python
    @property
    def llm(self) -> LLM:
        if self._llm is None:
            self._llm = resolve_llm("default")
```

ו-`resolve_llm("default")` (‏`core/llms/utils.py`):

```python
        if os.getenv("IS_TESTING"):
            ...
            return MockLLM()
        try:
            from llama_index.llms.openai import OpenAI
            ...
        except ImportError:
            raise ImportError(
                "`llama-index-llms-openai` package not found, "
                "please run `pip install llama-index-llms-openai`"
            )
```

**‏`llama-index-llms-openai` אינו מותקן כאן.** המסקנה המעשית, והיא מפתיעה:

> כל רכיב שב-`__init__` שלו כתוב `llm or Settings.llm` הוא **רכיב דורש-LLM בזמן בנייה**, גם אם לוגית הוא
> לא צריך מודל בכלל. ‏`SimpleKeywordTableIndex` הוא בדיוק המקרה הזה.

היחיד שמציל הוא משתנה הסביבה **`IS_TESTING`** — זה המנגנון שמאחורי "‏`Settings.llm` הוא MockLLM בבדיקות".

**‏החדשות הטובות: הטוקניזציה offline באמת.** ‏`get_tokenizer()` מפנה את `TIKTOKEN_CACHE_DIR` למטמון מצורף,
ואימתתי שהוא קיים על הדיסק:
`_static/tiktoken_cache/9b5ad71b...` ו-`fb374d41...`. גם `_static/nltk_cache/` קיים ומלא — כולל
`corpora/stopwords/hebrew` (‏אבל **אין** `punkt_tab/hebrew`). לכן `SentenceSplitter` ו-`CodeSplitter`
אינם פותחים רשת.

---

## 2 · הטבלה המרכזית

עמודת "דורש מודל?" היא ההבחנה שביקשת: ✅ = עובד בלי מודל · ⚠️LLM · ⚠️EMB.

| יכולת | דורש מודל? | מה היא נותנת לנו | עלות אימוץ | פסק |
|---|---|---|---|---|
| **`MetadataFilters`/`FilterOperator`** כשפת סינון | ✅ | 14 אופרטורים סטנדרטיים במקום `metadata_equals` בלבד; `key`+`operator`+`value` מוקשח מאפשר allow-list על המפתח ופרמטר קשור על הערך | נמוכה — schema בלבד, אפס תלויות חדשות | **אמץ** |
| **`CSVReader`/`PandasCSVReader`/`XMLReader`/`HTMLTagReader`** על הקורפוס | ✅ | ‏~40 קובצי `.csv` + 4 `.xml` + 1 `.html` ב-`docs/sources/corpus/` שכרגע **לא נכנסים לזיכרון כלל** (‏`memsync` קולט `**/*.md` בלבד) | נמוכה — כל התלויות כבר מותקנות | **אמץ** |
| **`BM25Retriever`** | ✅ | דירוג לקסיקלי אמיתי (TF רוויה + אורך מסמך) במקום `LIKE '%טקסט%'` שאין לו סדר תוצאות בכלל | בינונית — חבילה חדשה + `bm25s` + `PyStemmer`; סיכון wheel ל-CPython 3.14 | **נסה** |
| **`HierarchicalNodeParser`** | ✅ | היחיד ב-core שממלא `PARENT`/`CHILD`; יחד עם `get_leaf_nodes`/`get_root_nodes` | בינונית — משנה את צורת הקליטה | **נסה** |
| **`CodeSplitter`** על `app.js` ו-17 קובצי Python | ✅ | חיתוך AST לפי גבולות פונקציה במקום שורות | בינונית — `tree_sitter_language_pack` **לא מותקן** | **נסה** |
| **`PDFReader`** על 19 המקורות | ✅ | טקסט מ-PDF | **מיותרת** — ראה §5 | **דחה** |
| **`IngestionPipeline` + `docstore`/`docstore_strategy`** | ✅ | de-dup מובנה | גבוהה, ותמורה שלילית — ראה §6 | **דחה** |
| **`SimpleDocumentStore`** | ✅ | אחסון צמתים | גבוהה, וזו בדיוק התקלה שברחנו ממנה — §6 | **דחה** |
| **`SimpleKeywordTableIndex`** | ⚠️LLM *בבנייה* | מפת מילה→צומת בלי דירוג | דורש `llm=MockLLM()` למרות שלא משתמש בו | **דחה** |
| **`SemanticSplitterNodeParser`** | ⚠️EMB | חיתוך לפי דמיון סמנטי | `embed_model` הוא שדה חובה בלי ברירת מחדל | **דחה** |
| **`MarkdownElementNodeParser`** ו-`UnstructuredElementNodeParser` | ⚠️LLM | סיכום טבלאות | `llm = self.llm or Settings.llm` + `query_engine.aquery(...)` | **דחה** |
| **`ImageCaptionReader`/`ImageVisionLLMReader`/`ImageTabularChartReader`** | ⚠️LLM | תיאור תמונות | `torch transformers` | **דחה** |
| **`VectorIndexRetriever`** וכל משפחת ה-vector | ⚠️EMB | חיפוש סמנטי | דורש מודל embedding | **דחה** |

---

## 3 · שלוש מלכודות שמצאתי בקוד — כל אחת הייתה עולה לנו session

### 3.1 ‏`from llama_index.core.retrievers import BM25Retriever` **נכשל**

הקובץ `core/retrievers/__init__.py` מכיל את המחרוזת `"BM25Retriever"` בתוך `__all__`, אבל **אף פעם לא
מייבא אותו**, ואין בקובץ `__getattr__`. קראתי את כל 88 השורות. זו רשומת ייצוא מיושנת.
‏BM25 מגיע **רק** מהחבילה הנפרדת `llama-index-retrievers-bm25`.

### 3.2 ‏`BM25Retriever.persist()` לא שומר את הטוקניזציה

```python
DEFAULT_PERSIST_ARGS = {
    "similarity_top_k": "similarity_top_k",
    "_verbose": "verbose",
    "corpus_weight_mask": "corpus_weight_mask",
}
```

‏`stemmer`, `skip_stemming`, `language` ו-`token_pattern` **אינם ברשימה**. מי שיאנדקס עם
`skip_stemming=True` ויטען עם `from_persist_dir()` יקבל אובייקט עם `skip_stemming=False` ו-stemmer אנגלי —
**הטוקניזציה בשאילתה תפסיק להתאים לזו שבאינדקס, בשקט.** אם נשתמש ב-`persist()`, חובה להחיל מחדש ידנית.

### 3.3 ‏`parent_node_id` אצלנו הוא עמודה מתה

`agent_memory.py` שורות 188-189:

```python
    parent = node.parent_node
    meta["parent_node_id"] = parent.node_id if parent is not None else None
```

‏אבל `MarkdownNodeParser._build_node_from_split` **אינו קובע יחס `PARENT` בשום מקום** — הוא כותב רק
`header_path`. לכן `node.parent_node` הוא `None` עבור **כל** 4,847 הצמתים, ו-`parent_node_id` הוא `null`
בכל שורה. זה לא באג פונקציונלי, אבל זה שדה נגזר בלי צרכן ובלי ערך — בדיוק מה ש-DoD §3.5 מכוון אליו.
**‏`HierarchicalNodeParser` הוא הדבר היחיד שהיה הופך אותו לאמיתי** — וזה הטיעון החזק ביותר בעדו.

---

## 4 · ‏BM25 ועברית — הבשורה והאזהרה

**הטוקנייזר בסדר.** ברירת המחדל היא

```python
        token_pattern: str = r"(?u)\b\w\w+\b",
```

הדגל `(?u)` הופך את `\w` למודע-יוניקוד, כך שאותיות עבריות נתפסות. הדרישה לשני תווים ומעלה מפילה מילים
עבריות בנות אות אחת (ו, ב, ל, ה, ש, מ, כ) — ואלה ממילא מיליות, אז זה מקובל.

**שתי ברירות המחדל סביבו הן הבעיה:**

```python
        self.stemmer = stemmer or Stemmer.Stemmer("english")
```
‏stemmer אנגלי (Snowball) על טקסט עברי. ל-Snowball אין אלגוריתם לעברית. **‏חובה `skip_stemming=True`.**

```python
            corpus_tokens = bm25s.tokenize(
                ...,
                stopwords=language,   # language: str = "en"
```
הסרת stopwords אנגליות מקורפוס עברי לא מסירה כלום מהעברית — אבל **כן מסירה טוקנים אנגליים** מהמסמכים
המעורבים שלנו, ואצלנו המילים האנגליות הן בדיוק המזהים שמחפשים (`equipPlan`, `bcheck`,
`MarkdownNodeParser`). האם `bm25s.tokenize` מקבל רשימה מותאמת או `None` — **לא אימתתי**, וזו הבדיקה
הראשונה שצריך להריץ.

**סיכון התקנה שלא נבדק:** `pystemmer<3,>=2.2.0.1` היא הרחבת C. אם אין wheel ל-CPython 3.14 על Windows,
ההתקנה דורשת toolchain. **זה שער ההיתכנות — לבדוק לפני כל דבר אחר.**

---

## 5 · הקורפוס — הממצא שהופך את `PDFReader` למיותר

בדקתי את `docs/sources/corpus/` בפועל (116 קבצים). **לכל PDF כבר יש אח `extracted-text*.txt`:**

```
02-fsis-appendix-a-2021\fsis-appendix-a-2021.pdf   +  extracted-text.txt
01-fda-food-code-2022\...-chapter3.pdf             +  ...-chapter3-extracted.txt
08-fsis-gd-2023-0002\FSIS-GD-2023-0002-PRIMARY-wayback.pdf + extracted-text-PRIMARY.txt
13-fda-listeria-rte-2017\FDA-2017-...-PRIMARY.pdf  +  extracted-text-PRIMARY.txt
...
```

**החילוץ כבר בוצע, ידנית ובפיקוח.** להריץ `PDFReader` (‏`pypdf.extract_text()`, בלי OCR ובלי שחזור פריסה)
על אותם PDF-ים יפיק טקסט **גרוע יותר** מזה שכבר בידינו, על מקורות בטיחות. זה בדיוק סוג הדבר ש-CLAUDE.md
אוסר: ערכי `safe` נובעים ממקור ראשוני מאומת.

**מה כן חסר:** קובצי ה-`.csv` (‏~40 מהם: `pasteurization-meat-55-60C.csv`, `degree-hours.csv`,
`d-z-values-pathogens.csv`, `nitrite-floor.csv`…), ה-`.xml` וה-`.html`, וקובצי ה-`.txt` המחולצים —
**אף אחד מהם לא נמצא בזיכרון**, כי `memsync.py` קולט `**/*.md` בלבד. שם הערך האמיתי, וכל הקוראים
הדרושים כבר מותקנים.

---

## 6 · למה `IngestionPipeline`'s docstore ו-`SimpleDocumentStore` **גרועים** מהמימוש שלנו

זו לא העדפה — זו התאמת-צורה.

**‏(א) המפתח שגוי לצורת הנתונים שלנו.** ‏`_handle_upserts` בונה
`deduped_nodes_to_run[ref_doc_id] = node` — מילון לפי `ref_doc_id`. כשמסמך אחד מפוצל ל-N צמתים, כולם
חולקים `ref_doc_id`, ולכן **רק האחרון שורד**. המנגנון נועד ל-`Document`, לא לצמתים מפוצלים. אצלנו זה 4,847
צמתים על 301 מסמכים. בנוסף, `ref_doc_id` עצמו מסומן `"""Deprecated: Get ref doc id."""` ב-0.14.23.

**‏(ב) המטמון ממופתח על כל האצווה.**
`sha256(nodes_str + transform_string)` כאשר `nodes_str` הוא שרשור התוכן של **כל** הצמתים באצווה. בית אחד
שמשתנה בקובץ אחד מפספס את המטמון של האצווה כולה. זה נועד להפוך טרנספורמציה יקרה (embeddings, LLM) לאידמפוטנטית —
**לא לחשב delta לכל קובץ.** ה-delta שלנו (SHA-256 של בייטי הקובץ, `stored_file_hash` → skip) הוא
per-file, ולכן sync ריק הוא מילישניות. זה בדיוק מה שמאפשר לשער טריות להיות ירוק — הסיבה שהוחלף graphify.

**‏(ג) `SimpleDocumentStore` הוא בדיוק הכשל שברחנו ממנו.** ה-docstring אומר מילולית
`"An in-memory store for Document and Node objects."` — ‏`SimpleKVStore` הוא dict בזיכרון שמתמיד לקובץ JSON
יחיד (`docstore.json`), נכתב בשלמותו בכל שמירה, בלי שאילתות ובלי כתיבה חלקית. זהו אותו טופס בדיוק של
`graphify-out/graph.json` בן 22 MB. **אין ב-core שום docstore מבוסס-SQL** — כולם חבילות אינטגרציה נפרדות
(Postgres/Mongo/Redis), ואף אחת לא מותקנת. ‏`DuckDBVectorStore` הוא vector store, כלומר מחוץ לתחום.

**‏(ד) `add_documents(..., store_text=True)`** שומר עותק מלא שני של הטקסט בתוך ה-docstore, בנוסף ליעד.

**מסקנה:** ה-delta הידני ב-SHA-256 **טוב יותר** לצורה שלנו. אין כאן מה לאמץ. השורה `num_workers` היא
היחידה בעלת ערך פוטנציאלי — והיא process-based (`ProcessPoolExecutor`), כלומר משמעותית רק לקליטה מלאה
(`--force`), לא ל-sync היומיומי.

---

## 7 · מה **לא** כדאי — רשימה מפורשת

1. **‏`PDFReader` על קורפוס המקורות** — הטקסט כבר חולץ, ידנית, טוב יותר. §5.
2. **‏`SimpleDocumentStore` / `IngestionPipeline.docstore`** — JSON מונוליטי + מפתח שגוי + מטמון-אצווה. §6.
3. **‏`SemanticSplitterNodeParser`** — `embed_model` שדה חובה. מחוץ לאילוץ, נקודה.
4. **‏`MarkdownElementNodeParser` / `UnstructuredElementNodeParser`** — `query_engine.aquery()`. LLM.
5. **‏`SimpleKeywordTableIndex`** — נראה מפתה ("regex, no GPT" בדוקסטרינג) אבל `Settings.llm` ב-`__init__`
   מפיל אותו כאן, והוא **חלש מ-BM25 ממילא**: 10 מילים שכיחות לצומת, בלי דירוג, עם stopwords אנגליות קשיחות.
   אם לוקחים את עלות ההתקנה — לוקחים אותה על BM25.
6. **‏`QueryFusionRetriever` עם `num_queries > 1`** — יצירת שאילתות היא LLM. עם `num_queries=1` הפיוז'ן
   אריתמטי, אבל אז אין לנו שני retrievers לאחד.
7. **כל משפחת ה-vector/embedding** — מחוץ לאילוץ.
8. **‏`JSONNodeParser` על `graph.json` וכדומה** — dict אחד מייצר **צומת אחד** ללא קשר לגודל, ו-JSON פגום
   מחזיר `[]` **בשקט**. שתי התנהגויות שאסור לבנות עליהן קליטה.

---

## 8 · סדר פעולות מוצע (לא בוצע — אין קוד, אין commit)

1. **שער היתכנות:** לבדוק אם `pip install llama-index-retrievers-bm25` עובר על CPython 3.14/Windows
   (‏`PyStemmer` wheel). זה חוסם את ההמלצה מס' 1 ואת שום דבר אחר.
2. **‏`MetadataFilters` כ-API** — טהור, אפס תלויות, מיפוי ישיר ל-`json_extract`. אפשר מיד.
3. **הרחבת `memsync` ל-`.csv`/`.txt`/`.xml`** — כל הקוראים מותקנים; זה תוכן שחסר היום.
4. רק אחרי 1: פיילוט BM25 עם `skip_stemming=True` על 4,847 הצמתים הקיימים, מדוד מול `LIKE`.
5. ‏`HierarchicalNodeParser` ו-`CodeSplitter` — אחרי שהשאר יציב.

---

## 9 · ההפקדה — `docs/vendor/llamaindex/`

| קובץ | תוכן |
|---|---|
| `offline-and-no-model.md` | ‏`Settings.llm`/`resolve_llm`, מטמוני tiktoken/nltk, מצאי החבילות המותקנות והחסרות |
| `node-parsers.md` | כל המפרקים — קוד מילולי של Markdown/Code/Sentence/Hierarchical/JSON/Semantic |
| `bm25-retriever.md` | קוד המקור המלא של `BM25Retriever` + מטא-דאטה מ-PyPI + ניתוח עברית |
| `ingestion-pipeline.md` | ‏`DocstoreStrategy`, `run()`, `_handle_upserts`, מפתח המטמון |
| `metadata-filters.md` | ‏`FilterOperator`/`FilterCondition`/`MetadataFilter(s)` + `build_metadata_filter_fn` + מיפוי ל-SQL |
| `readers-file.md` | 23 הקוראים, התלות של כל אחד, ומה מותקן כאן |
| `storage-docstores.md` | ‏`SimpleDocumentStore`, ה-retrievers ב-core, מלכודת ה-`__all__` |

---

## תקציר לבעלים

בדקתי את LlamaIndex מול **קוד המקור המותקן עצמו**, לא מול דפי תיעוד — כי Bash היה מושבת ודפי התיעוד חזרו
מסוכמים ולא מילוליים. זה יצא לטובה: הקוד המותקן הוא הראיה החזקה יותר, וכל טענה כאן מצוטטת ממנו.

**שלוש היכולות שהכי כדאי לאמץ:**
1. **‏`BM25Retriever`** — דירוג לקסיקלי אמיתי במקום `LIKE` שאין לו סדר תוצאות. בלי LLM, בלי embeddings.
   על עברית הטוקנייזר עובד (`(?u)\b\w\w+\b` מודע-יוניקוד), אבל **חובה `skip_stemming=True`** אחרת מופעל
   stemmer אנגלי על עברית. **תנאי מקדים:** לבדוק שהתלות `PyStemmer` (הרחבת C) בכלל מתקינה על Python 3.14.
2. **קליטת ה-`.csv` וה-`.txt` שב-`docs/sources/corpus/`** — ‏~40 טבלאות בטיחות (פסטור, degree-hours,
   ערכי D/Z) **אינן בזיכרון בכלל**, כי `memsync` קולט `.md` בלבד. כל הקוראים כבר מותקנים.
   הרווח הגדול ביותר ביחס למאמץ.
3. **‏`MetadataFilters`/`FilterOperator` כשפת הסינון** — 14 אופרטורים סטנדרטיים, מיפוי ישיר ל-`json_extract`,
   אפס תלויות חדשות.

**מה שאסור לאמץ:** ה-`docstore` של `IngestionPipeline` ו-`SimpleDocumentStore`. ה-docstring שלו אומר
מילולית "in-memory store", והוא מתמיד ל-**קובץ JSON יחיד שנכתב בשלמותו** — אותה תקלה בדיוק שבגללה זרקנו את
graphify. גרוע מזה: ה-de-dup שלו ממופתח ב-`ref_doc_id`, כך שמכל מסמך מפוצל **רק צומת אחד שורד**. ה-delta
הידני שלנו ב-SHA-256 **טוב יותר** — אל תחליף אותו. וגם `PDFReader` מיותר: לכל PDF בקורפוס כבר יש
`extracted-text.txt` שחולץ ידנית וטוב יותר.

**ממצא צדדי שכדאי שתדע:** העמודה `parent_node_id` אצלנו היא `null` בכל 4,847 הצמתים — `MarkdownNodeParser`
פשוט לא קובע יחס `PARENT`. שדה נגזר בלי צרכן.
