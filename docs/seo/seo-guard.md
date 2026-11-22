# SEO guard: runbook

The last check of `npm run build`, after `check-prerender`, is `scripts/seo/guard.ts`. It compares the freshly prerendered site with what is **live**. If a title, meta description, robots, canonical, hreflang, H1 or JSON-LD changes without being declared, the build fails, and so does a route that disappears without a 301. Vercel never promotes a failed build, so production stays on the current deploy.

## How it works

1. **Snapshot.** The guard snapshots `dist/` (the locale-prefixed pages only; `/admin` is never in it) and writes the snapshot to `dist/_seo/snapshot.json`. Every deploy therefore publishes `https://eurovision.games/_seo/snapshot.json`. That file is served with `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store`, robots.txt disallows it in every group, and the SPA fallback never serves the shell in its place.
2. **Baseline.** The guard looks for the baseline in this order:
   1. The live `/_seo/snapshot.json`, tried 3 times.
   2. If that fails, the copy that the last passing build stored in the build cache: `node_modules/.cache/seo-guard/snapshot.json`, which Vercel restores.
   3. If neither is available, the build fails (exit 2). This is fail closed.
3. **Intent.** `seo-intent.json` sits at the repo root, so it is not deployed. It lists recent intent entries. The guard applies only the entries that the live snapshot has not seen yet: each deploy records the entry ids it was built with. Once a publish is live, its entry stops applying, so a later code commit cannot ride on it.
4. **Diff.** Declared changes print under `ALLOWED BY SEO INTENT`. Undeclared ones print under `ERRORS` and fail the build (exit 1). Open Graph tags, H2 counts, internal links, added routes and `dateModified` dates are warnings only, as before.

## Where intent comes from

**`publish-content`** appends one entry to `seo-intent.json` in the same commit it publishes:

- **Docs.** Each changed CMS doc is listed per locale, with the fields its change can touch:
  - its SEO title field → `title`;
  - its meta description field → `description`;
  - anything else → `h1`;
  - every change → `jsonLd`.
- **Contest data.** Each changed contest data file (`content/site.json`, `content/contests/*`, `content/countries/*`) is listed. It allows `title`, `description`, `h1`, `jsonLd` and `robots` on the data pages built from that file. It also allows the first four on the static pages that render contest data.

The guard maps docs and files to routes with the site's own route table (`scripts/seo/intent.ts`).

**By hand**, for a deliberate SEO change in code (a redesign, a new canonical rule), append a manual entry. Give it a unique id and say why:

```json
{
  "id": "manual-2027-01-15-faq-canonical",
  "created_at": "2027-01-15T10:00:00Z",
  "source": "manual",
  "note": "FAQ canonical moves to /faq",
  "docs": [],
  "data": [],
  "routes": [
    { "route": "/en/faq", "fields": ["canonical"] },
    { "route": "/en/old-page", "fields": ["removed"] }
  ]
}
```

Only manual entries can allow `canonical` or `hreflang`. A removed route also needs a permanent redirect in `vercel.json` that lands on a built page in the same locale.

## Flags

| Variable | Effect | Where |
|---|---|---|
| *(none)* | Fetch the live baseline, fall back to the build cache, else fail | Default everywhere, including Vercel production |
| `SEO_BASELINE=<file>` | Compare against a local snapshot file. It accepts either format, for example `docs/design/stage/seo-baseline.json` or a saved `/_seo/snapshot.json`. There is no fetch and no fallback | Local checks. **Ignored on Vercel production** |
| `SEO_BASELINE_URL=<url>` | Fetch the live baseline from another URL | Rare (e.g. a staging domain) |
| `SEO_GUARD_BOOTSTRAP=1` | Skip the diff; the snapshot is still written. Locally it skips without touching the network. On Vercel production it applies **only while no baseline can be loaded**. Once a live snapshot exists, a forgotten flag is ignored and the guard enforces | Local builds without network; the very first production deploy |

Examples:

```sh
npm run build                                                        # strict, against live
SEO_BASELINE=docs/design/stage/seo-baseline.json npm run build       # strict, against a file
SEO_GUARD_BOOTSTRAP=1 npm run build                                  # offline: diff skipped
npm run seo:diff -- before.json after.json --intent seo-intent.json  # manual diff
```

## First deploy (once)

Production does not serve `/_seo/snapshot.json` until the first deploy that contains the guard. Before that, the URL returns the SPA shell, which the guard refuses, so the build fails closed.

1. In Vercel → Project → Settings → Environment Variables, set `SEO_GUARD_BOOTSTRAP=1` for **Production** only.
2. Deploy. The log shows `diff SKIPPED (first deploy)`.
3. Check that `https://eurovision.games/_seo/snapshot.json` returns JSON.
4. **Delete the variable.** It is harmless once a baseline is live, because the guard ignores it, but it should not stay.

Before step 1, run the build locally against the committed baseline (`SEO_BASELINE=docs/design/stage/seo-baseline.json npm run build`). That confirms the first deploy really is SEO-neutral.

## When a build fails

- **An `ERRORS` line you did not mean.** Fix the code or content. Production is untouched.
- **A change you did mean**, made from code, with no intent: add a manual entry (above) and push.
- **A CMS publish failed on a field the mapping missed.** This means the mapping is too narrow, which is the safe direction. Add a manual entry for those routes and fields, and report it so `scripts/seo/intent.ts` can learn the dependency.
- **`no baseline (fail closed)`.** The site or the network is down and the build cache is empty. Retry the deploy once the site answers. Do not set the bootstrap flag on production for this: once a baseline is live, the guard ignores it anyway.
