// The site header (SiteHeader.tsx): its links in order, the room buttons and
// the menu's own words. An item is a link, or a menu ("How to play") whose
// links open in a popover on desktop and a section of the mobile drawer.
// Header links stay on this site: pages and contest pages, no web addresses.
import type { z } from 'zod';
import { group, list, optional, text } from '../fields.ts';
import { duplicateTargets, hiddenFlag, linkLabel, linkTarget, navLinks } from './link.ts';
import type { LinkTarget } from '../siteLinks.ts';

const KINDS = ['page', 'dynamic'] as const;

const item = group({
  label: linkLabel(),
  target: optional(linkTarget(KINDS)),
  hidden: hiddenFlag(),
  children: optional(navLinks(KINDS, 'Menu links')),
}).superRefine((it, ctx) => {
  if (it.target && it.children) ctx.addIssue({ code: 'custom', path: ['children'], message: 'An item is a link or a menu, not both' });
  if (!it.target && !it.children) ctx.addIssue({ code: 'custom', path: ['target'], message: 'Pick a page, or make it a menu' });
});

export const siteHeaderSchema = group({
  items: list(item, { label: 'Links' }).superRefine((items, ctx) => {
    for (const i of duplicateTargets(items.map((it) => it.target as LinkTarget | undefined))) {
      ctx.addIssue({ code: 'custom', path: [i, 'target'], message: 'This page is already in the header' });
    }
  }),
  cta: group({
    createRoom: text({ label: 'Create button', maxLength: 40 }),
    joinRoom: text({ label: 'Join button', maxLength: 40 }),
  }, { label: 'Room buttons' }),
  ui: group({
    menu: text({ label: 'Menu name (screen readers)' }),
    openMenu: text({ label: 'Open menu (screen readers)' }),
    closeMenu: text({ label: 'Close menu (screen readers)' }),
    yourRooms: text({ label: 'Your rooms' }),
    noRooms: text({ label: 'No rooms yet' }),
  }, { label: 'Menu words' }),
});

export type SiteHeaderContent = z.infer<typeof siteHeaderSchema>;
