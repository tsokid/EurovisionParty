// A group (named fields) or a tuple (fixed positions, "Item n"): a fieldset
// named by its label or humanised key. The root group is drawn without one.
// image() and video() are groups too: their media fields draw as pickers
// (MediaRefField); a video with no poster is reminded that one is required.
// Derived fields (an image's width and height, written by publish) are not
// drawn: they are kept as they are and recomputed at publish.
import type { z } from 'zod';
import type { LayoutSection } from '../../../../../../supabase/functions/_shared/cms/fields';
import { fieldAt } from '../../../../../../supabase/functions/_shared/cms/walk';
import { useIssues } from '../context';
import { childLabel, getIn, joinName, joinPath, schemaInfo } from '../formModel';
import { Field, type FieldProps } from './Field';
import { BlocksField } from './BlocksField';
import { IssueList } from './IssueList';
import { FIELDSET, HELP, LEGEND } from './styles';
import { t } from '../../../../i18n';

const at = (v: unknown, key: string | number) => (v && typeof v === 'object' ? (v as Record<string | number, unknown>)[key] : undefined);

const isBlank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

export const POSTER_REQUIRED_TEXT: string = t.form.poster;

/** Whether the field at `path` is drawn inside a layout section (it, or every one of its children). */
function covered(schema: z.ZodType, path: string, inSections: ReadonlySet<string>): boolean {
  if (inSections.has(path)) return true;
  const { meta, children } = schemaInfo(schema);
  if (meta.kind !== 'group' || !children.length) return false;
  return children.every((c) => covered(c.schema, joinPath(path, c.key), inSections));
}

const textAt = (v: unknown, path: string) => {
  const s = getIn(v, path.split('.'));
  return typeof s === 'string' ? s.trim() : '';
};

export function GroupField({ schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare }: FieldProps) {
  const issues = useIssues(path);
  const { meta, children } = schemaInfo(schema);
  const isShared = shared || !!meta.shared;
  // The root of a section-based page: its sections are drawn inside the layout, in layout order.
  const layoutChild = !segments.length ? children.find((c) => schemaInfo(c.schema).meta.sections) : undefined;
  const sections: readonly LayoutSection[] = layoutChild ? schemaInfo(layoutChild.schema).meta.sections! : [];
  const inSections = new Set(sections.flatMap((s) => s.fields));
  const isCovered = (key: string | number, child: z.ZodType) => !!layoutChild && key !== layoutChild.key && covered(child, String(key), inSections);
  // The layout is drawn where the page's first section field was.
  const firstCovered = layoutChild ? (children.find((c) => isCovered(c.key, c.schema))?.key ?? layoutChild.key) : undefined;

  const renderLayout = () => {
    const key = layoutChild!.key;
    const l = childLabel(key, layoutChild!.schema);
    return (
      <BlocksField
        key={String(key)}
        schema={layoutChild!.schema}
        segments={[key]}
        path={String(key)}
        name={l}
        label={l}
        en={at(en, key)}
        el={at(el, key)}
        hasEn={hasEn}
        hasEl={hasEl}
        shared={false}
        sectionTitle={(s) => textAt(en, s.title) || textAt(el, s.title)}
        renderSection={(s, sectionName) => s.fields.map((f) => {
          const child = fieldAt(schema, f);
          if (!child) return null;
          const segs = f.split('.');
          const fl = childLabel(segs[segs.length - 1], child);
          return (
            <Field
              key={f}
              schema={child}
              segments={segs}
              path={f}
              name={joinName(sectionName, fl)}
              label={fl}
              en={getIn(en, segs)}
              el={getIn(el, segs)}
              hasEn={hasEn}
              hasEl={hasEl}
              shared={false}
              bare={s.fields.length === 1}
            />
          );
        })}
      />
    );
  };

  const body = (
    <>
      {meta.help && <p className={HELP}>{meta.help}</p>}
      {meta.kind === 'video' && !isBlank(at(hasEn ? en : el, 'media')) && isBlank(at(hasEn ? en : el, 'poster')) && (
        <p className="text-xs text-amber-300">{POSTER_REQUIRED_TEXT}</p>
      )}
      <IssueList issues={issues} withLocale />
      {children.filter(({ schema: child }) => !schemaInfo(child).meta.derived && !schemaInfo(child).meta.hidden).map(({ key, schema: child }) => {
        if (layoutChild && key === firstCovered) return renderLayout();
        if (layoutChild && (key === layoutChild.key || isCovered(key, child))) return null;
        const l = childLabel(key, child);
        return (
          <Field
            key={key}
            schema={child}
            segments={[...segments, key]}
            path={joinPath(path, key)}
            name={joinName(name, l)}
            label={l}
            en={at(en, key)}
            el={at(el, key)}
            hasEn={hasEn}
            hasEl={hasEl}
            shared={isShared}
          />
        );
      })}
    </>
  );
  if (!segments.length || bare) return <div className="space-y-3">{body}</div>;
  return (
    <fieldset className={FIELDSET}>
      <legend className={LEGEND}>{label}</legend>
      {body}
    </fieldset>
  );
}
