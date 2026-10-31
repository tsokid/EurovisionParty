/**
 * Dev server: should the /content middleware answer this request with raw JSON?
 *
 * A plain `fetch('/content/site.json')` gets the file. A *module* request for the
 * same path (`import x from '/content/site.json'` is rewritten by Vite to
 * `/content/site.json?import`, and the browser sends `Sec-Fetch-Dest: script`)
 * must fall through to Vite, which turns the JSON into a JS module. Answering it
 * with application/json makes the browser refuse the module and the app never mounts.
 */
export function isModuleRequest(url: string, headers: Record<string, string | string[] | undefined>): boolean {
  const query = url.split('?')[1] ?? '';
  if (query.split('&').some((p) => p === 'import' || p.startsWith('import='))) return true;
  return headers['sec-fetch-dest'] === 'script';
}
