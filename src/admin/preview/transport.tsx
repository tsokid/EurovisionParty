// How the editor reaches its preview: the iframe (the app) or inline (tests).
//
// iframe: a same-origin <iframe> at /admin/preview/:docId/:locale. Real
//   viewport widths, no CSS bleed, the real header and footer. The bridge is
//   window.postMessage (protocol.ts windowPort).
// inline: the frame component rendered in the editor's own document over an
//   in-memory port. jsdom cannot run the app inside an iframe, so the test
//   suites use this to drive the same bridge end to end.
import { createContext, useContext, useEffect, useState } from 'react';
import { PreviewFrame } from './PreviewFrame';
import { memoryPorts, type HostPort } from './protocol';
import { defaultPreviewTransport, type PreviewTransport } from './transportDefault';
import type { Locale } from '../../lib/seo/locale';

export { previewSrc, __setPreviewTransportForTests, type PreviewTransport } from './transportDefault';

/** null: the default (the iframe; inline under the test suites, see tests/setup.ts). */
export const PreviewTransportContext = createContext<PreviewTransport | null>(null);

export const usePreviewTransport = (): PreviewTransport => useContext(PreviewTransportContext) ?? defaultPreviewTransport();

/**
 * The inline frame: the frame side rendered here, its port handed to the
 * host. The draft is rendered from the host's props at once (`live`); the
 * bridge carries the rest (labels, clicks, highlights), as in the iframe.
 */
export function InlinePreviewFrame({ docId, live, onPort }: {
  docId: string;
  live: { doc: unknown; locale: Locale; path?: string | null };
  onPort: (port: HostPort | null) => void;
}) {
  const [ports] = useState(memoryPorts);
  useEffect(() => {
    onPort(ports.host);
    return () => onPort(null);
  }, [ports, onPort]);
  return <PreviewFrame port={ports.frame} docId={docId} live={live} />;
}
