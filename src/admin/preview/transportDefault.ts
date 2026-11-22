// The default preview transport, in a module with no imports so the test
// setup can switch it without loading the app (tests/setup.ts).

export type PreviewTransport =
  | { kind: 'iframe'; src: (docId: string, locale: string) => string }
  | { kind: 'inline' };

/** The preview route of a doc (spec §3: /admin/preview/:docId/:locale, not in any menu). */
export const previewSrc = (docId: string, locale: string) =>
  `/admin/preview/${encodeURIComponent(docId)}/${encodeURIComponent(locale)}`;

const IFRAME: PreviewTransport = { kind: 'iframe', src: previewSrc };
let fallback: PreviewTransport = IFRAME;

/** The transport when no PreviewTransportContext is set: the iframe (inline under the test suites). */
export const defaultPreviewTransport = (): PreviewTransport => fallback;

/** Test hook: jsdom cannot load the app into an iframe, so the suites preview inline by default. */
export function __setPreviewTransportForTests(t: PreviewTransport | null) {
  fallback = t ?? IFRAME;
}
