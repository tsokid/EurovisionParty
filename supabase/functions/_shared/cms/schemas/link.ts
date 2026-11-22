// Fields of the site-wide docs' links (siteLinks.ts): a target that names a
// page by id, a translated label, and a hidden switch. Targets are
// locale-shared (both languages link to the same place, in the same order).
import { choice, flag, group, href, list, optional, text } from '../fields.ts';
import { FAQ_ANCHOR_IDS } from '../faqTopics.ts';
import {
  DYNAMIC_LINK_KEYS,
  LABEL_PLACEHOLDERS,
  SITE_PAGE_IDS,
  targetKey,
  type LinkKind,
  type LinkTarget,
} from '../siteLinks.ts';

const isSet = (v: unknown) => v !== undefined && !(typeof v === 'string' && v.trim() === '');

/**
 * A link target of the given kinds. Exactly the keys of its kind are set:
 * page → pageId (+ anchor, FAQ only); dynamic → key; external → an https://
 * href. Internal pages are never typed as URLs.
 */
export function linkTarget(kinds: readonly [LinkKind, ...LinkKind[]]) {
  return group({
    kind: choice(kinds, { label: 'Goes to' }),
    pageId: optional(choice(SITE_PAGE_IDS, { label: 'Page' })),
    anchor: optional(choice(FAQ_ANCHOR_IDS, { label: 'Question on the FAQ page' })),
    key: optional(choice(DYNAMIC_LINK_KEYS, { label: 'Contest page' })),
    href: optional(href({ label: 'Web address', help: 'An https:// address on another site' })),
  }, { label: 'Link', shared: true }).superRefine((t, ctx) => {
    const own: Record<LinkKind, string[]> = { page: ['pageId', 'anchor'], dynamic: ['key'], external: ['href'] };
    const v = t as Record<string, unknown>;
    for (const k of ['pageId', 'anchor', 'key', 'href']) {
      if (isSet(v[k]) && !own[t.kind].includes(k)) ctx.addIssue({ code: 'custom', path: [k], message: `Not used by a ${t.kind} link: remove it` });
    }
    if (t.kind === 'page' && !t.pageId) ctx.addIssue({ code: 'custom', path: ['pageId'], message: 'Pick a page' });
    if (t.kind === 'page' && t.anchor && t.pageId !== 'faq') ctx.addIssue({ code: 'custom', path: ['anchor'], message: 'Only an FAQ link can point at a question' });
    if (t.kind === 'dynamic' && !t.key) ctx.addIssue({ code: 'custom', path: ['key'], message: 'Pick a contest page' });
    if (t.kind === 'external' && !(t.href ?? '').startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['href'], message: 'Must be an https:// address' });
  });
}

/** A link's label: required in both languages; may use {year}. */
export const linkLabel = () =>
  text({ label: 'Label', help: 'What visitors read. {year} becomes the live contest year.', placeholders: [...LABEL_PLACEHOLDERS], maxLength: 80 });

/** Hidden links stay in the doc but are not shown on the site. */
export const hiddenFlag = () => optional(flag({ label: 'Hidden', help: 'Kept here, not shown on the site' }));

/** One menu link. */
export const navLink = (kinds: readonly [LinkKind, ...LinkKind[]]) =>
  group({ label: linkLabel(), target: linkTarget(kinds), hidden: hiddenFlag() });

/** Duplicate destinations in one list of links: the index of each repeat. */
export function duplicateTargets(targets: ReadonlyArray<LinkTarget | undefined>): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  targets.forEach((t, i) => {
    if (!t) return;
    const key = targetKey(t);
    if (seen.has(key)) out.push(i);
    seen.add(key);
  });
  return out;
}

/** A list of links where no destination appears twice. */
export const navLinks = (kinds: readonly [LinkKind, ...LinkKind[]], label = 'Links') =>
  list(navLink(kinds), { label }).superRefine((links, ctx) => {
    for (const i of duplicateTargets(links.map((l) => l.target as LinkTarget))) {
      ctx.addIssue({ code: 'custom', path: [i, 'target'], message: 'This page is already in this list' });
    }
  });
