// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isModuleRequest } from '../../scripts/devContentRequest';

describe('dev /content middleware: module requests fall through to Vite', () => {
  it('serves a plain fetch as JSON', () => {
    expect(isModuleRequest('/site.json', {})).toBe(false);
    expect(isModuleRequest('/contests/2019.json', { 'sec-fetch-dest': 'empty' })).toBe(false);
    expect(isModuleRequest('/site.json?v=3', {})).toBe(false);
  });
  it('lets ?import through', () => {
    expect(isModuleRequest('/site.json?import', {})).toBe(true);
    expect(isModuleRequest('/site.json?t=123&import', {})).toBe(true);
    expect(isModuleRequest('/site.json?import&t=123', {})).toBe(true);
  });
  it('lets Sec-Fetch-Dest: script through', () => {
    expect(isModuleRequest('/site.json', { 'sec-fetch-dest': 'script' })).toBe(true);
  });
  it('does not mistake a query that merely contains "import"', () => {
    expect(isModuleRequest('/site.json?important=1', {})).toBe(false);
  });
});
