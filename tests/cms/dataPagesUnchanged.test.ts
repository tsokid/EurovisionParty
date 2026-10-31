// @vitest-environment node
import { describe, it, expect, vi, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dataPageDigest, dataPageUrls, writeDataFixture, DATA_FIXTURE } from '../../scripts/cms/capturePages';

// CMS 3c Task 6 gate: with no editorial docs in content/pages, every hub,
// archive and country page prerenders byte-identically (status, head tags,
// body and inlined #__content__) to the capture taken before the editorial
// layer existed (tests/fixtures/data-pages-before.json, one sha256 per URL).
// The capture pins the contest data of that day, so a later publish would fail
// it: like pagesUnchanged, it only runs with CMS_MIGRATION_PROOF=1. Never
// regenerate the fixture to make it pass.
describe.skipIf(!process.env.CMS_MIGRATION_PROOF)('data pages are unchanged without editorial', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterAll(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // CAPTURE_DATA_PAGES=1 regenerates the fixture. Only do this deliberately.
  it.skipIf(!process.env.CAPTURE_DATA_PAGES)('writes the fixture', async () => {
    expect(await writeDataFixture()).toBeGreaterThan(0);
  }, 600_000);

  it.skipIf(!!process.env.CAPTURE_DATA_PAGES)('every data page matches its captured digest', async () => {
    expect(existsSync(DATA_FIXTURE)).toBe(true);
    const before = JSON.parse(readFileSync(DATA_FIXTURE, 'utf8')) as Record<string, string>;
    const urls = await dataPageUrls();
    expect(urls.sort()).toEqual(Object.keys(before).sort());
    expect(urls.some((u) => u.includes('/past-contests/eurovision-'))).toBe(true);
    expect(urls.some((u) => u.includes('/countries/'))).toBe(true);
    const changed: string[] = [];
    for (const url of urls) if ((await dataPageDigest(url)) !== before[url]) changed.push(url);
    expect(changed).toEqual([]);
  }, 600_000);
});
