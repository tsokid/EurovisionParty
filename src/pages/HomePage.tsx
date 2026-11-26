import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NameEntry, { type NameEntryData } from '../components/onboarding/NameEntry';
import HomeSeoBlock from '../components/seo/HomeSeoBlock';
import HomeHero from '../components/home/HomeHero';
import HomeSections from '../components/home/HomeSections';
import SiteFooter from '../components/seo/SiteFooter';
import PageSeo from '../components/seo/PageSeo';
import { useLocale } from '../lib/seo/LocaleContext';
import { localizePath } from '../lib/seo/locale';
import { usePageContent } from '../lib/cms/usePageContent';
import { mergeFaqJsonLd } from '../components/cms/extraFaq';
import type { HomeContent } from '../../supabase/functions/_shared/cms/schemas/home';
import { interpolate } from '../../supabase/functions/_shared/cms/placeholders';
import { useCurrentYear } from '../lib/currentContest';
import { useAuth } from '../hooks/useAuth';
import { useRoom, SecretSaveError, WRONG_PASSWORD_ERROR } from '../hooks/useRoom';
import { useTranslation } from 'react-i18next';
import { captureQrPassword, peekQrPassword, clearQrPassword } from '../lib/qrJoin';
import { useSiteSettings } from '../lib/cms/siteSettings';

type Mode = 'welcome' | 'create' | 'join';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('join') || '';
  const action = searchParams.get('action');
  const initialMode: Mode = prefillCode || action === 'join' ? 'join' : action === 'create' ? 'create' : 'welcome';
  const [mode, setMode] = useState<Mode>(initialMode);
  // Code typed in the hero's join form (prefills the join screen).
  const [joinCode, setJoinCode] = useState('');
  // Lobby QR: RoomPage took the password off `#k=` before sending a
  // non-member here (a direct ?join=CODE#k=… link is read here too).
  const [qrPassword] = useState(() => captureQrPassword(prefillCode) ?? peekQrPassword(prefillCode));
  const { isLoading: authLoading } = useAuth();
  const { createRoom, joinRoom, retryRealName, isLoading, error } = useRoom();
  const { t } = useTranslation();
  // The player row exists but the real name is not stored yet: retry only that.
  const [secretPending, setSecretPending] = useState(false);
  const navigate = useNavigate();
  const locale = useLocale();
  const settings = useSiteSettings();
  const year = useCurrentYear();
  // The SEO copy (head tags and HomeSeoBlock) is a CMS doc. Only those wait
  // for it on client navigation: the game UI never does.
  const content = usePageContent<HomeContent>('home');
  const doc = content.status === 'ready' ? content.data : null;

  // Rendered in every state so the prerendered (auth-loading) HTML carries
  // the home page's head tags too.
  // Only the FAQ blocks of extraBlocks add JSON-LD; without them there is none, as before.
  const faqLd = doc ? mergeFaqJsonLd([], doc.extraBlocks) : [];
  const homeJsonLd = faqLd.length ? faqLd : undefined;
  const seo = doc && (
    <PageSeo
      pageId="home"
      locale={locale}
      title={interpolate(doc.meta.title, { year })}
      description={interpolate(doc.meta.description, { year })}
      ogType="website"
      ogImage={settings.defaultOgImage}
      jsonLd={homeJsonLd}
    />
  );
  const seoBlock = doc && <HomeSeoBlock copy={doc.seo} extraBlocks={doc.extraBlocks} />;

  // ?join=CODE prefills join mode; ?action=create|join opens the matching screen
  useEffect(() => {
    if (prefillCode) setMode('join');
    else if (action === 'create') setMode('create');
    else if (action === 'join') setMode('join');
  }, [prefillCode, action]);

  // The Stage home (hero, steps, guides) renders while auth initialises too,
  // so the prerendered HTML is the real page, not a spinner. A deep link to
  // the create/join screen (?action=…, ?join=…) shows it once auth is ready.
  // The home page is always rendered; the create/join form is a modal over
  // it (owner's request), so the header and hero stay where they are and
  // the form closes only with ✕, Esc or «Πίσω».
  const welcome = (
    <div className="home-behind">
        <HomeHero
          headline={doc?.seo.headline ?? null}
          onCreate={() => setMode('create')}
          onJoin={(code) => {
            setJoinCode(code);
            setMode('join');
          }}
        />
        <HomeSections />
        {seoBlock}
        <SiteFooter />
    </div>
  );
  const closeForm = () => {
    setMode('welcome');
    setJoinCode('');
    if (action || prefillCode) navigate(localizePath(locale, '/'), { replace: true });
  };
  if (authLoading || mode === 'welcome') {
    return <>{seo}{welcome}</>;
  }

  const handleSubmit = async (data: NameEntryData) => {
    const identity = { realName: data.realName, avatarId: data.avatarId };
    try {
      if (mode === 'create') {
        const code = await createRoom(data.name, data.emoji, data.password, identity);
        navigate(`/room/${code}`);
      } else if (data.roomCode) {
        await joinRoom(data.roomCode, data.name, data.emoji, data.password, identity);
        clearQrPassword();
        navigate(`/room/${data.roomCode.toUpperCase()}`);
      }
    } catch (err) {
      if (err instanceof SecretSaveError) setSecretPending(true);
      console.error('Failed:', err);
    }
  };

  const handleRetrySecret = async () => {
    try {
      const code = await retryRealName();
      setSecretPending(false);
      navigate(`/room/${code.toUpperCase()}`);
    } catch (err) {
      console.error('Real name still not saved:', err);
    }
  };

  return (
    <>
      {seo}
      {welcome}
      <NameEntry
        mode={mode}
        onSubmit={handleSubmit}
        onBack={closeForm}
        isLoading={isLoading}
        error={secretPending ? t('nameEntry.secretFailed') : error}
        initialRoomCode={joinCode || prefillCode}
        qrPassword={mode === 'join' && !joinCode && qrPassword ? qrPassword : undefined}
        passwordRejected={error === WRONG_PASSWORD_ERROR}
        onRetrySecret={secretPending ? handleRetrySecret : undefined}
      />
    </>
  );
}
