import SchemaHead from '../components/seo/SchemaHead';
import SiteFooter from '../components/seo/SiteFooter';
import PageHero from '../components/seo/PageHero';
import ContentLayout from '../components/seo/ContentLayout';
import RelatedCards from '../components/seo/RelatedCards';
import CtaBanner from '../components/seo/CtaBanner';
import { breadcrumbJsonLd, type Crumb } from '../components/seo/Breadcrumbs';

const crumbs: Crumb[] = [
  { label: 'Home', href: '/' },
  { label: '404 — Not Found', href: '/' },
];

export function NotFoundPage() {
  return (
    <>
      <SchemaHead
        title="404 — Page Not Found · Eurovision Games"
        description="That page does not exist on Eurovision Games. Head back to the home page or browse the popular guides below."
        canonical="https://eurovision.games/404"
        ogType="website"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        keywords={['eurovision games 404', 'page not found']}
        jsonLd={[breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip="404"
        chipTone="pink"
        title="This stage does not exist"
        lede="The page you tried to open is not part of Eurovision Games. Maybe a typo, maybe a stale link from somewhere — either way, here are the most popular destinations to land on instead."
      />

      <ContentLayout>
        <CtaBanner
          title="Get back to the show"
          body="Spin up a Eurovision room or jump to the most-visited guides below."
          primary={{ label: 'Open the home page', href: '/' }}
          secondary={{ label: 'How to play', href: '/how-to-play' }}
        />

        <RelatedCards
          heading="Popular destinations"
          items={[
            { href: '/eurovision-night', title: 'Eurovision night', blurb: '10-step playbook for hosting the watch party.' },
            { href: '/eurovision-2026-predictions', title: '2026 predictions', blurb: 'Top 5 / Worst 5 format and the 35-country lineup.' },
            { href: '/eurovision-trivia', title: 'Eurovision trivia', blurb: '10 sample questions and how duels work.' },
            { href: '/duels', title: 'Duels', blurb: 'Head-to-head trivia rules during the live show.' },
            { href: '/dashboard', title: 'Dashboard', blurb: 'How the live leaderboard updates as you play.' },
            { href: '/how-to-play', title: 'How to play', blurb: '60-second setup walkthrough.' },
            { href: '/scoring', title: 'Scoring formulas', blurb: 'Exact points per Top-5, quiz, and duel.' },
            { href: '/faq', title: 'FAQ', blurb: 'Answers to common setup and scoring questions.' },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
