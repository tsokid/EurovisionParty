import type { PageContent } from '../../content/_types';
import ContentLayout from './ContentLayout';
import PageHero from './PageHero';
import Section from './Section';
import FaqAccordion from './FaqAccordion';
import RelatedCards from './RelatedCards';
import CtaBanner from './CtaBanner';
import DataTable from './DataTable';
import { type Crumb } from './Breadcrumbs';

interface Props {
  content: PageContent;
  crumbs: Crumb[];
  // resolver maps a card id (registry pageId) → { href, title, blurb fallback }
  resolveRelated: (id: string) => { href: string; titleFallback: string; blurbFallback: string };
}

export default function ContentRenderer({ content, crumbs, resolveRelated }: Props) {
  return (
    <>
      <PageHero
        crumbs={crumbs}
        chip={content.hero.eyebrow}
        title={content.hero.title}
        lede={content.hero.lede}
      />
      <ContentLayout>
        {content.sections.map((s, i) => {
          switch (s.type) {
            case 'paragraph':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <div dangerouslySetInnerHTML={{ __html: s.html }} />
                </Section>
              );
            case 'definitionBlock':
              return (
                <div key={i} className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6 text-[17px]">
                  <div dangerouslySetInnerHTML={{ __html: s.html }} />
                </div>
              );
            case 'list':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <ul className="list-disc pl-6 space-y-2">
                    {s.items.map((it, j) => (
                      <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
                    ))}
                  </ul>
                </Section>
              );
            case 'steps':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <ol className="space-y-4">
                    {s.steps.map((st, j) => (
                      <li key={j} className="rounded-xl border border-white/10 p-5">
                        <div className="flex items-start gap-4">
                          <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-euro-purple-light to-euro-pink flex items-center justify-center text-white text-sm font-bold">{j + 1}</span>
                          <div>
                            <h3 className="text-white font-bold">{st.title}</h3>
                            <p className="mt-1 text-white/75" dangerouslySetInnerHTML={{ __html: st.text }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              );
            case 'table':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <DataTable caption={s.caption} headers={s.headers} rows={s.rows.map((r) => r.map((c) => <span key={c} dangerouslySetInnerHTML={{ __html: c }} />))} />
                </Section>
              );
            case 'faq':
              return (
                <Section key={i} id={s.id} title={s.title ?? 'FAQ'}>
                  <FaqAccordion items={s.items} />
                </Section>
              );
            case 'cta':
              return (
                <CtaBanner
                  key={i}
                  title={s.title}
                  body={s.body}
                  primary={{ label: s.primaryLabel, href: s.primaryHref }}
                  secondary={s.secondaryLabel ? { label: s.secondaryLabel, href: s.secondaryHref! } : undefined}
                />
              );
            case 'related':
              return (
                <RelatedCards
                  key={i}
                  heading={s.title}
                  items={s.cards.map((c) => {
                    const r = resolveRelated(c.id);
                    return {
                      href: r.href,
                      title: c.title || r.titleFallback,
                      blurb: c.blurb || r.blurbFallback,
                    };
                  })}
                />
              );
            default:
              return null;
          }
        })}
      </ContentLayout>
    </>
  );
}
