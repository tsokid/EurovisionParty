// Renders a blocks() zone (text, callout, image, video, faq, cta).
//
// FAQ blocks feed FAQPage JSON-LD. Effects do not run under SSR, so a page that
// needs the entries in the prerendered HTML calls faqEntries(value) while
// rendering; `onFaq` reports the same list from an effect for client-only use.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import LocaleLink from '../seo/LocaleLink';
import { isSafeHref } from '../../../supabase/functions/_shared/cms/html';
import type { FaqEntry } from '../../lib/seo/schema';
import CmsImage from './CmsImage';
import VideoPlayer from './VideoPlayer';
import RichText from './RichText';
import { faqEntries } from './faqEntries';
import { isPublishedMedia, type CmsBlock } from './mediaTypes';

function Caption({ children }: { children?: string }) {
  return children ? <figcaption className="mt-2 text-sm text-white/60">{children}</figcaption> : null;
}

function Cta({ block }: { block: Extract<CmsBlock, { type: 'cta' }> }) {
  const cls = 'inline-block rounded-full bg-euro-pink px-6 py-3 font-bold text-white hover:opacity-90';
  const safe = typeof block.href === 'string' && isSafeHref(block.href);
  return (
    <section className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
      <h2 className="text-2xl font-bold text-white">{block.title}</h2>
      {block.body ? <p className="mt-2 whitespace-pre-line text-white/80">{block.body}</p> : null}
      {safe && block.label ? (
        <div className="mt-4">
          {block.href.startsWith('/') ? (
            <LocaleLink to={block.href} className={cls}>{block.label}</LocaleLink>
          ) : (
            <a href={block.href} target="_blank" rel="noopener noreferrer" className={cls}>{block.label}</a>
          )}
        </div>
      ) : null}
    </section>
  );
}

function renderBlock(b: CmsBlock): ReactNode {
  switch (b?.type) {
    case 'text':
      return <RichText source={b.body ?? ''} />;
    case 'callout':
      return (
        <aside
          role="note"
          className={`rounded-2xl border p-4 ${b.tone === 'warn' ? 'border-yellow-400/40 bg-yellow-400/[0.06]' : 'border-euro-pink/30 bg-euro-pink/[0.04]'}`}
        >
          <RichText source={b.body ?? ''} />
        </aside>
      );
    case 'image':
      if (!b.image || !isPublishedMedia(b.image.media, 'webp')) return null;
      return (
        <figure>
          <CmsImage value={b.image} />
          <Caption>{b.caption}</Caption>
        </figure>
      );
    case 'video':
      if (!b.video || !isPublishedMedia(b.video.media, 'mp4')) return null;
      return (
        <figure>
          <VideoPlayer value={b.video} />
          <Caption>{b.caption}</Caption>
        </figure>
      );
    case 'faq':
      return (
        <div className="space-y-4">
          {(Array.isArray(b.items) ? b.items : []).filter((it) => it && typeof it.q === 'string').map((it, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-lg font-bold text-white">{it.q}</h3>
              <RichText source={typeof it.a === 'string' ? it.a : ''} className="mt-2 space-y-3 text-white/80 leading-relaxed" />
            </div>
          ))}
        </div>
      );
    case 'cta':
      return <Cta block={b} />;
    default:
      return null; // unknown type: skipped
  }
}

export default function Blocks({ value, onFaq }: { value: readonly CmsBlock[]; onFaq?: (entries: FaqEntry[]) => void }) {
  const list = Array.isArray(value) ? value : [];
  const entries = useMemo(() => faqEntries(value), [value]);
  // onFaq lives in a ref and the effect keys on the entries' content, so an
  // inline callback (that may set state) cannot retrigger it.
  // For SSR use faqEntries(value) in the page: effects do not run on the server.
  const onFaqRef = useRef(onFaq);
  useEffect(() => {
    onFaqRef.current = onFaq;
  });
  const key = JSON.stringify(entries);
  useEffect(() => {
    if (key !== '[]') onFaqRef.current?.(JSON.parse(key));
  }, [key]);

  const rendered = list.map((b, i) => ({ i, node: renderBlock(b) })).filter((x) => x.node !== null);
  if (!rendered.length) return null;
  return <div className="space-y-8">{rendered.map((x) => <div key={x.i}>{x.node}</div>)}</div>;
}
