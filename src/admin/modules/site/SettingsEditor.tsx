// /admin/settings: the site-wide values (site name, default share image,
// the organization for search engines, social profiles, contact email).
// Not translated, except the social profiles' names.
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Field, IconButton, TextInput, useToast } from '../../ui/kit';
import { SiteDocFrame, Section } from './SiteDocFrame';
import { useSiteDraft, type Locale, type LooseDoc } from './useSiteDraft';
import { adminPaths } from '../../paths';

const LOCALES: Locale[] = ['en', 'el'];

/** Sets a locale-shared value in both locales. */
const setShared = (d: LooseDoc, fn: (slice: LooseDoc[Locale]) => LooseDoc[Locale]): LooseDoc => ({ en: fn(d.en), el: fn(d.el) });

export default function SettingsEditor() {
  const draft = useSiteDraft('site-settings');
  const { doc, setDoc, errorAt } = draft;
  const toast = useToast();
  const en = doc.en;
  const err = (p: string) => errorAt(p, 'en') ?? errorAt(p, 'el');

  const text = (label: string, path: 'siteName' | 'contactEmail' | 'defaultOgImage', hint?: string, inputMode?: 'email' | 'url') => (
    <Field label={label} hint={hint} error={err(path)}>
      <TextInput
        value={en[path]}
        invalid={!!err(path)}
        inputMode={inputMode}
        onChange={(e) => { const v = e.target.value; setDoc((d: LooseDoc) => setShared(d, (s) => ({ ...s, [path]: v }))); }}
      />
    </Field>
  );

  const profiles: Array<{ label: string; href: string }> = en.socialProfiles;

  return (
    <SiteDocFrame
      draft={draft}
      title="Ρυθμίσεις"
      lede={<>
        Στοιχεία που ισχύουν για όλο το site, σε ένα σημείο. Οι σελίδες θα τα διαβάζουν από εδώ στη φάση P6· μέχρι τότε
        οι τιμές τους είναι ίδιες με αυτές. Ποιος μπαίνει στο admin: <Link to={adminPaths.admins()} className="text-stage-pink-2 hover:underline">Super admins</Link>.
      </>}
    >
      <Section title="Το site">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('Όνομα του site', 'siteName')}
          {text('Email επικοινωνίας', 'contactEmail', undefined, 'email')}
        </div>
      </Section>

      <Section title="Κοινοποίηση και μηχανές αναζήτησης" hint="Διευθύνσεις που ξεκινούν με https://">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            {text('Εικόνα κοινοποίησης (όταν μια σελίδα δεν έχει δική της)', 'defaultOgImage', undefined, 'url')}
            {/^https:\/\//.test(en.defaultOgImage) && (
              <img src={en.defaultOgImage} alt="" className="h-16 w-auto max-w-40 rounded-stage-sm border border-stage-line bg-stage-bg object-contain" />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Όνομα οργανισμού" error={err('organization.name')}>
              <TextInput
                value={en.organization.name}
                invalid={!!err('organization.name')}
                onChange={(e) => { const v = e.target.value; setDoc((d: LooseDoc) => setShared(d, (s) => ({ ...s, organization: { ...s.organization, name: v } }))); }}
              />
            </Field>
            <Field label="Λογότυπο (τετράγωνο)" error={err('organization.logo')}>
              <TextInput
                value={en.organization.logo}
                inputMode="url"
                invalid={!!err('organization.logo')}
                onChange={(e) => { const v = e.target.value; setDoc((d: LooseDoc) => setShared(d, (s) => ({ ...s, organization: { ...s.organization, logo: v } }))); }}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Social media" hint="Τα προφίλ του site. Κανένα ακόμα: προσθέστε όποτε χρειαστεί.">
        <ul className="space-y-2">
          {profiles.map((p, i) => (
            <li key={i} className="rounded-stage border border-stage-line bg-stage-bg-2 p-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
              {LOCALES.map((l) => (
                <Field key={l} label={l === 'en' ? 'Όνομα · English' : 'Όνομα · Ελληνικά'} error={errorAt(`socialProfiles.${i}.label`, l)}>
                  <TextInput
                    value={doc[l].socialProfiles[i]?.label ?? ''}
                    lang={l}
                    invalid={!!errorAt(`socialProfiles.${i}.label`, l)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDoc((d: LooseDoc) => ({ ...d, [l]: { ...d[l], socialProfiles: d[l].socialProfiles.map((x: object, j: number) => (j === i ? { ...x, label: v } : x)) } }));
                    }}
                  />
                </Field>
              ))}
              <Field label="Διεύθυνση" error={err(`socialProfiles.${i}.href`)}>
                <TextInput
                  value={p.href}
                  inputMode="url"
                  invalid={!!err(`socialProfiles.${i}.href`)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDoc((d: LooseDoc) => setShared(d, (s) => ({ ...s, socialProfiles: s.socialProfiles.map((x: object, j: number) => (j === i ? { ...x, href: v } : x)) })));
                  }}
                />
              </Field>
              <IconButton
                label="Διαγραφή"
                className="hover:!text-stage-bad"
                onClick={() => {
                  const before = doc;
                  setDoc((d: LooseDoc) => ({ en: { ...d.en, socialProfiles: d.en.socialProfiles.filter((_: unknown, j: number) => j !== i) }, el: { ...d.el, socialProfiles: d.el.socialProfiles.filter((_: unknown, j: number) => j !== i) } }));
                  toast.show(`Διαγράφηκε: «${p.label || p.href}»`, () => setDoc(before));
                }}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-secondary btn-sm mt-3"
          onClick={() => setDoc((d: LooseDoc) => ({ en: { ...d.en, socialProfiles: [...d.en.socialProfiles, { label: '', href: 'https://' }] }, el: { ...d.el, socialProfiles: [...d.el.socialProfiles, { label: '', href: 'https://' }] } }))}
        >
          <Plus size={16} aria-hidden />Προσθήκη προφίλ
        </button>
      </Section>
    </SiteDocFrame>
  );
}
