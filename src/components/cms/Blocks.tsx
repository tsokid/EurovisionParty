// Renders a blocks() zone (text, callout, image, video, faq, cta).
//
// FAQ blocks feed FAQPage JSON-LD. Effects do not run under SSR, so a page that
// needs the entries in the prerendered HTML calls faqEntries(value) while
// rendering; `onFaq` reports the same list from an effect for client-only use.
import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import LocaleLink from '../seo/LocaleLink';
import { buttonClass } from '../stage/Button';
import { isSafeHref } from '../../../supabase/functions/_shared/cms/html';
import type { FaqEntry } from '../../lib/seo/schema';
import CmsImage from './CmsImage';
import VideoPlayer from './VideoPlayer';
import RichText from './RichText';
import { faqEntries } from './faqEntries';
import { isPublishedMedia, type CmsBlock } from './mediaTypes';
import { isDraftMedia, MediaResolverContext } from './MediaResolver';
import { useCmsAttrs, type CmsAttrs } from '../../lib/cms/cmsAttrs';

type At = (path: string) => CmsAttrs;
const NO_AT: At = () => ({});

function Caption({ children }: { children?: string }) {
  return children ? <figcaption className="t-meta mt-2">{children}</figcaption> : null;
}

function Cta({ block }: { block: Extract<CmsBlock, { type: 'cta' }> }) {
  const cls = buttonClass({ className: 'w-full md:w-auto' });
  const safe = typeof block.href === 'string' && isSafeHref(block.href);
  return (
    <section className="card-hero px-5 py-[22px] md:p-8 text-stage-text">
      <h2 className="t-h2">{block.title}</h2>
      {block.body ? <p className="t-body mt-2 whitespace-pre-line">{block.body}</p> : null}
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

/** Draft references count only in the admin preview (under a MediaResolverContext provider). */
function renderBlock(b: CmsBlock, preview: boolean, at: At = NO_AT): ReactNode {
  const media = (ref: unknown, ext: 'webp' | 'mp4') => isPublishedMedia(ref, ext) || (preview && isDraftMedia(ref));
  switch (b?.type) {
    case 'text':
      return <RichText source={b.body ?? ''} />;
    case 'callout':
      return (
        <aside
          role="note"
          className={`card px-5 py-4 ${b.tone === 'warn' ? 'shadow-[inset_3px_0_0_var(--color-stage-gold)] border-stage-gold/35' : 'shadow-[inset_3px_0_0_var(--color-stage-pink)]'}`}
        >
          <RichText source={b.body ?? ''} />
        </aside>
      );
    case 'image':
      if (!b.image || !media(b.image.media, 'webp')) return null;
      return (
        <figure {...at('image')}>
          <CmsImage value={b.image} />
          <Caption>{b.caption}</Caption>
        </figure>
      );
    case 'video':
      if (!b.video || !media(b.video.media, 'mp4')) return null;
      return (
        <figure {...at('video')}>
          <VideoPlayer value={b.video} />
          <Caption>{b.caption}</Caption>
        </figure>
      );
    case 'faq':
      return (
        <div className="flex flex-col gap-3">
          {(Array.isArray(b.items) ? b.items : []).map((it, i) => ({ it, i })).filter(({ it }) => it && typeof it.q === 'string').map(({ it, i }) => (
            <div key={i} className="card card-pad" {...at(`items.${i}`)}>
              <h3 className="t-h3 text-stage-text">{it.q}</h3>
              <RichText source={typeof it.a === 'string' ? it.a : ''} className="mt-2 space-y-3 text-stage-text-2 leading-relaxed" />
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

export default function Blocks({ value, onFaq, cms, start = 0 }: {
  value: readonly CmsBlock[];
  onFaq?: (entries: FaqEntry[]) => void;
  /** The doc path of this zone ("extraBlocks"), for the admin preview's click-to-edit (nothing on the site). */
  cms?: string;
  /** The index of the first block inside the `cms` list (a run of blocks in a page layout). */
  start?: number;
}) {
  const list = Array.isArray(value) ? value : [];
  const attrs = useCmsAttrs();
  const preview = useContext(MediaResolverContext) !== null;
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

  const at = (i: number): At => (cms ? (p) => attrs(`${cms}.${start + i}.${p}`) : NO_AT);
  const rendered = list.map((b, i) => ({ i, node: renderBlock(b, preview, at(i)) })).filter((x) => x.node !== null);
  if (!rendered.length) return null;
  return <div className="space-y-8">{rendered.map((x) => <div key={x.i} {...(cms ? attrs(`${cms}.${start + x.i}`) : undefined)}>{x.node}</div>)}</div>;
}
