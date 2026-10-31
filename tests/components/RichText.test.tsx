import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RichText from '../../src/components/cms/RichText';

const r = (source: string) => render(<MemoryRouter><RichText source={source} /></MemoryRouter>).container;

describe('<RichText>', () => {
  it('renders paragraphs, bold, italic, headings and lists', () => {
    const c = r('### Title\n\nHello **bold** and *it*.\n\n- a\n- b\n\n1. x');
    expect(c.querySelector('h3')!.textContent).toBe('Title');
    expect(c.querySelector('p strong')!.textContent).toBe('bold');
    expect(c.querySelector('p em')!.textContent).toBe('it');
    expect([...c.querySelectorAll('ul li')].map((l) => l.textContent)).toEqual(['a', 'b']);
    expect(c.querySelectorAll('ol li')).toHaveLength(1);
  });

  it('renders an internal link through LocaleLink (a router link, same tab)', () => {
    const a = r('[FAQ](/faq)').querySelector('a')!;
    expect(a.getAttribute('href')).toMatch(/\/faq$/);
    expect(a.getAttribute('target')).toBeNull();
  });

  it('renders an https link in a new tab with rel noopener noreferrer', () => {
    const a = r('[site](https://example.org/x)').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.org/x');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('never turns markup or an unsafe link into elements', () => {
    const c = r('<img src=x onerror=alert(1)> [x](javascript:alert(1))');
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('a')).toBeNull();
    expect(c.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('never nests an anchor in an anchor, even for invalid source', () => {
    const c = r('[ [y](/z) ](/w)');
    expect(c.querySelectorAll('a')).toHaveLength(1);
    expect(c.querySelector('a a')).toBeNull();
  });

  it('renders nothing for an empty source', () => {
    expect(r('').innerHTML).toBe('');
  });
});
