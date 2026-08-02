import { test, expect, seedApp } from './_fixtures';

// R-64 hotfix · v288 shipped a `response_schema` the Gemini API rejects outright:
//   api-400: * GenerateContentRequest.generation_config.response_schema
//             .properties[subject_category].enum[0]: cannot be empty
// The whole suite mocks the classifier (`__vcClassMock`) or fulfils the route with a canned body, so the
// schema we actually SEND was never asserted on by anything — only the API validated it, in production.
// These tests close exactly that hole: they assert on the SCHEMA OBJECT, and on the schema as it is
// really serialized onto the wire, without any network call reaching Google.
//
// What this proves: the request we emit satisfies the structural rules the API documents and the one it
// enforced against us. What it does NOT prove: that Gemini accepts every schema that passes here — only a
// real request can prove that. This is a structural gate, not an API conformance oracle.

// The documented Gemini Schema type vocabulary (OpenAPI 3.0 subset used by responseSchema).
const GEMINI_TYPES = ['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT'];

// Walks a Gemini response schema and returns every rule violation as a string path + reason.
// Kept as a plain function so it can run identically on the in-page object and on the wire body.
function schemaViolations(node: any, path = '$'): string[] {
  const out: string[] = [];
  if (node === null || typeof node !== 'object') { out.push(path + ': not an object'); return out; }
  const type = node.type;
  if (typeof type !== 'string' || GEMINI_TYPES.indexOf(type) < 0) {
    out.push(path + '.type: ' + JSON.stringify(type) + ' is not one of ' + GEMINI_TYPES.join('/'));
  }
  if ('enum' in node) {
    if (type !== 'STRING') out.push(path + '.enum: enum is only legal on type STRING (got ' + type + ')');
    if (!Array.isArray(node.enum)) {
      out.push(path + '.enum: not an array');
    } else if (!node.enum.length) {
      out.push(path + '.enum: empty enum list');
    } else {
      node.enum.forEach((v: any, i: number) => {
        if (typeof v !== 'string') out.push(path + '.enum[' + i + ']: not a string');
        else if (!v.trim()) out.push(path + '.enum[' + i + ']: cannot be empty');   // ← the v288 defect
      });
      const dupes = node.enum.filter((v: any, i: number) => node.enum.indexOf(v) !== i);
      if (dupes.length) out.push(path + '.enum: duplicate members ' + JSON.stringify(dupes));
    }
  }
  if (type === 'OBJECT') {
    if (!node.properties || typeof node.properties !== 'object') {
      out.push(path + '.properties: an OBJECT must declare properties');
    } else {
      const keys = Object.keys(node.properties);
      if (!keys.length) out.push(path + '.properties: empty');
      if ('required' in node) {
        if (!Array.isArray(node.required)) out.push(path + '.required: not an array');
        else node.required.forEach((r: any) => {
          if (typeof r !== 'string' || keys.indexOf(r) < 0) {
            out.push(path + '.required: "' + r + '" is not a declared property');
          }
        });
      }
      keys.forEach(k => { out.push(...schemaViolations(node.properties[k], path + '.' + k)); });
    }
  }
  if (type === 'ARRAY') {
    if (!node.items) out.push(path + '.items: an ARRAY must declare items');
    else out.push(...schemaViolations(node.items, path + '[]'));
  }
  return out;
}

test.describe('R-64 hotfix · the response schema we send is one the API accepts', () => {

  test('safetyClaimSchema(true) carries no empty enum member and no incoherent required list', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const schema = await page.evaluate(`(function(){ return safetyClaimSchema(true); })()`);
    expect(schemaViolations(schema)).toEqual([]);
  });

  test('safetyClaimSchema(false) — the pre-existing shape — is clean too', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const schema = await page.evaluate(`(function(){ return safetyClaimSchema(false); })()`);
    expect(schemaViolations(schema)).toEqual([]);
  });

  test('the schema as SERIALIZED onto the wire is clean (the exact bytes v288 was 400ed on)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    let sent: any = null;
    // NOT a glob: the real URL is `.../models/<id>:generateContent` — the verb is preceded by a COLON, so
    // the `**/generateContent*` glob used elsewhere in this suite never matches it (see the report note).
    const isGen = (u: URL) => u.href.indexOf(':generateContent') >= 0;
    await page.route(isGen, r => {
      try { sent = JSON.parse(r.request().postData() || 'null'); } catch (e) { sent = 'UNPARSEABLE'; }
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"claims":[]}' }] } }] }),
      });
    });
    try {
      await page.evaluate(`(async function(){
        window.__vcClassMock = null;                       // force the real request path
        store.set('mk-gemkey', 'x'.repeat(40));            // aiAvail() true via BYOK
        return await vcClassifySafetyClaims('הגש ב-71°C.', 'מה הטמפרטורה הבטוחה לכבש');
      })()`);
    } finally { await page.unroute(isGen); }
    expect(sent).not.toBeNull();
    expect(sent).not.toBe('UNPARSEABLE');
    const wire = sent.generationConfig && sent.generationConfig.responseSchema;
    expect(wire, 'the request must actually carry a responseSchema').toBeTruthy();
    expect(wire.properties.subject_category, 'the question path must send subject_category').toBeTruthy();
    expect(schemaViolations(wire)).toEqual([]);
  });

  test('the "no category" answer is expressible without an empty enum member', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const out = await page.evaluate(`(function(){
      const schema = safetyClaimSchema(true);
      const list = schema.properties.subject_category.enum;
      const cats = askAllCategories();
      const extra = list.filter(function(v){ return cats.indexOf(v) < 0; });
      return { extra: extra, catsAllPresent: cats.every(function(c){ return list.indexOf(c) >= 0; }),
               required: schema.required };
    })()`) as any;
    // Exactly one member that is NOT a catalog category: the explicit "nothing fits" choice.
    expect(out.extra.length).toBe(1);
    expect(out.extra[0].trim().length).toBeGreaterThan(0);
    expect(out.catsAllPresent).toBe(true);
    // It must stay OPTIONAL, so a model that omits the field entirely is equally valid.
    expect(out.required).not.toContain('subject_category');
  });

  test('unknown case end to end: sentinel / absent / unrecognised all leave the ladder untouched', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const out = await page.evaluate(`(function(){
      const src = 'הגש ב-71°C.';
      const claims = [{ text: '71°C', kind: 'internal_safe_temp', value: 71, unit: 'C', confidence: 0.9 }];
      const sentinel = safetyClaimSchema(true).properties.subject_category.enum
        .filter(function(v){ return askAllCategories().indexOf(v) < 0; })[0];
      const realCat = askAllCategories()[0];
      const g = function(j){ const m = vcBuildClaimMap(src, j); return m ? (m.catalogSubject === undefined ? 'UNSET' : m.catalogSubject) : 'NULLMAP'; };
      return {
        sentinel:   g({ claims: claims, subject_category: sentinel }),
        absent:     g({ claims: claims }),
        empty:      g({ claims: claims, subject_category: '' }),
        invented:   g({ claims: claims, subject_category: 'שור מיתולוגי' }),
        real:       g({ claims: claims, subject_category: realCat }),
        realCat:    realCat,
      };
    })()`) as any;
    expect(out.sentinel).toBe('UNSET');   // the "nothing fits" answer must NOT become a category
    expect(out.absent).toBe('UNSET');
    expect(out.empty).toBe('UNSET');
    expect(out.invented).toBe('UNSET');
    expect(out.real).toBe(out.realCat);   // a genuine choice still rides through
  });
});
