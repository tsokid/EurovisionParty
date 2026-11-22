// A blocks() zone or a page layout (CMS P6, owner decision Q4 = B).
//
// Both are ordered lists whose items' `type` is locale-shared, so both
// locales hold the same items in the same order: add, move, duplicate and
// remove always apply to both at the same index.
//
// - blocks(): every item is a block of the design-system set (text, image,
//   video, callout, faq, cta).
// - layout() (a section-based page): items are also the page's own
//   sections ({ type: 'section', key }). A section card shows the section's
//   fields inside it (renderSection, from the root of the form), moves, and
//   can be removed into «Κρυμμένες ενότητες» and put back, unless it is
//   locked (it feeds JSON-LD). A section is never duplicated. A doc without a
//   layout shows the default order; the first change writes it.
//
// Reorder by dragging the grip, or with the ↑ ↓ buttons (touch, keyboard).
// A block is drawn from the schema of ITS type (schemaInfo().variants), never
// looked up by path: `body` is rich text in a text block but plain multiline
// text in a cta block. A new or duplicated block gets a fresh stable id.
import { useId, useState, type ReactNode } from 'react';
import { Copy, GripVertical, Lock, Plus, RotateCcw } from 'lucide-react';
import type { z } from 'zod';
import { emptyValue } from '../../../../../../supabase/functions/_shared/cms/emptyValue';
import { defaultLayout, SECTION_TYPE, type LayoutSection } from '../../../../../../supabase/functions/_shared/cms/fields';
import { useFormApi, useIssues } from '../context';
import { asArray, childLabel, editLocales, humanize, joinName, joinPath, LOCALES, moveItem, schemaInfo, updateIn, type DocValue, type Locale, type Segment } from '../formModel';
import { Field, type FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELDSET, HELP, INPUT, LEGEND, SMALL_BUTTON } from './styles';
import { useDragReorder, useToast } from '../../../../ui/kit';
import { t } from '../../../../i18n';

const TYPE_LABEL: Record<string, string> = t.form.blockTypes;

export const blockTypeLabel = (type: string) => TYPE_LABEL[type] ?? humanize(type);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const at = (v: unknown, key: Segment) => (isRecord(v) ? v[key as string] : undefined);

/** A new block id: short, lowercase, unique enough within one page. */
export function newBlockId(taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const id = `b-${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
}

const idsIn = (items: readonly unknown[]) =>
  new Set(items.map((it) => at(it, 'id')).filter((x): x is string => typeof x === 'string'));

export type LayoutFieldProps = FieldProps & {
  /** Draws a section's own fields inside its card (a page layout only). */
  renderSection?: (section: LayoutSection, name: string) => ReactNode;
  /** A section's display title, from its title field («Ενότητα · Why we built it»). */
  sectionTitle?: (section: LayoutSection) => string;
};

export function BlocksField(props: LayoutFieldProps) {
  const { schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare, renderSection, sectionTitle } = props;
  const { edit } = useFormApi();
  const toast = useToast();
  const issues = useIssues(path);
  const outer = schemaInfo(schema);
  const list = outer.meta.optional ? outer.inner! : schema;
  const info = schemaInfo(list);
  const sections = info.meta.sections ?? null;
  const variants = info.variants!;
  const blockTypes = Object.keys(variants).filter((ty) => ty !== SECTION_TYPE);
  const [pick, setPick] = useState(blockTypes[0]);
  const pickId = useId();
  const present = LOCALES.filter((l) => (l === 'en' ? hasEn : hasEl));
  // A layout not written yet is its default order.
  const fallback = sections ? defaultLayout(sections) : [];
  const valueOf = (v: unknown, has: boolean) => (!has ? [] : Array.isArray(v) ? v : fallback);
  const items: Record<Locale, unknown[]> = { en: valueOf(en, hasEn), el: valueOf(el, hasEl) };
  const count = Math.max(items.en.length, items.el.length);

  const change = (fn: (arr: unknown[]) => unknown[]) =>
    edit((doc) => editLocales(doc, present, (root) => updateIn(root, segments, (arr) => fn(Array.isArray(arr) ? arr : sections ? defaultLayout(sections) : asArray(arr)))));
  const add = (type: string) => {
    const id = newBlockId(idsIn(items.en));
    change((arr) => [...arr, { ...(emptyValue(variants[type]) as Record<string, unknown>), id }]);
  };
  const duplicate = (i: number) => {
    const id = newBlockId(idsIn(items.en));
    change((arr) => [...arr.slice(0, i + 1), { ...(structuredClone(arr[i]) as Record<string, unknown>), id }, ...arr.slice(i + 1)]);
  };
  const move = (from: number, to: number) => change((arr) => moveItem(arr, from, Math.max(0, Math.min(arr.length - 1, to))));
  const remove = (i: number, what: string) => {
    let before: DocValue | null = null;
    edit((doc) => {
      before = doc;
      return editLocales(doc, present, (root) => updateIn(root, segments, (arr) => (Array.isArray(arr) ? arr : fallback).filter((_, n) => n !== i)));
    });
    toast.show(t.form.removed(what), () => {
      const prev = before;
      if (prev) edit(() => prev);
    });
  };
  const restore = (key: string) => change((arr) => [...arr, { type: SECTION_TYPE, key }]);
  const drag = useDragReorder(move);

  const placed = new Set(items.en.map((it) => (at(it, 'type') === SECTION_TYPE ? String(at(it, 'key')) : '')));
  const hidden = sections?.filter((s) => !placed.has(s.key)) ?? [];

  const body = (
    <>
      {info.meta.help && <p className={HELP}>{info.meta.help}</p>}
      <IssueList issues={issues} withLocale />
      {sections && <p className={HELP}>{t.form.layoutFixed}</p>}
      <ol className="space-y-2" aria-label={label || name}>
        {Array.from({ length: count }, (_, i) => {
          const itEn = items.en[i];
          const isSection = at(itEn ?? items.el[i], 'type') === SECTION_TYPE;
          const section = isSection ? sections?.find((s) => s.key === at(itEn ?? items.el[i], 'key')) : undefined;
          const key = (section ? `s:${section.key}` : String(at(itEn, 'id') ?? '')) || `i:${i}`;
          const common = {
            index: i,
            count,
            itemProps: drag.itemProps(i),
            handleProps: drag.handleProps(i),
            onMove: (to: number) => move(i, to),
          };
          if (isSection) {
            const title = section ? (sectionTitle?.(section) || humanize(section.key)) : String(at(itEn, 'key'));
            const sectionName = joinName(name, t.form.sectionNamed(title));
            return (
              <SectionCard
                key={key}
                {...common}
                name={sectionName}
                title={title}
                locked={!!section?.locked}
                path={joinPath(path, i)}
                onRemove={() => remove(i, title)}
              >
                {section && renderSection?.(section, sectionName)}
                {!section && <p role="alert" className="text-xs text-red-300">{t.form.unknownType}</p>}
              </SectionCard>
            );
          }
          return (
            <BlockItem
              key={key}
              {...common}
              variants={variants}
              discriminator={info.discriminator!}
              segments={segments}
              path={path}
              name={name}
              en={items.en[i]}
              el={items.el[i]}
              hasEn={i < items.en.length}
              hasEl={i < items.el.length}
              shared={shared || !!info.meta.shared}
              onDuplicate={() => duplicate(i)}
              onRemove={(what) => remove(i, what)}
            />
          );
        })}
      </ol>
      {count === 0 && <p className="text-xs text-white/40">{t.form.noBlocks}</p>}
      <div className="flex flex-wrap items-center gap-2 rounded-stage-sm border border-dashed border-white/15 p-2">
        <label htmlFor={pickId} className="sr-only">{t.form.blockTypeFor(name)}</label>
        <select id={pickId} aria-label={t.form.blockTypeFor(name)} value={pick} onChange={(e) => setPick(e.target.value)} className={`${INPUT} w-auto`}>
          {blockTypes.map((ty) => (
            <option key={ty} value={ty} className="bg-[#1a0a2e]">{blockTypeLabel(ty)}</option>
          ))}
        </select>
        <button type="button" aria-label={t.form.addBlockTo(name)} onClick={() => add(pick)} className={`${SMALL_BUTTON} inline-flex items-center gap-1`}>
          <Plus size={12} aria-hidden />{t.form.addBlock}
        </button>
      </div>
      {hidden.length > 0 && (
        <div className="rounded-stage-sm border border-white/10 p-2 space-y-1" data-testid="hidden-sections">
          <p className="text-xs font-semibold text-white/70 m-0">{t.form.hiddenSections}</p>
          <p className={HELP}>{t.form.hiddenSectionsHelp}</p>
          <ul className="space-y-1">
            {hidden.map((s) => {
              const title = sectionTitle?.(s) || humanize(s.key);
              return (
                <li key={s.key} className="flex items-center gap-2 text-sm text-white/70">
                  <span className="flex-1 min-w-0 truncate">{title}</span>
                  <button type="button" aria-label={t.form.restoreSection(title)} onClick={() => restore(s.key)} className={`${SMALL_BUTTON} inline-flex items-center gap-1`}>
                    <RotateCcw size={12} aria-hidden />{t.form.restore}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
  if (bare) return <div className="space-y-2">{body}</div>;
  return (
    <fieldset className={FIELDSET} data-cms-layout={sections ? 'true' : undefined}>
      <legend className={LEGEND}>{label}</legend>
      {body}
    </fieldset>
  );
}

type ItemCommon = {
  index: number;
  count: number;
  itemProps: ReturnType<ReturnType<typeof useDragReorder>['itemProps']>;
  handleProps: ReturnType<ReturnType<typeof useDragReorder>['handleProps']>;
  onMove: (to: number) => void;
};

function Controls({ index: i, count, name, handleProps, onMove, children }: Pick<ItemCommon, 'index' | 'count' | 'handleProps' | 'onMove'> & { name: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span {...handleProps} aria-label={t.form.dragHandle(name)} title={t.form.dragHint} className="cursor-grab text-white/40 hover:text-white/80 px-0.5" role="img">
        <GripVertical size={14} aria-hidden />
      </span>
      <button type="button" aria-label={t.form.moveUp(name)} disabled={i === 0} onClick={() => onMove(i - 1)} className={SMALL_BUTTON}>↑</button>
      <button type="button" aria-label={t.form.moveDown(name)} disabled={i >= count - 1} onClick={() => onMove(i + 1)} className={SMALL_BUTTON}>↓</button>
      {children}
    </div>
  );
}

function SectionCard({ name, title, locked, path, onRemove, children, itemProps, ...common }: ItemCommon & {
  name: string;
  title: string;
  locked: boolean;
  path: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const issues = useIssues(path);
  return (
    <li {...itemProps} className="rounded-stage-sm border border-stage-line bg-white/[0.02] p-2 space-y-2 data-[drop-target=true]:border-stage-pink data-[dragging=true]:opacity-50" data-testid="layout-section">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-stage-pink">{t.form.sectionTag}</span>
        <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">{title}</span>
        {locked && (
          <span className="inline-flex items-center gap-1 text-[11px] text-stage-gold" title={t.form.lockedHint}>
            <Lock size={12} aria-hidden />{t.form.locked}
          </span>
        )}
        <Controls {...common} name={name}>
          <button type="button" aria-label={t.form.duplicateOf(name)} disabled title={t.form.sectionOnce} className={`${SMALL_BUTTON} inline-flex items-center gap-1`}>
            <Copy size={12} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t.form.removeOf(name)}
            disabled={locked}
            title={locked ? t.form.lockedHint : undefined}
            onClick={onRemove}
            className={`${SMALL_BUTTON} text-red-300`}
          >
            {t.form.hide}
          </button>
        </Controls>
      </div>
      <IssueList issues={issues} withLocale />
      <div className="space-y-3">{children}</div>
    </li>
  );
}

type ItemProps = ItemCommon & {
  variants: Record<string, z.ZodType>;
  discriminator: string;
  segments: Segment[];
  path: string;
  name: string;
  en: unknown;
  el: unknown;
  hasEn: boolean;
  hasEl: boolean;
  shared: boolean;
  onDuplicate: () => void;
  onRemove: (what: string) => void;
};

function BlockItem({ index: i, variants, discriminator, segments, path, name, en, el, hasEn, hasEl, shared, onDuplicate, onRemove, itemProps, ...common }: ItemProps) {
  const itemPath = joinPath(path, i);
  const issues = useIssues(itemPath);
  const typeIssues = useIssues(joinPath(itemPath, discriminator));
  const typeOf = (v: unknown, has: boolean) => {
    const ty = has ? at(v, discriminator) : undefined;
    return typeof ty === 'string' ? ty : undefined;
  };
  const tEn = typeOf(en, hasEn);
  const tEl = typeOf(el, hasEl);
  const type = tEn ?? tEl;
  const variant = type !== undefined && Object.prototype.hasOwnProperty.call(variants, type) ? variants[type] : undefined;
  const mismatch = tEn !== undefined && tEl !== undefined && tEn !== tEl;
  const itemName = joinName(name, t.form.block(i + 1));
  const title = type === undefined ? t.form.noType : blockTypeLabel(type);

  return (
    <li {...itemProps} className="rounded border border-white/10 p-2 space-y-2 data-[drop-target=true]:border-stage-pink data-[dragging=true]:opacity-50">
      <fieldset className="space-y-2">
        <legend className="px-1 text-xs text-white/60">{t.form.blockTitle(i + 1, title)}</legend>
        <Controls {...common} index={i} name={itemName}>
          <button type="button" aria-label={t.form.duplicateOf(itemName)} onClick={onDuplicate} className={`${SMALL_BUTTON} inline-flex items-center gap-1`}>
            <Copy size={12} aria-hidden />{t.form.duplicate}
          </button>
          <button type="button" aria-label={t.form.removeOf(itemName)} onClick={() => onRemove(title)} className={`${SMALL_BUTTON} text-red-300`}>{t.form.remove}</button>
        </Controls>
        {mismatch && (
          <p role="alert" className="text-xs text-red-300">
            {t.form.mismatch(blockTypeLabel(tEn), blockTypeLabel(tEl))}
          </p>
        )}
        {!variant && <p role="alert" className="text-xs text-red-300">{t.form.unknownType}</p>}
        <IssueList issues={issues} withLocale />
        <IssueList issues={typeIssues} withLocale />
        {variant && schemaInfo(variant).children
          .filter((c) => c.key !== discriminator && !schemaInfo(c.schema).meta.hidden)
          .map(({ key, schema: child }) => {
            const l = childLabel(key, child);
            return (
              <Field
                key={key}
                schema={child}
                segments={[...segments, i, key]}
                path={joinPath(itemPath, key)}
                name={joinName(itemName, l)}
                label={l}
                en={at(en, key)}
                el={at(el, key)}
                // A locale whose block is another type is not edited as this one.
                hasEn={hasEn && tEn === type}
                hasEl={hasEl && tEl === type}
                shared={shared}
              />
            );
          })}
      </fieldset>
    </li>
  );
}
