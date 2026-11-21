import { useTranslation } from 'react-i18next';
import { useCurrentContest } from '../../lib/currentContest';
import { useLocale } from '../../lib/seo/LocaleContext';
import { contestTexts } from '../../pages/seo/content/contestText';
import { formatDayPair } from '../../pages/contest/content/hubCopy';
import { useDaysUntil } from '../../hooks/useDaysUntil';

const TITLES = ['champion', 'thief', 'duelist', 'oracle', 'guru'] as const;

/** Countdown card (mobile; desktop shows the days in the hero stats). */
function Countdown() {
  const { t } = useTranslation();
  const locale = useLocale();
  const contest = useCurrentContest();
  const live = contestTexts(contest)[locale];
  const days = useDaysUntil(contest.finalDate);
  if (!contest.finalDate) return null;
  const semis = contest.semi1Date && contest.semi2Date ? formatDayPair(contest.semi1Date, contest.semi2Date, locale) : null;
  return (
    <section className="wrap home-block lg:hidden">
      <div className="card-hero home-countdown">
        <div className="flex flex-1 min-w-0 flex-col gap-0.5">
          <span className="t-eyebrow text-stage-text-2">{t('home.countdown.final')}</span>
          <span className="font-semibold text-stage-text">{live.finalDay}</span>
          {semis && <span className="t-meta">{t('home.countdown.semis', { dates: semis })}</span>}
        </div>
        {/* Fixed box: the number arrives after mount (browser date) without shifting the card. */}
        <div className="home-countdown-days">
          <div className="num text-[52px] text-stage-gold">{days != null && days > 0 ? days : ' '}</div>
          <div className="t-meta">
            {days === 0 ? t('home.countdown.tonight') : t('home.countdown.days', { count: days != null && days > 0 ? days : 2 })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Countdown, the three steps and the five end-of-night titles. */
export default function HomeSections() {
  const { t } = useTranslation();
  const steps = [
    { title: t('home.steps.createTitle'), body: t('home.steps.createBody') },
    { title: t('home.steps.pointsTitle'), body: t('home.steps.pointsBody') },
    { title: t('home.steps.predictTitle'), body: t('home.steps.predictBody') },
  ];
  return (
    <>
      <Countdown />

      <section className="wrap home-block home-steps-block" aria-labelledby="home-steps-title">
        <h2 id="home-steps-title" className="t-h2 text-stage-text lg:sr-only">{t('home.steps.title')}</h2>
        <ol className="home-steps">
          {steps.map((s, i) => (
            <li key={i} className="home-step">
              <span className="num home-step-n" aria-hidden>
                <span className="lg:hidden">{i + 1}</span>
                <span className="hidden lg:inline">0{i + 1}</span>
              </span>
              <div className="min-w-0">
                <h3 className="home-step-title">{s.title}</h3>
                <p className="t-small m-0">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap home-block lg:hidden" aria-labelledby="home-titles-title">
        <h2 id="home-titles-title" className="t-h2 text-stage-text">{t('home.titles.title')}</h2>
        <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
          {TITLES.map((k, i) => (
            <li key={k} className={i === 0 ? 'chip chip-gold home-title-chip' : 'chip home-title-chip'}>
              {t(`winners.cat.${k}.name`)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
