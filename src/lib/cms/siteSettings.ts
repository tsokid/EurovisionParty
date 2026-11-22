/**
 * The site-wide settings doc (content/pages/site-settings.json, CMS P2) as
 * the site reads it (CMS P6: settings were saved but not read before).
 *
 *   siteName          the WebSite JSON-LD name; the logo links' accessible name
 *   defaultOgImage    the share image of a page without its own: og:image and
 *                     twitter:image, the image and publisher logo of the
 *                     Article JSON-LD of the guide pages
 *   organization      the Organization JSON-LD (name, logo) and the author /
 *                     publisher name of the Article JSON-LD
 *   socialProfiles    the Organization's sameAs
 *   contactEmail      not rendered on any page yet (the pages' copy writes
 *                     its addresses in its own text)
 *
 * The values are not translated (both locales hold the same ones), so the
 * English slice is read. Bundled like the header and footer (siteChrome.ts):
 * never inlined in a page's #__content__, never fetched, so with the seeded
 * values every page renders byte for byte as before. Inside the admin
 * preview useSiteSettings() returns the settings draft.
 */
import { publishedSiteDoc, useSiteDoc } from './siteChrome';
import type { SiteSettingsContent } from '../../../supabase/functions/_shared/cms/schemas/site-settings';

export type { SiteSettingsContent };

/** The published settings (plain function: for code outside React, such as the head tags and the schema builders). */
export function siteSettings(): SiteSettingsContent {
  return publishedSiteDoc('site-settings').en;
}

/** The settings in a component: the admin preview's draft, else the published doc. */
export function useSiteSettings(): SiteSettingsContent {
  return useSiteDoc('site-settings');
}

/** The Organization's sameAs: the social profile addresses, in order. */
export const sameAsOf = (s: SiteSettingsContent): string[] => s.socialProfiles.map((p) => p.href);
