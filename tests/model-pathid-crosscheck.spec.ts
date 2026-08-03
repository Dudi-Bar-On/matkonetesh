import { test, expect, seedApp } from './_fixtures';

// Task 4g (owner-approved insertion, 2026-08-03; plan REVISION 3 of
// docs/superpowers/plans/2026-08-03-data-model.md). WHY: model_paths.py hard-codes path ids as
// literals ("c:smoke_sv", "c:smoke", "smoke", ":rev") — a Python mirror of THREE JS functions
// (methodRules app.js:1157, comboMethodEntry, itemProfile/itemPaths app.js:4760). Wave 0 task 2.3
// expands the method vocabulary; when it lands, itemPaths will emit different ids and the Python
// mirror goes stale SILENTLY (the model would produce keys nobody looks up, and nothing fails
// loudly — the no-inert-shipment failure mode, arriving by drift). This gate converts that
// silent staleness into an immediate, loud failure by re-deriving, in the browser, on the SHIPPED
// bundle, the exact id set the real engine (itemPaths) emits for every item and diffing it — as
// SETS, per item — against the model's own Object.keys(item.paths), in BOTH directions.
//
// DISCOVERY (measured against the current build, before this test existed — see the task report
// for the full breakdown): the model today implements only two of the engine's combo routes for
// CUTS — "Route A" (sv+smoke, id 'c:smoke_sv' [+':rev']) and "Route B" (smoke-only, id 'c:smoke')
// — exactly as model_paths.py's own module docstring already documents ("route A's sv+smoke legs
// ... route B's smoke leg"). Every combo the engine can ALSO validly offer that touches 'grill', or
// the solo-sv route (methodRules always allows sv/smoke/grill — see app.js:1157), has NO model
// entry at all: this is CURRENT, PRE-EXISTING, DOCUMENTED SCOPE, not drift, and not something this
// task is chartered to fix (HARD CONSTRAINTS: no data.py/app.js/model_paths.py edits outside the
// bite-proof). So it is asserted against PATHID_ALLOWED_GAPS below by explicit, reasoned pattern —
// exactly so that the NEXT silent gap (e.g. Wave 0 inventing a combo id model_paths.py doesn't
// know about, or a route the converter drops without saying so) still breaks this test loudly,
// instead of hiding inside an ever-growing "known gaps" bucket.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  // Task B: items is fetched on demand — await the readiness promise (mirrors __mkLangReady) so the
  // fetch is genuinely exercised, not just polled for.
  await page.evaluate(`window.__mkItemsReady`);
  await page.waitForFunction(`typeof DATA!=='undefined' && DATA.items && DATA.items.length`);
};

// Every entry documents WHY the divergence is legitimate today, not merely THAT it exists.
// `test` receives the divergent id and must return true only for the specific, named case it
// covers — a case that stops matching (e.g. the item is removed, or the reason no longer holds)
// simply stops being exercised; a NEW, different divergence never matches an existing entry.
const PATHID_ALLOWED_GAPS: Array<{
  reason: string;
  direction: 'missing-from-model' | 'extra-in-model';
  test: (id: string, itemHe: string, table: string) => boolean;
}> = [
  {
    // Every one of the 130 CUTS rows validly offers several grill-inclusive combos (methodRules,
    // app.js:1157, allows sv/smoke/grill for every category — grill is only ever EXCLUDED as a
    // solo method for "collagen/long cuts", never excluded from combos). model_paths.py never
    // converts any of them (Route A/B only, per its own module docstring) — there is no grill leg
    // anywhere in data.py's flat row for the converter to move. Covers ids like c:grill,
    // c:grill_sv, c:grill_smoke, c:grill_smoke_sv, c:grill_smoke_sv:rev.
    reason: "CUTS: grill-inclusive combo — out of current model scope (Route A/B only; no grill leg in the source row for model_paths.py to move)",
    direction: 'missing-from-model',
    test: (id, _he, table) => table === 'cuts' && id.startsWith('c:') && id.includes('grill'),
  },
  {
    // methodRules always allows a solo-'sv' combo too (it is in `allowed` for every category and
    // excluded from `invalid` everywhere except the gizzard require-sv case, where solo-sv is
    // still valid — only solo-smoke is forbidden there). model_paths.py has no third "sv alone"
    // route — only combined sv+smoke (Route A) and smoke-only (Route B) exist.
    reason: "CUTS: solo-sv combo — out of current model scope (only combined sv+smoke and smoke-only routes are converted, no standalone sv route)",
    direction: 'missing-from-model',
    test: (id, _he, table) => table === 'cuts' && id === 'c:sv',
  },
  {
    // itemProfile's 'spec' branch (app.js:4390) is unconditional — every SPECIALS row gets exactly
    // one method, literal id 'smoke', regardless of whether smt exists. model_paths._special_paths
    // (model_paths.py) explicitly requires row.get('smt') is not None and returns {} otherwise —
    // these 4 rows carry no smoke-temp at all in data.py, so there is nothing to convert. Named
    // exhaustively (not by pattern) because this is a small, closed, measured set — a 5th item
    // losing its smt would silently join it, which is exactly the drift this list must catch.
    reason: "SPECIALS: no smt in source data.py row — model_paths._special_paths has nothing to convert (named: בילטונג, סלמי, צ'וריסו מיובש, פפרוני)",
    direction: 'missing-from-model',
    test: (id, he, table) =>
      table === 'specials' &&
      id === 'smoke' &&
      ["בילטונג", "סלמי", "צ'וריסו מיובש", "פפרוני"].includes(he),
  },
];

function allowedGapFor(
  id: string,
  itemHe: string,
  table: string,
  direction: 'missing-from-model' | 'extra-in-model'
): string | null {
  const hit = PATHID_ALLOWED_GAPS.find(
    (g) => g.direction === direction && g.test(id, itemHe, table)
  );
  return hit ? hit.reason : null;
}

test('PX1 · every engine-emitted path id has a model entry, or a NAMED reason it legitimately does not (per item, both directions)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var perItem = [];
    DATA.items.forEach(function(it){
      var ref = it.legacy_ref;
      if (!ref) return;
      var legacyKey = ref.table === 'cuts' ? ('cut-' + ref.n) : ('spec-' + ref.n);
      var meta = resolveItem(legacyKey);
      if (!meta) { perItem.push({ he: it.name.he, table: ref.table, unresolvable: true, engineIds: [], modelIds: [] }); return; }
      var engineIds = itemPaths(meta).map(function(p){ return p.id; }).sort();
      var modelIds = Object.keys(it.paths || {}).sort();
      perItem.push({ he: it.name.he, table: ref.table, engineIds: engineIds, modelIds: modelIds });
    });
    return perItem;
  })()`) as Array<{ he: string; table: string; unresolvable?: boolean; engineIds: string[]; modelIds: string[] }>;

  const realFailures: string[] = [];
  const allowedSkips: string[] = [];
  const reasonHitCounts = new Map<string, number>();
  let totalEngineIds = 0, totalModelIds = 0;

  for (const it of r) {
    if (it.unresolvable) { realFailures.push(`${it.he}: legacy key did not resolve via resolveItem`); continue; }
    totalEngineIds += it.engineIds.length;
    totalModelIds += it.modelIds.length;

    const missing = it.engineIds.filter((id) => it.modelIds.indexOf(id) === -1);
    const extra = it.modelIds.filter((id) => it.engineIds.indexOf(id) === -1);

    missing.forEach((id) => {
      const reason = allowedGapFor(id, it.he, it.table, 'missing-from-model');
      if (reason) {
        allowedSkips.push(`${it.he} (${it.table}): ${id} — ${reason}`);
        reasonHitCounts.set(reason, (reasonHitCounts.get(reason) || 0) + 1);
      } else {
        realFailures.push(`${it.he} (${it.table}): engine emits '${id}' but model has no entry for it (no allow-list reason)`);
      }
    });
    extra.forEach((id) => {
      const reason = allowedGapFor(id, it.he, it.table, 'extra-in-model');
      if (reason) {
        allowedSkips.push(`${it.he} (${it.table}): ${id} — ${reason}`);
        reasonHitCounts.set(reason, (reasonHitCounts.get(reason) || 0) + 1);
      } else {
        realFailures.push(`${it.he} (${it.table}): model has '${id}' but the engine never emits it for this item (stale or invented id)`);
      }
    });
  }

  // Coverage report — visible on every run, pass or fail (DoD: "reports totals, not just a pass").
  console.log(`[PX1 coverage] items=${r.length} engine-ids=${totalEngineIds} model-ids=${totalModelIds} ` +
    `allowed-skips=${allowedSkips.length} real-failures=${realFailures.length}`);
  for (const [reason, count] of reasonHitCounts) console.log(`[PX1 allow-list] (${count}×) ${reason}`);
  for (const rule of PATHID_ALLOWED_GAPS) {
    if (!reasonHitCounts.has(rule.reason)) console.log(`[PX1 allow-list] (0×, UNUSED) ${rule.reason}`);
  }

  expect(realFailures).toEqual([]);
});
