// One node of the form, dispatched on its field kind. Memoised on path and
// values: typing in a field re-renders only that field and its ancestors,
// never its siblings (the document is updated with structural sharing).
import { memo } from 'react';
import type { z } from 'zod';
import { useFormApi } from '../context';
import { schemaInfo, type Segment } from '../formModel';
import { GroupField } from './GroupField';
import { LeafField } from './LeafField';
import { ListField } from './ListField';
import { OptionalField } from './OptionalField';

export type FieldProps = {
  schema: z.ZodType;
  /** Path from the locale root (list indices as numbers). */
  segments: Segment[];
  /** `segments` joined with dots: the path errors and warnings are reported at. */
  path: string;
  /** Full display path, e.g. "FAQ › Item 1 › Question" ("" at the root). */
  name: string;
  /** This field's own label, e.g. "Question". */
  label: string;
  en: unknown;
  el: unknown;
  /** Whether the position exists in each locale (false for an item only the other locale's list has). */
  hasEn: boolean;
  hasEl: boolean;
  /** Inside a locale-shared container: every field is edited once for both locales. */
  shared: boolean;
  /** Drawn inside a list item, which already shows the item's heading. */
  bare?: boolean;
};

function FieldImpl(props: FieldProps) {
  const { rendered } = useFormApi();
  rendered(props.path);
  const { meta } = schemaInfo(props.schema);
  if (meta.optional) return <OptionalField {...props} />;
  switch (meta.kind) {
    case 'group':
    case 'tuple':
      return <GroupField {...props} />;
    case 'list':
      return <ListField {...props} />;
    default:
      return <LeafField {...props} />;
  }
}

const sameField = (a: FieldProps, b: FieldProps) =>
  a.schema === b.schema &&
  a.path === b.path &&
  a.name === b.name &&
  a.label === b.label &&
  a.en === b.en &&
  a.el === b.el &&
  a.hasEn === b.hasEn &&
  a.hasEl === b.hasEl &&
  a.shared === b.shared &&
  a.bare === b.bare;

export const Field = memo(FieldImpl, sameField);
