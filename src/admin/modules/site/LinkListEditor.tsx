// One list of links (a footer column, the header, a header menu), edited in
// both languages at once: drag (or the arrows) to reorder, the label in EN
// and EL side by side, where it goes (picked from the site's pages), a
// show/hide switch, and delete with undo. Errors from the doc's validation
// show inline under the field they belong to.
import clsx from 'clsx';
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { IconButton, StatusChip, Switch, TextInput, moveItem, useDragReorder, useToast } from '../../ui/kit';
import { PagePicker } from './PagePicker';
import { describeTarget, type TargetOption } from './targets';
import { targetKey, type LinkTarget } from '../../../../supabase/functions/_shared/cms/siteLinks';
import type { Locale } from './useSiteDraft';

/** A link as the docs hold it, per locale. */
export interface LinkDoc {
  label: string;
  target?: LinkTarget;
  hidden?: boolean;
  children?: LinkDoc[];
}

/** One row: the same link in both languages (targets and order are shared). */
export type LinkRow = Record<Locale, LinkDoc>;

export interface LinkListEditorProps {
  rows: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
  /** Doc path of the list ("columns.0.links"), for its validation errors. */
  path: string;
  errorAt: (path: string, locale?: Locale) => string | null;
  options: TargetOption[];
  allowExternal: boolean;
  /** «Προσθήκη συνδέσμου». */
  addLabel?: string;
  /** What a row is called in the preview's hover label («Σύνδεσμος», «Μενού»). */
  fieldName?: string;
  /** Under a row (a header menu's own links). */
  renderBelow?: (row: LinkRow, index: number) => ReactNode;
  /** Extra add buttons next to «Προσθήκη συνδέσμου». */
  extraActions?: ReactNode;
  emptyText?: string;
}

const LOCALES: Locale[] = ['en', 'el'];
const LOCALE_NAME: Record<Locale, string> = { en: 'English', el: 'Ελληνικά' };

/** Without `hidden: false` noise: a shown link has no hidden key. */
function withHidden(l: LinkDoc, hidden: boolean): LinkDoc {
  const { hidden: _h, ...rest } = l;
  void _h;
  return hidden ? { ...rest, hidden: true } : rest;
}

export function LinkListEditor({
  rows, onChange, path, errorAt, options, allowExternal, addLabel = 'Προσθήκη συνδέσμου', renderBelow, extraActions, emptyText,
  fieldName = 'Σύνδεσμος',
}: LinkListEditorProps) {
  const toast = useToast();
  // null: closed; -1: adding; i: changing row i's target.
  const [picking, setPicking] = useState<number | null>(null);
  const move = (from: number, to: number) => onChange(moveItem(rows, from, to));
  const drag = useDragReorder(move);

  const taken = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((r, i) => { if (r.en.target && i !== picking) keys.add(targetKey(r.en.target)); });
    return keys;
  }, [rows, picking]);

  const update = (i: number, fn: (l: LinkDoc, locale: Locale) => LinkDoc) =>
    onChange(rows.map((r, j) => (j === i ? { en: fn(r.en, 'en'), el: fn(r.el, 'el') } : r)));

  const remove = (i: number) => {
    const before = rows;
    const name = rows[i].el.label || rows[i].en.label || 'ο σύνδεσμος';
    onChange(rows.filter((_, j) => j !== i));
    toast.show(`Διαγράφηκε: «${name}»`, () => onChange(before));
  };

  return (
    <div>
      {rows.length === 0 && emptyText && <p className="t-small px-1 py-3">{emptyText}</p>}
      <ol className="space-y-2">
        {rows.map((row, i) => {
          const target = row.en.target;
          const where = describeTarget(target, options);
          const rowPath = `${path}.${i}`;
          const targetError = errorAt(`${rowPath}.target`, 'en') ?? errorAt(`${rowPath}.target`, 'el')
            ?? errorAt(`${rowPath}.target.pageId`) ?? errorAt(`${rowPath}.target.href`) ?? errorAt(`${rowPath}.target.kind`);
          const hidden = !!row.en.hidden;
          return (
            <li
              key={i}
              {...drag.itemProps(i)}
              className={clsx(
                'rounded-stage border bg-stage-bg-2 transition-colors',
                'data-[drop-target=true]:border-stage-pink data-[dragging=true]:opacity-50',
                hidden ? 'border-dashed border-stage-line-2' : 'border-stage-line',
              )}
            >
              <div className="flex items-start gap-1 p-2 sm:p-3">
                <span
                  {...drag.handleProps(i)}
                  className="hidden sm:grid place-items-center size-9 shrink-0 cursor-grab active:cursor-grabbing text-stage-text-3 hover:text-stage-text"
                  title="Σύρε για αλλαγή σειράς"
                  aria-hidden
                >
                  <GripVertical size={18} />
                </span>
                <div className={clsx('min-w-0 flex-1 space-y-2', hidden && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      onClick={() => setPicking(i)}
                      disabled={!target}
                      className={clsx(
                        'min-w-0 max-w-full text-left rounded-stage-sm px-2 py-1 -mx-2',
                        target ? 'hover:bg-stage-surface-2 cursor-pointer' : 'cursor-default',
                      )}
                      title={target ? 'Αλλαγή σελίδας' : undefined}
                    >
                      <span className="text-sm font-semibold text-stage-text">{where.name}</span>
                      {where.path && <span className="t-meta ml-2 break-all">{where.path}</span>}
                    </button>
                    {hidden && <StatusChip tone="muted">Δεν φαίνεται</StatusChip>}
                  </div>
                  {targetError && <p className="text-[12px] text-stage-bad">{targetError}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LOCALES.map((l) => {
                      const error = errorAt(`${rowPath}.label`, l);
                      return (
                        <div key={l} className="min-w-0">
                          <div className="relative">
                            <span aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-wider text-stage-text-3">{l.toUpperCase()}</span>
                            <TextInput
                              value={row[l].label}
                              invalid={!!error}
                              aria-label={`Κείμενο · ${LOCALE_NAME[l]}`}
                              data-cms-field={`${l}.${rowPath}.label`}
                              data-cms-label={`${fieldName} «${row.el.label || row.en.label || where.name}» (${l.toUpperCase()})`}
                              onChange={(e) => {
                                const v = e.target.value;
                                update(i, (x, loc) => (loc === l ? { ...x, label: v } : x));
                              }}
                              lang={l}
                              className="pl-10"
                            />
                          </div>
                          {error && <p className="text-[12px] text-stage-bad mt-1 mb-0">{error}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 shrink-0">
                  <span className="sm:mr-1 mt-1 sm:mt-0" title={hidden ? 'Εμφάνιση στο site' : 'Απόκρυψη από το site'}>
                    <Switch checked={!hidden} onChange={(on) => update(i, (x) => withHidden(x, !on))} label={hidden ? 'Εμφάνιση στο site' : 'Απόκρυψη από το site'} />
                  </span>
                  <IconButton label="Μετακίνηση πάνω" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={16} aria-hidden /></IconButton>
                  <IconButton label="Μετακίνηση κάτω" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={16} aria-hidden /></IconButton>
                  <IconButton label="Διαγραφή" onClick={() => remove(i)} className="hover:!text-stage-bad"><Trash2 size={16} aria-hidden /></IconButton>
                </div>
              </div>
              {renderBelow?.(row, i)}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicking(-1)} className="btn btn-secondary btn-sm">
          <Plus size={16} aria-hidden />{addLabel}
        </button>
        {extraActions}
      </div>

      <PagePicker
        open={picking !== null}
        title={picking === -1 ? addLabel : 'Αλλαγή σελίδας'}
        options={options}
        taken={taken}
        allowExternal={allowExternal}
        onClose={() => setPicking(null)}
        onPick={({ target, label }) => {
          if (picking === -1) {
            onChange([...rows, { en: { label: label.en, target }, el: { label: label.el, target } }]);
          } else if (picking !== null) {
            update(picking, (x) => ({ ...x, target }));
          }
          setPicking(null);
        }}
      />
    </div>
  );
}

/** The rows of a list held at `get(doc[locale])`, paired by index. */
export function rowsOf(en: LinkDoc[] | undefined, el: LinkDoc[] | undefined): LinkRow[] {
  return (en ?? []).map((l, i) => ({ en: l, el: el?.[i] ?? { ...l } }));
}

/** Splits rows back into the two locales' lists. */
export function splitRows(rows: LinkRow[]): Record<Locale, LinkDoc[]> {
  return { en: rows.map((r) => r.en), el: rows.map((r) => r.el) };
}
