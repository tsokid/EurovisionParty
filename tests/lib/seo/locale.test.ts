import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  isLocale,
  detectLocale,
  oppositeLocale,
  localizePath,
  stripLocaleFromPath,
} from '@/lib/seo/locale';

describe('locale helpers', () => {
  it('LOCALES is en + el', () => {
    expect(LOCALES).toEqual(['en', 'el']);
  });

  it('isLocale narrows correctly', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('el')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('detectLocale prefers stored, then nav lang, then en', () => {
    expect(detectLocale({ stored: 'el', browser: 'fr-FR' })).toBe('el');
    expect(detectLocale({ stored: null, browser: 'el-GR' })).toBe('el');
    expect(detectLocale({ stored: null, browser: 'fr-FR' })).toBe('en');
    expect(detectLocale({ stored: 'invalid', browser: 'el' })).toBe('el');
  });

  it('oppositeLocale flips', () => {
    expect(oppositeLocale('en')).toBe('el');
    expect(oppositeLocale('el')).toBe('en');
  });

  it('localizePath prepends locale', () => {
    expect(localizePath('en', '/eurovision-night')).toBe('/en/eurovision-night');
    expect(localizePath('el', '/')).toBe('/el');
    expect(localizePath('en', '')).toBe('/en');
  });

  it('stripLocaleFromPath removes locale prefix', () => {
    expect(stripLocaleFromPath('/en/eurovision-night')).toBe('/eurovision-night');
    expect(stripLocaleFromPath('/el')).toBe('/');
    expect(stripLocaleFromPath('/foo')).toBe('/foo'); // no locale
  });
});
