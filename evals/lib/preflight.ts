// Model-migration preflight helper (design: PRE-4-eval-harness-design.md; decision 5). Pure + deterministic
// so it is RED/GREEN witnessed with no key; the live ListModels/real-call checks live in evals/tests/preflight.spec.ts.
export interface ListModelsResponse { models?: Array<{ name?: string }>; }

/** True if the developer-API ListModels response contains the given model id (bare, or as `models/<id>`). */
export function modelIsListed(list: ListModelsResponse, id: string): boolean {
  const models = (list && list.models) || [];
  return models.some(m => typeof m?.name === 'string' && (m.name === id || m.name.endsWith('/' + id)));
}
