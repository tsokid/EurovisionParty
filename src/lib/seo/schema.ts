import type { Locale } from './locale';

const SITE_URL = 'https://eurovision.games';
const ORG_NAME = 'Eurovision Games';
const ORG_LOGO = `${SITE_URL}/icon-512.png`;

type SchemaBlock = Record<string, unknown>;

export function buildOrganization(): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: ORG_NAME,
    url: SITE_URL,
    logo: ORG_LOGO,
    sameAs: [],
  };
}

export function buildWebSite(): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    url: SITE_URL,
    name: ORG_NAME,
    publisher: { '@id': `${SITE_URL}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface ArticleInput {
  headline: string;
  url: string;
  description?: string;
  datePublished: string;
  dateModified: string;
  locale: Locale;
  authorName?: string;
  image?: string;
}
export function buildArticle(i: ArticleInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: i.headline,
    description: i.description,
    mainEntityOfPage: i.url,
    inLanguage: i.locale,
    datePublished: i.datePublished,
    dateModified: i.dateModified,
    image: i.image,
    author: { '@type': 'Organization', name: i.authorName ?? ORG_NAME },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

export interface FaqEntry { q: string; a: string }
export function buildFaqPage(items: FaqEntry[]): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

export interface HowToStep { name: string; text: string }
interface HowToInput { name: string; description?: string; steps: HowToStep[] }
export function buildHowTo(i: HowToInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: i.name,
    description: i.description,
    step: i.steps.map((s) => ({
      '@type': 'HowToStep',
      name: s.name,
      text: s.text,
    })),
  };
}

export interface BreadcrumbItem { name: string; url: string }
export function buildBreadcrumbList(items: BreadcrumbItem[]): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

interface EventSubEvent { name: string; startDate: string; endDate?: string; url: string }
interface EventInput {
  name: string;
  startDate: string;
  endDate?: string;
  location: string;
  url: string;
  subEvents?: EventSubEvent[];
}
export function buildEvent(i: EventInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: i.name,
    startDate: i.startDate,
    endDate: i.endDate,
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: i.location },
    url: i.url,
    organizer: { '@type': 'Organization', name: 'European Broadcasting Union' },
    subEvent: i.subEvents?.map((s) => ({
      '@type': 'Event',
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      url: s.url,
      location: { '@type': 'Place', name: i.location },
    })),
  };
}

export interface DefinedTermInput { name: string; description: string; alternateName?: string[] }
interface TermSetInput { name: string; url: string; terms: DefinedTermInput[] }
export function buildDefinedTermSet(i: TermSetInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: i.name,
    url: i.url,
    hasDefinedTerm: i.terms.map((t) => ({
      '@type': 'DefinedTerm',
      name: t.name,
      description: t.description,
      alternateName: t.alternateName,
      inDefinedTermSet: i.url,
    })),
  };
}

export interface ItemListEntry { name: string; url: string; description?: string }
interface ItemListInput { name: string; items: ItemListEntry[] }
export function buildItemList(i: ItemListInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: i.name,
    itemListElement: i.items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      url: it.url,
      description: it.description,
    })),
  };
}

interface QuizQuestion { question: string; correctAnswer: string; wrongAnswers: string[] }
interface QuizInput { name: string; about?: string; questions: QuizQuestion[] }
export function buildQuiz(i: QuizInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: i.name,
    about: i.about,
    hasPart: i.questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.correctAnswer },
      suggestedAnswer: q.wrongAnswers.map((w) => ({ '@type': 'Answer', text: w })),
    })),
  };
}

interface VideoGameInput { name: string; url: string; description: string }
export function buildVideoGame(i: VideoGameInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: i.name,
    url: i.url,
    description: i.description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    gamePlatform: ['Web Browser', 'Mobile Web', 'Desktop Web'],
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 20 },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

interface WebApplicationInput { name: string; url: string; description: string }
export function buildWebApplication(i: WebApplicationInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: i.name,
    url: i.url,
    description: i.description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}
