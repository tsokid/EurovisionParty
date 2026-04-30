import { describe, it, expect } from 'vitest';
import {
  buildOrganization,
  buildWebSite,
  buildArticle,
  buildFaqPage,
  buildHowTo,
  buildBreadcrumbList,
  buildEvent,
  buildDefinedTermSet,
  buildItemList,
} from '@/lib/seo/schema';

describe('schema builders', () => {
  it('buildOrganization includes required fields', () => {
    const o = buildOrganization();
    expect(o['@context']).toBe('https://schema.org');
    expect(o['@type']).toBe('Organization');
    expect(o.name).toBe('Eurovision Games');
    expect(o.url).toBe('https://eurovision.games');
    expect(o.logo).toBeDefined();
  });

  it('buildArticle accepts inLanguage', () => {
    const a = buildArticle({
      headline: 'Test',
      url: 'https://eurovision.games/en/foo',
      datePublished: '2026-04-30',
      dateModified: '2026-04-30',
      locale: 'en',
    });
    expect(a.inLanguage).toBe('en');
    expect(a.headline).toBe('Test');
    expect(a.mainEntityOfPage).toBe('https://eurovision.games/en/foo');
  });

  it('buildFaqPage emits Question entities', () => {
    const f = buildFaqPage([
      { q: 'Is it free?', a: 'Yes.' },
      { q: 'How many players?', a: '2 to 20.' },
    ]);
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toHaveLength(2);
    expect(f.mainEntity[0]['@type']).toBe('Question');
    expect(f.mainEntity[0].name).toBe('Is it free?');
    expect(f.mainEntity[0].acceptedAnswer.text).toBe('Yes.');
  });

  it('buildHowTo emits HowToStep entries', () => {
    const h = buildHowTo({
      name: 'Test',
      steps: [
        { name: 'A', text: 'Do A.' },
        { name: 'B', text: 'Do B.' },
      ],
    });
    expect(h.step).toHaveLength(2);
    expect(h.step[0]['@type']).toBe('HowToStep');
  });

  it('buildBreadcrumbList builds ordered list', () => {
    const b = buildBreadcrumbList([
      { name: 'Home', url: 'https://eurovision.games/en' },
      { name: 'Games', url: 'https://eurovision.games/en/eurovision-games' },
    ]);
    expect(b.itemListElement).toHaveLength(2);
    expect(b.itemListElement[0].position).toBe(1);
    expect(b.itemListElement[1].position).toBe(2);
  });

  it('buildEvent supports subEvents', () => {
    const e = buildEvent({
      name: 'Eurovision 2026',
      startDate: '2026-05-12',
      endDate: '2026-05-16',
      location: 'Wiener Stadthalle, Vienna',
      url: 'https://eurovision.games/en/eurovision-2026',
      subEvents: [
        { name: 'Semifinal 1', startDate: '2026-05-12', url: 'https://eurovision.games/en/eurovision-2026-semifinals' },
      ],
    });
    expect(e['@type']).toBe('Event');
    expect(e.subEvent).toHaveLength(1);
  });

  it('buildDefinedTermSet emits DefinedTerm entries', () => {
    const d = buildDefinedTermSet({
      name: 'Eurovision Glossary',
      url: 'https://eurovision.games/en/glossary',
      terms: [
        { name: 'Douze points', description: 'The maximum 12 points awarded by each jury or televote pool.' },
      ],
    });
    expect(d['@type']).toBe('DefinedTermSet');
    expect(d.hasDefinedTerm).toHaveLength(1);
    expect(d.hasDefinedTerm[0]['@type']).toBe('DefinedTerm');
  });

  it('buildItemList preserves order', () => {
    const i = buildItemList({
      name: 'Top picks',
      items: [
        { name: 'Sweden', url: '...' },
        { name: 'Italy', url: '...' },
      ],
    });
    expect(i.itemListElement[0].position).toBe(1);
    expect(i.itemListElement[1].position).toBe(2);
  });

  it('buildWebSite includes SearchAction', () => {
    const w = buildWebSite();
    expect(w.potentialAction['@type']).toBe('SearchAction');
  });
});
