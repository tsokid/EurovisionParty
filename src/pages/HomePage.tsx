import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NameEntry from '../components/onboarding/NameEntry';
import HomeSeoBlock from '../components/seo/HomeSeoBlock';
import HomeHero from '../components/home/HomeHero';
import HomeSections from '../components/home/HomeSections';
import YourRoomsPanel from '../components/home/YourRoomsPanel';
import SiteFooter from '../components/seo/SiteFooter';
import PageSeo from '../components/seo/PageSeo';
import { useLocale } from '../lib/seo/LocaleContext';
import { usePageContent } from '../lib/cms/usePageContent';
import { mergeFaqJsonLd } from '../components/cms/extraFaq';
import type { HomeContent } from '../../supabase/functions/_shared/cms/schemas/home';
import { interpolate } from '../../supabase/functions/_shared/cms/placeholders';
import { useCurrentYear } from '../lib/currentContest';
import { useAuth } from '../hooks/useAuth';
import { useRoom } from '../hooks/useRoom';

type Mode = 'welcome' | 'create' | 'join';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('join') || '';
  const action = searchParams.get('action');
  const initialMode: Mode = prefillCode || action === 'join' ? 'join' : action === 'create' ? 'create' : 'welcome';
  const [mode, setMode] = useState<Mode>(initialMode);
  // Code typed in the hero's join form (prefills the join screen).
  const [joinCode, setJoinCode] = useState('');
  const { isLoading: authLoading } = useAuth();
  const { createRoom, joinRoom, isLoading, error } = useRoom();
  const navigate = useNavigate();
  const locale = useLocale();
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
      ogImage="https://eurovision.games/logo.png"
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
  if (authLoading || mode === 'welcome') {
    return (
      <>
        {seo}
        <HomeHero
          headline={doc?.seo.headline ?? null}
          onCreate={() => setMode('create')}
          onJoin={(code) => {
            setJoinCode(code);
            setMode('join');
          }}
        />
        {!authLoading && (
          <div className="wrap home-rooms">
            <YourRoomsPanel />
          </div>
        )}
        <HomeSections />
        {seoBlock}
        <SiteFooter />
      </>
    );
  }

  const handleSubmit = async (data: { name: string; emoji: string; roomCode?: string; password: string }) => {
    try {
      if (mode === 'create') {
        const code = await createRoom(data.name, data.emoji, data.password);
        navigate(`/room/${code}`);
      } else if (data.roomCode) {
        await joinRoom(data.roomCode, data.name, data.emoji, data.password);
        navigate(`/room/${data.roomCode.toUpperCase()}`);
      }
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <>
      {seo}
      <NameEntry
        mode={mode}
        onSubmit={handleSubmit}
        onBack={() => setMode('welcome')}
        isLoading={isLoading}
        error={error}
        initialRoomCode={joinCode || prefillCode}
      />
    </>
  );
}
