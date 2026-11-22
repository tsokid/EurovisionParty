// /admin/footer and /admin/footer/:column: the four columns at the bottom of
// every page, the tagline under the logo and the disclaimer. With a column in
// the URL only that column is shown (the rest of the footer is one click away).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Field, TextInput, INPUT } from '../../ui/kit';
import { LinkListEditor, rowsOf, splitRows, type LinkDoc, type LinkRow } from './LinkListEditor';
import { SiteDocFrame, Section } from './SiteDocFrame';
import { targetOptions } from './targets';
import { useSiteDraft, type Locale, type LooseDoc } from './useSiteDraft';
import { adminPaths, FOOTER_COLUMN_KEYS, type FooterColumnKey } from '../../paths';
import { FOOTER_COLUMN_ID } from '../../siteStructure';

const LOCALES: Locale[] = ['en', 'el'];
const LOCALE_NAME: Record<Locale, string> = { en: 'English', el: 'Ελληνικά' };

export const COLUMN_TITLE: Record<FooterColumnKey, string> = {
  about: 'Σχετικά',
  'how-to-play': 'Πώς παίζεται',
  eurovision: 'Eurovision',
  help: 'Βοήθεια',
};

export default function FooterEditor({ column }: { column: FooterColumnKey | null }) {
  const draft = useSiteDraft('site-footer');
  const { doc, setDoc, errorAt } = draft;
  const options = useMemo(() => targetOptions(), []);

  const setText = (key: 'tagline' | 'disclaimer', l: Locale, v: string) =>
    setDoc((d: LooseDoc) => ({ ...d, [l]: { ...d[l], [key]: v } }));
  const columnIndex = (key: FooterColumnKey) =>
    (doc.en.columns as Array<{ id: string }>).findIndex((c) => c.id === FOOTER_COLUMN_ID[key]);
  const setColumn = (ci: number, patch: (c: LooseDoc[Locale], l: Locale) => LooseDoc[Locale]) =>
    setDoc((d: LooseDoc) => {
      const next = { en: { ...d.en }, el: { ...d.el } };
      for (const l of LOCALES) next[l].columns = d[l].columns.map((c: unknown, j: number) => (j === ci ? patch(c, l) : c));
      return next;
    });

  const shown = column ? [column] : [...FOOTER_COLUMN_KEYS];

  return (
    <SiteDocFrame
      draft={draft}
      title={column ? `Υποσέλιδο · ${COLUMN_TITLE[column]}` : 'Υποσέλιδο'}
      lede={column
        ? <>Μία από τις τέσσερις στήλες στο κάτω μέρος κάθε σελίδας. <Link to={adminPaths.footer()} className="text-stage-pink-2 hover:underline">Όλο το υποσέλιδο</Link></>
        : 'Οι τέσσερις στήλες στο κάτω μέρος κάθε σελίδας, το σύνθημα κάτω από το λογότυπο και η σημείωση στο τέλος.'}
    >
      {!column && (
        <Section title="Σύνθημα" hint="Κάτω από το λογότυπο, στον υπολογιστή.">
          <div className="grid gap-3 sm:grid-cols-2">
            {LOCALES.map((l) => (
              <Field key={l} label={LOCALE_NAME[l]} error={errorAt('tagline', l)}>
                <TextInput value={doc[l].tagline} lang={l} invalid={!!errorAt('tagline', l)} onChange={(e) => setText('tagline', l, e.target.value)} />
              </Field>
            ))}
          </div>
        </Section>
      )}

      {shown.map((key) => {
        const ci = columnIndex(key);
        if (ci < 0) return null;
        const rows = rowsOf(doc.en.columns[ci].links as LinkDoc[], doc.el.columns[ci].links as LinkDoc[]);
        return (
          <Section
            key={key}
            id={`col-${key}`}
            title={COLUMN_TITLE[key]}
            hint={!column && <Link to={adminPaths.footer(key)} className="text-stage-pink-2 hover:underline">Μόνο αυτή η στήλη</Link>}
          >
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              {LOCALES.map((l) => (
                <Field key={l} label={`Τίτλος στήλης · ${LOCALE_NAME[l]}`} error={errorAt(`columns.${ci}.heading`, l)}>
                  <TextInput
                    value={doc[l].columns[ci].heading}
                    lang={l}
                    invalid={!!errorAt(`columns.${ci}.heading`, l)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setColumn(ci, (c, loc) => (loc === l ? { ...c, heading: v } : c));
                    }}
                  />
                </Field>
              ))}
            </div>
            <LinkListEditor
              rows={rows}
              onChange={(next: LinkRow[]) => {
                const split = splitRows(next);
                setColumn(ci, (c, l) => ({ ...c, links: split[l] }));
              }}
              path={`columns.${ci}.links`}
              errorAt={errorAt}
              options={options}
              allowExternal
              emptyText="Η στήλη δεν έχει συνδέσμους."
            />
          </Section>
        );
      })}

      {!column && (
        <Section title="Σημείωση στο τέλος" hint="Το μικρό κείμενο κάτω-κάτω σε κάθε σελίδα.">
          <div className="grid gap-3 sm:grid-cols-2">
            {LOCALES.map((l) => (
              <Field key={l} label={LOCALE_NAME[l]} error={errorAt('disclaimer', l)}>
                <textarea
                  value={doc[l].disclaimer}
                  lang={l}
                  rows={5}
                  aria-invalid={!!errorAt('disclaimer', l) || undefined}
                  onChange={(e) => setText('disclaimer', l, e.target.value)}
                  className={`${INPUT} h-auto py-2 leading-snug`}
                />
              </Field>
            ))}
          </div>
        </Section>
      )}
    </SiteDocFrame>
  );
}
