// Site-wide settings: the site's name, the share image a page without its own
// uses, the organization in the JSON-LD, social profiles and the contact
// email. Not translated (both languages hold the same values), except the
// labels of the social profiles.
import type { z } from 'zod';
import { group, href, list, text } from '../fields.ts';
import { duplicateTargets } from './link.ts';

const https = (label: string, help: string) => href({ label, help });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const siteSettingsSchema = group({
  siteName: text({ label: 'Site name', shared: true, maxLength: 60 }),
  defaultOgImage: https('Default share image', 'Shown when a page is shared and has no image of its own (https:// address)'),
  organization: group({
    name: text({ label: 'Name', shared: true, maxLength: 80 }),
    logo: https('Logo', 'Square logo for search engines (https:// address)'),
  }, { label: 'Organization (search engines)' }),
  socialProfiles: list(group({
    label: text({ label: 'Name', maxLength: 40 }),
    href: https('Address', 'The profile page (https:// address)'),
  }), { label: 'Social profiles' }).superRefine((items, ctx) => {
    const dupes = duplicateTargets(items.map((p) => ({ kind: 'external' as const, href: p.href })));
    for (const i of dupes) ctx.addIssue({ code: 'custom', path: [i, 'href'], message: 'This profile is already listed' });
    items.forEach((p, i) => {
      if (p.href !== '' && !p.href.startsWith('https://')) ctx.addIssue({ code: 'custom', path: [i, 'href'], message: 'Must be an https:// address' });
    });
  }),
  contactEmail: text({ label: 'Contact email', shared: true, maxLength: 120 }).refine((v) => v.trim() === '' || EMAIL.test(v), 'Not an email address'),
}).superRefine((s, ctx) => {
  for (const k of ['defaultOgImage'] as const) {
    if (s[k] !== '' && !s[k].startsWith('https://')) ctx.addIssue({ code: 'custom', path: [k], message: 'Must be an https:// address' });
  }
  if (s.organization.logo !== '' && !s.organization.logo.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['organization', 'logo'], message: 'Must be an https:// address' });
});

export type SiteSettingsContent = z.infer<typeof siteSettingsSchema>;
