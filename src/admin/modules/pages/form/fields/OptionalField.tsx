// An optional field: "Add" sets its empty value, "Remove" deletes the key
// (both locales, so the translations stay aligned). Present in either locale
// means present: the inner field is shown, and a locale without it edits from
// empty.
import { emptyValue } from '../../../../../../supabase/functions/_shared/cms/emptyValue';
import { useFormApi, useIssues } from '../context';
import { editLocales, getIn, LOCALES, removeIn, schemaInfo, setIn } from '../formModel';
import { Field, type FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELD_LABEL, SMALL_BUTTON } from './styles';
import { t } from '../../../../i18n';

export function OptionalField(props: FieldProps) {
  const { schema, segments, path, name, label, en, el, hasEn, hasEl } = props;
  const { edit } = useFormApi();
  const issues = useIssues(path);
  const inner = schemaInfo(schema).inner!;
  const present = LOCALES.filter((l) => (l === 'en' ? hasEn : hasEl));
  const isSet = (hasEn && en !== undefined) || (hasEl && el !== undefined);

  const add = () =>
    edit((doc) => editLocales(doc, present, (root) => (getIn(root, segments) === undefined ? setIn(root, segments, emptyValue(inner)) : root)));
  const remove = () => edit((doc) => editLocales(doc, present, (root) => removeIn(root, segments)));

  if (!isSet) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {!props.bare && <span className={FIELD_LABEL}>{label}</span>}
          <span className="text-xs text-white/40">{t.form.optionalUnset}</span>
          <button type="button" aria-label={t.form.addOf(name)} onClick={add} className={SMALL_BUTTON}>{t.form.add}</button>
        </div>
        <IssueList issues={issues} withLocale />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Field {...props} schema={inner} />
      <button type="button" aria-label={t.form.removeOf(name)} onClick={remove} className={`${SMALL_BUTTON} text-red-300`}>
        {t.form.removeLabel(label)}
      </button>
    </div>
  );
}
