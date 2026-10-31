/**
 * The editorial layer of the data pages (CMS 3c, spec §5): the optional docs
 * archive-{year}, country-{iso} and hub-{year} (content/pages/*.json).
 *
 * A page without its doc renders exactly as before: every piece below renders
 * nothing, the description stays the templated one and no JSON-LD is added
 * (editorialContent.ts). With a doc: the intro under the hero, the image as
 * the hero image (eager, high priority) after it, the blocks before the
 * related links, and metaDescription in place of the templated description
 * (meta and og). FAQ blocks become FAQPage JSON-LD during render (effects do
 * not run in SSR).
 *
 * Editorial renders the same on indexable and noindex pages: `indexable`
 * stays the owner's switch in the Contests module.
 */
import RichText from '../../components/cms/RichText';
import CmsImage from '../../components/cms/CmsImage';
import Blocks from '../../components/cms/Blocks';
import type { Editorial } from './editorialContent';

/** The intro, then the hero image: the first children of the page's ContentLayout. */
export function EditorialTop({ editorial }: { editorial: Editorial | null }) {
  if (!editorial) return null;
  const intro = typeof editorial.intro === 'string' && editorial.intro.trim() ? editorial.intro : null;
  return (
    <>
      {intro && <RichText source={intro} />}
      {editorial.image && <CmsImage value={editorial.image} hero />}
    </>
  );
}

/** The blocks: placed before the page's related links. */
export function EditorialBlocks({ editorial }: { editorial: Editorial | null }) {
  return editorial ? <Blocks value={editorial.blocks} /> : null;
}
