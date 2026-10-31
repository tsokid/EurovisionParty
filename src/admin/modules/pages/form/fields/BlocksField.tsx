// A blocks() zone: an ordered list of blocks, each one of the block types
// (text, image, video, callout, faq, cta). Every block's `type` is locale-
// shared, so both locales hold the same blocks in the same order: add,
// move and remove always apply to both at the same index.
//
// A block is drawn from the schema of ITS type (schemaInfo().variants, keyed
// by the `type` value), never looked up by path: `body` is rich text in a text
// block but plain multiline text in a cta block. The `type` itself is not an
// editable field; to change it, remove the block and add another.
import { useState } from 'react';
import { emptyValue } from '../../../../../../supabase/functions/_shared/cms/emptyValue';
import { useFormApi, useIssues } from '../context';
import { asArray, childLabel, editLocales, humanize, joinName, joinPath, LOCALES, moveItem, schemaInfo, updateIn, type Locale, type Segment } from '../formModel';
import type { z } from 'zod';
import { Field, type FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELDSET, HELP, INPUT, LEGEND, SMALL_BUTTON } from './styles';

const TYPE_LABEL: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  callout: 'Callout',
  faq: 'FAQ',
  cta: 'Call to action',
};

const blockTypeLabel = (type: string) => TYPE_LABEL[type] ?? humanize(type);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const at = (v: unknown, key: Segment) => (isRecord(v) ? v[key as string] : undefined);

export function BlocksField({ schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare }: FieldProps) {
  const { edit } = useFormApi();
  const issues = useIssues(path);
  const info = schemaInfo(schema);
  const variants = info.variants!;
  const types = Object.keys(variants);
  const [pick, setPick] = useState(types[0]);
  const present = LOCALES.filter((l) => (l === 'en' ? hasEn : hasEl));
  const items: Record<Locale, unknown[]> = { en: hasEn ? asArray(en) : [], el: hasEl ? asArray(el) : [] };
  const count = Math.max(items.en.length, items.el.length);

  const change = (fn: (arr: unknown[]) => unknown[]) =>
    edit((doc) => editLocales(doc, present, (root) => updateIn(root, segments, (arr) => fn(asArray(arr)))));
  // A fresh empty block per locale (emptyValue never shares containers).
  const add = (type: string) => change((arr) => [...arr, emptyValue(variants[type])]);

  const body = (
    <>
      {info.meta.help && <p className={HELP}>{info.meta.help}</p>}
      <IssueList issues={issues} withLocale />
      {Array.from({ length: count }, (_, i) => (
        <BlockItem
          key={i}
          index={i}
          count={count}
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
          onMove={(to) => change((arr) => moveItem(arr, i, to))}
          onRemove={() => change((arr) => arr.filter((_, n) => n !== i))}
        />
      ))}
      {count === 0 && <p className="text-xs text-white/40">No blocks yet.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Block type for ${name}`} value={pick} onChange={(e) => setPick(e.target.value)} className={`${INPUT} w-auto`}>
          {types.map((t) => (
            <option key={t} value={t} className="bg-[#1a0a2e]">{blockTypeLabel(t)}</option>
          ))}
        </select>
        <button type="button" aria-label={`Add block to ${name}`} onClick={() => add(pick)} className={SMALL_BUTTON}>+ Add block</button>
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

type ItemProps = {
  index: number;
  count: number;
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
  onMove: (to: number) => void;
  onRemove: () => void;
};

function BlockItem({ index: i, count, variants, discriminator, segments, path, name, en, el, hasEn, hasEl, shared, onMove, onRemove }: ItemProps) {
  const itemPath = joinPath(path, i);
  const issues = useIssues(itemPath);
  const typeIssues = useIssues(joinPath(itemPath, discriminator));
  const typeOf = (v: unknown, has: boolean) => {
    const t = has ? at(v, discriminator) : undefined;
    return typeof t === 'string' ? t : undefined;
  };
  const tEn = typeOf(en, hasEn);
  const tEl = typeOf(el, hasEl);
  const type = tEn ?? tEl;
  const variant = type !== undefined && Object.prototype.hasOwnProperty.call(variants, type) ? variants[type] : undefined;
  const mismatch = tEn !== undefined && tEl !== undefined && tEn !== tEl;
  const itemName = joinName(name, `Block ${i + 1}`);
  const title = type === undefined ? 'No type' : blockTypeLabel(type);

  return (
    <fieldset className="rounded border border-white/10 p-2 space-y-2">
      <legend className="px-1 text-xs text-white/60">{`Block ${i + 1}: ${title}`}</legend>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Move ${itemName} up`} disabled={i === 0} onClick={() => onMove(i - 1)} className={SMALL_BUTTON}>↑</button>
        <button type="button" aria-label={`Move ${itemName} down`} disabled={i >= count - 1} onClick={() => onMove(i + 1)} className={SMALL_BUTTON}>↓</button>
        <button type="button" aria-label={`Remove ${itemName}`} onClick={onRemove} className={`${SMALL_BUTTON} text-red-300`}>Remove</button>
      </div>
      {mismatch && (
        <p role="alert" className="text-xs text-red-300">
          {`EN is a ${blockTypeLabel(tEn)} block, EL a ${blockTypeLabel(tEl)} block: remove this block and add it again`}
        </p>
      )}
      {!variant && <p role="alert" className="text-xs text-red-300">Unknown block type: remove this block</p>}
      <IssueList issues={issues} withLocale />
      <IssueList issues={typeIssues} withLocale />
      {variant && schemaInfo(variant).children
        .filter((c) => c.key !== discriminator)
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
  );
}
