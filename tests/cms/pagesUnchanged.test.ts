// @vitest-environment node
import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  capturePage, captureUrls, fixtureName, writeFixtures, FIXTURE_DIR,
} from '../../scripts/cms/capturePages';

describe('static pages are unchanged from the Task 1 capture', () => {
  // Rendering reads the eager content snapshot: it must never hit the network.
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterAll(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // CAPTURE_PAGES=1 regenerates the fixtures. Only do this deliberately.
  it.skipIf(!process.env.CAPTURE_PAGES)('writes fixtures', async () => {
    expect(await writeFixtures()).toBeGreaterThan(0);
  }, 120_000);

  it('covers every static registry URL in both locales plus the 404', () => {
    const urls = captureUrls();
    expect(urls).toContain('/en/__404');
    expect(urls).toContain('/en');
    expect(new Set(urls.map((u) => fixtureName(u).file)).size).toBe(urls.length);
  });

  it.skipIf(!!process.env.CAPTURE_PAGES)('the fixtures are exactly the captured URLs: none missing, no orphans', () => {
    const onDisk = ['en', 'el'].flatMap((locale) =>
      readdirSync(resolve(FIXTURE_DIR, locale)).map((f) => `${locale}/${f}`),
    ).sort();
    expect(onDisk).toEqual(captureUrls().map((u) => fixtureName(u).file).sort());
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual(['el', 'en']);
  });

  it.skipIf(!!process.env.CAPTURE_PAGES)('every page matches its fixture (head, main, title, JSON-LD)', async () => {
    for (const url of captureUrls()) {
      const expected = JSON.parse(readFileSync(resolve(FIXTURE_DIR, fixtureName(url).file), 'utf8'));
      const actual = await capturePage(url);
      expect(actual.title, url).toBe(expected.title);
      expect(actual.jsonLd, url).toEqual(expected.jsonLd);
      expect(actual.head, url).toBe(expected.head);
      expect(actual.main, url).toBe(expected.main);
    }
  }, 120_000);
});
