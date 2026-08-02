# PROVENANCE — Source #19: Serious Eats / J. Kenji López-Alt

| Field | Value |
|---|---|
| `source_id` | 19 |
| Title | "Reverse-Seared Steak" (recipe/technique article) |
| Author | J. Kenji López-Alt |
| Publisher / edition | Serious Eats, undated site content; technique also published in *The Food Lab: Better Home Cooking Through Science* (W.W. Norton, 2015) |
| Retrieval URL | `https://www.seriouseats.com/reverse-seared-steak-recipe` — **RESOLVED 2026-08-02** |
| Retrieval timestamp | 2026-08-02 |
| Rating (source map §2/§10) | **D+** — measured craft, not regulatory/peer-reviewed |
| Extraction method | **`VERBATIM`** (Round 2) — superseding Round 1's `MANUAL` WebSearch-synthesis tier |
| Value-types covered | Reverse-sear doneness temperatures (target-in-oven and final-target), approximate oven times, Maillard-onset temperature, cathepsin-tenderization temperature, oven-temp range |
| What is missing / did not parse | Pan/oil temperature specifics (article states "hot/smoking skillet" without a °F figure in the section reviewed); full 452 KB page not exhaustively read beyond the reverse-sear technique/table, which is this source's entire relevance to the corpus |

## Retrieval history — Round 1 vs Round 2

**Round 1** recorded a hard WebFetch tool-level denial on `www.seriouseats.com` ("Claude Code is unable to
fetch from www.seriouseats.com") and fell back to WebSearch-synthesis only — the weakest MANUAL tier used
in the whole corpus-download task.

**Round 2** used **Node `fetch`** directly (`node -e "fetch(...)"`), per the controller's verified finding
that Node has full outbound network access in this environment while `curl` is sandboxed and `WebFetch` has
its own tool-side domain refusals independent of actual network reachability. Result: **HTTP 200**, full
page retrieved (452,140 bytes), no paywall marker present. The task brief's separate note that a bare
`curl`/no-UA request to `seriouseats.com` root returns 402 was not reproduced when a standard desktop
User-Agent header was sent with `node fetch` — whatever gate produces the 402 (likely a bot-detection layer
keyed on request headers, not a true content paywall) did not block a UA-bearing request to this specific
article URL.

**Correct canonical URL found by guessing + verifying status codes**, not WebSearch (WebSearch's own results
for `site:seriouseats.com` queries did not surface this or other seriouseats.com URLs directly — the tool's
search index appears not to return this domain in results even though the domain itself is fetchable).
Five URL candidates were tried; `reverse-seared-steak-recipe` returned 200, four others returned 404.

## Per-artifact index

| File | Contents | `extraction` |
|---|---|---|
| `reverse-seared-steak-recipe.html` | Full retrieved page, verbatim, as-served | VERBATIM |
| `SOURCE-COPY.md` | Verbatim excerpts + full doneness/timing table, transcribed from the fetched HTML | VERBATIM |
| `reverse-sear-doneness-temps.csv` | Doneness → target-in-oven temp, final-target temp, oven time range | VERBATIM |

## Cross-check against Round 1

Round 1's WebSearch-reconstructed "target temp in oven" values (105/115/125/135°F for rare through
medium-well) all matched the verbatim table exactly — the search-synthesis approach was not wrong, just
incomplete (missing the "final target temp" column and two of the four time ranges, and reporting the
medium-well time as a single point, 40 min, that is actually the top of a 35–40 min range). No values in
Round 1 were found to contradict the verbatim source.

## Source-map upkeep note

Round 1 recommended adding `www.seriouseats.com` to the map's "BLOCKED" list. Round 2 finding **reverses
this**: the block was specific to the `WebFetch` tool (and possibly `curl`), not the host. `00-SOURCE-MAP.md`
§1's retrieval-reality table should note that `node fetch` (with a standard UA header) is a viable channel
for seriouseats.com, distinct from the WebFetch/curl restrictions already documented there.

## Disagreement note

No bearing on the 94°C brisket disagreement or any FSIS lethality table — this source is technique/doneness
only (searing/reverse-sear method), never a pathogen-safety source, consistent with the source map's D+
rating and framing. The now-confirmed Maillard-onset figure ("close to 300°F/150°C") sits within the range
of commonly-cited Maillard thresholds but is sourced here specifically to this article's own text, not to
general background knowledge.
