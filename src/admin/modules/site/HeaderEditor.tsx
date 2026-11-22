// /admin/header: the links along the top of every page (spec §3). Links and
// menus in order; a menu ("How to play") holds its own links. The room
// buttons and the menu's words, in both languages, below.
import { useMemo } from 'react';
import { FolderPlus } from 'lucide-react';
import { Field, TextInput } from '../../ui/kit';
import { LinkListEditor, rowsOf, splitRows, type LinkDoc, type LinkRow } from './LinkListEditor';
import { SiteDocFrame, Section } from './SiteDocFrame';
import { targetOptions } from './targets';
import { useSiteDraft, type Locale, type LooseDoc } from './useSiteDraft';

const LOCALES: Locale[] = ['en', 'el'];
const LOCALE_NAME: Record<Locale, string> = { en: 'English', el: 'Ελληνικά' };

/** Label/text pairs of the header (cta.* and ui.*). */
const WORDS: Array<{ group: 'cta' | 'ui'; key: string; label: string }> = [
  { group: 'cta', key: 'createRoom', label: 'Κουμπί «Φτιάξε δωμάτιο»' },
  { group: 'cta', key: 'joinRoom', label: 'Κουμπί «Μπες σε δωμάτιο»' },
  { group: 'ui', key: 'yourRooms', label: 'Τίτλος «Τα δωμάτιά σου» (κινητό)' },
  { group: 'ui', key: 'noRooms', label: 'Όταν δεν υπάρχουν δωμάτια' },
  { group: 'ui', key: 'menu', label: 'Όνομα μενού (για αναγνώστες οθόνης)' },
  { group: 'ui', key: 'openMenu', label: 'Άνοιγμα μενού (για αναγνώστες οθόνης)' },
  { group: 'ui', key: 'closeMenu', label: 'Κλείσιμο μενού (για αναγνώστες οθόνης)' },
];

const HEADER_PREVIEW = {};

export default function HeaderEditor() {
  const draft = useSiteDraft('site-header');
  const { doc, setDoc, errorAt } = draft;
  const options = useMemo(() => targetOptions(), []);

  const items = rowsOf(doc.en.items as LinkDoc[], doc.el.items as LinkDoc[]);
  const setItems = (rows: LinkRow[]) => {
    const { en, el } = splitRows(rows);
    setDoc((d: LooseDoc) => ({ en: { ...d.en, items: en }, el: { ...d.el, items: el } }));
  };
  const setChildren = (index: number, rows: LinkRow[]) => {
    const { en, el } = splitRows(rows);
    setItems(items.map((r, i) => (i === index ? { en: { ...r.en, children: en }, el: { ...r.el, children: el } } : r)));
  };
  const addMenu = () =>
    setItems([...items, { en: { label: 'New menu', children: [] }, el: { label: 'Νέο μενού', children: [] } }]);

  return (
    <SiteDocFrame
      draft={draft}
      preview={HEADER_PREVIEW}
      title="Κεφαλίδα"
      lede="Οι σύνδεσμοι στο πάνω μέρος κάθε σελίδας, με τη σειρά που φαίνονται. Ένα μενού ανοίγει λίστα συνδέσμων (στο κινητό, μέσα στο μενού)."
    >
      <Section title="Σύνδεσμοι" hint="Σύρε ή χρησιμοποίησε τα βελάκια για αλλαγή σειράς. Το «Eurovision {year}» δείχνει πάντα τον τρέχοντα διαγωνισμό.">
        <LinkListEditor
          rows={items}
          onChange={setItems}
          path="items"
          errorAt={errorAt}
          options={options}
          allowExternal={false}
          extraActions={(
            <button type="button" onClick={addMenu} className="btn btn-ghost btn-sm">
              <FolderPlus size={16} aria-hidden />Νέο μενού
            </button>
          )}
          renderBelow={(row, i) => row.en.target ? null : (
            <div className="border-t border-stage-line mx-2 sm:ml-12 sm:mr-3 py-3">
              <p className="t-eyebrow text-[11px] mb-2">Σύνδεσμοι του μενού</p>
              <LinkListEditor
                rows={rowsOf(row.en.children, row.el.children)}
                onChange={(rows) => setChildren(i, rows)}
                path={`items.${i}.children`}
                errorAt={errorAt}
                options={options}
                allowExternal={false}
                addLabel="Προσθήκη στο μενού"
                emptyText="Το μενού δεν έχει συνδέσμους, οπότε δεν φαίνεται στο site."
              />
            </div>
          )}
        />
      </Section>

      <Section title="Κουμπιά και λέξεις του μενού">
        <div className="space-y-4">
          {WORDS.map((w) => (
            <div key={`${w.group}.${w.key}`} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_1fr] sm:items-start">
              <span className="text-sm text-stage-text pt-2 sm:pt-7">{w.label}</span>
              {LOCALES.map((l) => {
                const path = `${w.group}.${w.key}`;
                const error = errorAt(path, l);
                return (
                  <Field key={l} label={LOCALE_NAME[l]} error={error}>
                    <TextInput
                      value={doc[l][w.group][w.key] ?? ''}
                      invalid={!!error}
                      lang={l}
                      data-cms-field={`${l}.${path}`}
                      data-cms-label={`${w.label} (${l.toUpperCase()})`}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDoc((d: LooseDoc) => ({ ...d, [l]: { ...d[l], [w.group]: { ...d[l][w.group], [w.key]: v } } }));
                      }}
                    />
                  </Field>
                );
              })}
            </div>
          ))}
        </div>
      </Section>
    </SiteDocFrame>
  );
}
