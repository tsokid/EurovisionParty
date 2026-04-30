import { useEffect } from 'react';

interface Props {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: object | object[];
}

export default function SchemaHead({ title, description, canonical, jsonLd }: Props) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = readMeta('description');
    const prevOgTitle = readMeta('og:title', true);
    const prevOgDesc = readMeta('og:description', true);
    const prevOgUrl = readMeta('og:url', true);
    const prevCanonical = (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? null;

    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', canonical, true);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    let createdCanonical = false;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
      createdCanonical = true;
    }
    link.href = canonical;

    const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    const tags: HTMLScriptElement[] = blocks.map((b) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.dynamic = 'true';
      s.text = JSON.stringify(b);
      document.head.appendChild(s);
      return s;
    });
    return () => {
      tags.forEach((t) => t.remove());
      document.title = prevTitle;
      if (prevDesc !== null) setMeta('description', prevDesc);
      if (prevOgTitle !== null) setMeta('og:title', prevOgTitle, true);
      if (prevOgDesc !== null) setMeta('og:description', prevOgDesc, true);
      if (prevOgUrl !== null) setMeta('og:url', prevOgUrl, true);
      if (createdCanonical) {
        link?.remove();
      } else if (link && prevCanonical !== null) {
        link.href = prevCanonical;
      }
    };
  }, [title, description, canonical, jsonLd]);
  return null;
}

function setMeta(name: string, value: string, og = false) {
  const sel = og ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let m = document.querySelector(sel) as HTMLMetaElement | null;
  if (!m) {
    m = document.createElement('meta');
    if (og) m.setAttribute('property', name);
    else m.name = name;
    document.head.appendChild(m);
  }
  m.content = value;
}

function readMeta(name: string, og = false): string | null {
  const sel = og ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  const m = document.querySelector(sel) as HTMLMetaElement | null;
  return m ? m.content : null;
}
