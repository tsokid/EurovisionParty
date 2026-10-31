// A list: items with add, remove and move up/down.
//
// Aligned list (its items hold a locale-shared field, or it sits in a shared
// container): items line up by index across locales, so every operation
// applies to both locales at the same index. Free list: each locale's items
// are added, removed and moved on their own; items are still drawn side by
// side by index.
import { emptyValue } from '../../../../../../supabase/functions/_shared/cms/emptyValue';
import { useFormApi, useIssues } from '../context';
import { asArray, editLocales, joinName, joinPath, LOCALES, moveItem, schemaInfo, updateIn, type Locale } from '../formModel';
import { Field, type FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELDSET, HELP, LEGEND, SMALL_BUTTON } from './styles';

export function ListField({ schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare }: FieldProps) {
  const { edit } = useFormApi();
  const issues = useIssues(path);
  const info = schemaInfo(schema);
  const element = info.element!;
  const isShared = shared || !!info.meta.shared;
  const aligned = isShared || info.holdsShared;
  const present = LOCALES.filter((l) => (l === 'en' ? hasEn : hasEl));
  const items: Record<Locale, unknown[]> = { en: hasEn ? asArray(en) : [], el: hasEl ? asArray(el) : [] };
  const count = Math.max(items.en.length, items.el.length);

  const change = (locales: readonly Locale[], fn: (arr: unknown[]) => unknown[]) =>
    edit((doc) => editLocales(doc, locales, (root) => updateIn(root, segments, (arr) => fn(asArray(arr)))));
  const add = (locales: readonly Locale[]) => change(locales, (arr) => [...arr, emptyValue(element)]);
  const remove = (locales: readonly Locale[], i: number) => change(locales, (arr) => arr.filter((_, n) => n !== i));
  const move = (locales: readonly Locale[], i: number, to: number) => change(locales, (arr) => moveItem(arr, i, to));

  const rows = Array.from({ length: count }, (_, i) => {
    const itemLabel = `Item ${i + 1}`;
    const itemName = joinName(name, itemLabel);
    const controls = (locales: readonly Locale[], suffix: string, len: number) => (
      <div className="flex items-center gap-1">
        {suffix && <span className="text-[10px] font-bold text-white/40">{suffix.trim().slice(1, -1)}</span>}
        <button type="button" aria-label={`Move ${itemName}${suffix} up`} disabled={i === 0} onClick={() => move(locales, i, i - 1)} className={SMALL_BUTTON}>↑</button>
        <button type="button" aria-label={`Move ${itemName}${suffix} down`} disabled={i >= len - 1} onClick={() => move(locales, i, i + 1)} className={SMALL_BUTTON}>↓</button>
        <button type="button" aria-label={`Remove ${itemName}${suffix}`} onClick={() => remove(locales, i)} className={`${SMALL_BUTTON} text-red-300`}>Remove</button>
      </div>
    );
    return (
      <fieldset key={i} className="rounded border border-white/10 p-2 space-y-2">
        <legend className="px-1 text-xs text-white/60">{itemLabel}</legend>
        {aligned ? (
          controls(present, '', count)
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {LOCALES.map((l) => (i < items[l].length ? <div key={l}>{controls([l], ` (${l.toUpperCase()})`, items[l].length)}</div> : <div key={l} />))}
          </div>
        )}
        <Field
          schema={element}
          segments={[...segments, i]}
          path={joinPath(path, i)}
          name={itemName}
          label={itemLabel}
          en={items.en[i]}
          el={items.el[i]}
          hasEn={i < items.en.length}
          hasEl={i < items.el.length}
          shared={isShared}
          bare
        />
      </fieldset>
    );
  });

  const body = (
    <>
      {info.meta.help && <p className={HELP}>{info.meta.help}</p>}
      <IssueList issues={issues} withLocale />
      {rows}
      <div className="flex flex-wrap gap-2">
        {aligned ? (
          <button type="button" aria-label={`Add item to ${name}`} onClick={() => add(present)} className={SMALL_BUTTON}>+ Add item</button>
        ) : (
          present.map((l) => (
            <button key={l} type="button" aria-label={`Add item to ${name} (${l.toUpperCase()})`} onClick={() => add([l])} className={SMALL_BUTTON}>
              + Add {l.toUpperCase()} item
            </button>
          ))
        )}
      </div>
    </>
  );
  if (bare) return <div className="space-y-2">{body}</div>;
  return (
    <fieldset className={FIELDSET}>
      <legend className={LEGEND}>{label}</legend>
      {body}
    </fieldset>
  );
}
