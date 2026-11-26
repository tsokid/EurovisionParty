import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '../stage';
import { useCurrentContest } from '../../lib/currentContest';
import { useLocale } from '../../lib/seo/LocaleContext';
import { contestTexts } from '../../pages/seo/content/contestText';
import { formatDay } from '../../pages/contest/content/hubCopy';
import { useDaysUntil } from '../../hooks/useDaysUntil';
import LivePreview from './LivePreview';
import RoomsHome from './RoomsHome';
import { useUserRooms } from '../../hooks/useUserRooms';

interface Props {
  onCreate: () => void;
  /** Opens the join screen, prefilled with the typed code (may be empty). */
  onJoin: (code: string) => void;
  /** The page's H1: the CMS headline (SEO-frozen text). Null until the CMS doc is ready. */
  headline?: string | null;
}

/**
 * Home hero (home-after-{m,d} boards): contest chip, the game's tagline, the
 * "create a room" CTA, then the join-by-code form. Desktop adds the stat row
 * and the decorative live-room preview. Rendered in the prerendered HTML too.
 *
 * The page's H1 is the CMS headline (SEO-frozen text): the first heading in
 * DOM order, a compact line under the chip. The tagline below it is the
 * visual headline but is a <p>.
 */
export default function HomeHero({ onCreate, onJoin, headline }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const contest = useCurrentContest();
  const live = contestTexts(contest)[locale];
  const days = useDaysUntil(contest.finalDate);
  const [code, setCode] = useState('');
  // Players who already have rooms get them in place of the tagline and the
  // big CTAs (option A). Client-only: the prerendered HTML has
  // no rooms, so Google always sees the normal hero.
  const { rooms, loaded } = useUserRooms();
  const hasRooms = loaded && rooms.length > 0;
  const ref = useRef<HTMLElement>(null);

  // The stage-light drift (desktop CSS animation) pauses while the hero is off-screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.removeAttribute('data-offscreen');
      else el.setAttribute('data-offscreen', '');
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onJoin(code.trim().toUpperCase());
  };

  return (
    <section ref={ref} className="home-hero">
      <div className="wrap home-hero-grid">
        <div className="home-hero-main">
          <span className="chip self-start">
            <Flag iso={contest.hostIso} size="sm" />
            Eurovision {live.year} · {live.city}
            {contest.finalDate && (
              <span className="hidden lg:inline">· {t('home.hero.chipFinal', { date: formatDay(contest.finalDate, locale) })}</span>
            )}
          </span>
          {headline && <h1 className="home-h1">{headline}</h1>}
          {hasRooms ? (
            <RoomsHome rooms={rooms} onCreate={onCreate} onJoinWithCode={() => onJoin('')} />
          ) : (
            <>
            <p className="home-title">
              {t('welcome.headlineLine1')}
              <br />
              {t('welcome.headlineLine2')}
              <br />
              <span className="grad">{t('welcome.headlineAccent')}</span>
            </p>
            <p className="home-lede">{t('home.hero.lede')}</p>

            <div className="home-actions">
              <button type="button" className="btn btn-primary btn-lg home-cta" onClick={onCreate}>
                {t('home.hero.create')}
              </button>
              <div className="home-or" aria-hidden>
                <span className="t-meta">{t('home.hero.or')}</span>
              </div>
              <form className="join" onSubmit={submit}>
                <label htmlFor="home-join-code" className="join-label">
                  <span className="lg:hidden">{t('home.join.label')}</span>
                  <span className="hidden lg:inline">{t('home.join.labelShort')}</span>
                  <span className="join-hint t-meta">
                    <span className="lg:hidden">{t('home.join.hint')}</span>
                    <span className="hidden lg:inline">{t('home.join.hintShort')}</span>
                  </span>
                </label>
                <div className="join-row">
                  <input
                    id="home-join-code"
                    name="code"
                    className="join-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder={t('home.join.placeholder')}
                    maxLength={6}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <button type="submit" className="btn btn-secondary btn-lg join-submit">
                    {t('home.join.submit')}
                  </button>
                </div>
              </form>
            </div>
            </>
          )}

          <dl className="home-stats">
            <div>
              <dt className="t-meta">{t('home.stats.days')}</dt>
              <dd className="num home-stat-v text-stage-gold">{days != null && days >= 0 ? days : ''}</dd>
            </div>
            <div>
              <dt className="t-meta">{t('home.stats.players')}</dt>
              <dd className="num home-stat-v">2–20</dd>
            </div>
            <div>
              <dt className="t-meta">{t('home.stats.titles')}</dt>
              <dd className="num home-stat-v">5</dd>
            </div>
          </dl>
        </div>

        <LivePreview />
      </div>
    </section>
  );
}
