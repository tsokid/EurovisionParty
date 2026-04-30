export interface HreflangLink {
  hreflang: 'en' | 'el' | 'x-default';
  href: string;
}

interface Input {
  enUrl?: string;
  elUrl?: string;
}

export function buildHreflangLinks({ enUrl, elUrl }: Input): HreflangLink[] {
  const links: HreflangLink[] = [];
  if (enUrl) links.push({ hreflang: 'en', href: enUrl });
  if (elUrl) links.push({ hreflang: 'el', href: elUrl });
  // x-default points to EN by default; EL-exclusive falls back to EL
  links.push({ hreflang: 'x-default', href: enUrl ?? elUrl ?? '' });
  return links;
}
