import { createContext } from 'react';

/** Per-render record of the content files a server render read (cf. HeadCollector). */
export interface ContentCollector {
  /** Every content file read during this render, by path relative to content/. */
  files: Record<string, unknown>;
  record(path: string, data: unknown): void;
}

export function createContentCollector(): ContentCollector {
  const c: ContentCollector = {
    files: {},
    record(path, data) { c.files[path] = data; },
  };
  return c;
}

export const ContentCollectorContext = createContext<ContentCollector | null>(null);
