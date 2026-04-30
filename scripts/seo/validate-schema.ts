import {
  buildOrganization, buildWebSite, buildArticle, buildFaqPage,
  buildHowTo, buildBreadcrumbList, buildEvent, buildDefinedTermSet,
  buildItemList, buildQuiz, buildVideoGame, buildWebApplication,
} from '../../src/lib/seo/schema';

interface Issue { builder: string; field: string; message: string }
const issues: Issue[] = [];

function check(builder: string, obj: any, required: string[]) {
  if (!obj['@context']) issues.push({ builder, field: '@context', message: 'missing' });
  if (!obj['@type']) issues.push({ builder, field: '@type', message: 'missing' });
  for (const r of required) {
    if (obj[r] === undefined) issues.push({ builder, field: r, message: 'missing' });
  }
}

check('Organization', buildOrganization(), ['name', 'url']);
check('WebSite', buildWebSite(), ['url', 'name', 'potentialAction']);
check('Article', buildArticle({ headline: 'X', url: 'u', datePublished: 'd', dateModified: 'd', locale: 'en' }), ['headline', 'datePublished', 'dateModified', 'inLanguage']);
check('FAQPage', buildFaqPage([{ q: 'q', a: 'a' }]), ['mainEntity']);
check('HowTo', buildHowTo({ name: 'n', steps: [{ name: 'a', text: 'b' }] }), ['name', 'step']);
check('BreadcrumbList', buildBreadcrumbList([{ name: 'h', url: 'u' }]), ['itemListElement']);
check('Event', buildEvent({ name: 'n', startDate: '2026-05-16', location: 'Vienna', url: 'u' }), ['name', 'startDate', 'location']);
check('DefinedTermSet', buildDefinedTermSet({ name: 'g', url: 'u', terms: [{ name: 't', description: 'd' }] }), ['name', 'hasDefinedTerm']);
check('ItemList', buildItemList({ name: 'l', items: [{ name: 'i', url: 'u' }] }), ['itemListElement']);
check('Quiz', buildQuiz({ name: 'q', questions: [{ question: 'q', correctAnswer: 'a', wrongAnswers: ['x'] }] }), ['name', 'hasPart']);
check('VideoGame', buildVideoGame({ name: 'g', url: 'u', description: 'd' }), ['name', 'applicationCategory']);
check('WebApplication', buildWebApplication({ name: 'a', url: 'u', description: 'd' }), ['name', 'applicationCategory']);

if (issues.length) {
  console.error('Schema builder issues:', issues);
  process.exit(1);
}
console.log('All schema builders pass.');
