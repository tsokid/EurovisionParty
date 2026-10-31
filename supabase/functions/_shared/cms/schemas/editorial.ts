// The editorial layer of a data page (spec §5): archive-{year},
// country-{iso} and hub-{year} share this schema. In effect every field is
// optional: an empty intro and no blocks render nothing. The intro renders
// under the hero, the image as the hero image, the blocks before the related
// links; metaDescription replaces the page's templated description.
import type { z } from 'zod';
import { blocks, group, image, optional, richText } from '../fields.ts';
import { metaDescription } from './common.ts';

export const editorialSchema = group({
  intro: richText({ label: 'Intro', help: 'Shown under the page heading. Leave empty for none.', required: false }),
  image: optional(image({ label: 'Hero image', help: 'Shown near the top of the page and loaded first' })),
  blocks: blocks({ label: 'Blocks', help: 'Shown after the data tables, before the related links' }),
  metaDescription: optional(metaDescription({
    help: 'Replaces the automatic search-result snippet; about 160 characters at most',
  })),
});

export type EditorialContent = z.infer<typeof editorialSchema>;
