/**
 * API client — single point of contact for all backend requests.
 *
 * Every fetch goes through `api()`, which handles JSON parsing and
 * surfaces server-side error messages as thrown exceptions so callers
 * can use try/catch uniformly.
 */
async function api(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
