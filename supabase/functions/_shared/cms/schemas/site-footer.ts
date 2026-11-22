// The site footer (SiteFooter.tsx): the tagline under the logo, four columns
// in a fixed order (About, How to play, Eurovision, Help) and the
// disclaimer. Footer links may also go to another site (https://).
import type { z } from 'zod';
import { choice, group, multiline, text, tuple } from '../fields.ts';
import { navLinks } from './link.ts';
import type { FooterColumnId } from '../siteLinks.ts';

const KINDS = ['page', 'dynamic', 'external'] as const;

const column = <const C extends FooterColumnId>(id: C) =>
  group({
    id: choice([id] as [C], { label: 'Column' }),
    heading: text({ label: 'Heading', maxLength: 40 }),
    links: navLinks(KINDS),
  });

export const siteFooterSchema = group({
  tagline: text({ label: 'Tagline', help: 'Under the logo', maxLength: 120 }),
  columns: tuple([column('about'), column('howToPlay'), column('eurovision'), column('help')], { label: 'Columns' }),
  disclaimer: multiline({ label: 'Disclaimer', help: 'The small print at the bottom of every page' }),
});

export type SiteFooterContent = z.infer<typeof siteFooterSchema>;
