// A group (named fields) or a tuple (fixed positions, "Item n"): a fieldset
// named by its label or humanised key. The root group is drawn without one.
// image() and video() are groups too: their media fields draw as pickers
// (MediaRefField); a video with no poster is reminded that one is required.
import { useIssues } from '../context';
import { childLabel, joinName, joinPath, schemaInfo } from '../formModel';
import { Field, type FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELDSET, HELP, LEGEND } from './styles';

const at = (v: unknown, key: string | number) => (v && typeof v === 'object' ? (v as Record<string | number, unknown>)[key] : undefined);

const isBlank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

export const POSTER_REQUIRED_TEXT = 'A poster image is required: it shows until the video plays.';

export function GroupField({ schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare }: FieldProps) {
  const issues = useIssues(path);
  const { meta, children } = schemaInfo(schema);
  const isShared = shared || !!meta.shared;
  const body = (
    <>
      {meta.help && <p className={HELP}>{meta.help}</p>}
      {meta.kind === 'video' && !isBlank(at(hasEn ? en : el, 'media')) && isBlank(at(hasEn ? en : el, 'poster')) && (
        <p className="text-xs text-amber-300">{POSTER_REQUIRED_TEXT}</p>
      )}
      <IssueList issues={issues} withLocale />
      {children.map(({ key, schema: child }) => {
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
