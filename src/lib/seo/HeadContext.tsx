import { createContext, useContext, type ReactNode } from 'react';
import type { HeadInput } from './headTags';

export interface HeadCollector {
  head: HeadInput | null;
  status: number;
  setHead(h: HeadInput): void;
  setStatus(code: number): void;
}

export function createHeadCollector(): HeadCollector {
  const c: HeadCollector = {
    head: null,
    status: 200,
    setHead(h) { c.head = h; },
    setStatus(code) { c.status = code; },
  };
  return c;
}

const HeadContext = createContext<HeadCollector | null>(null);

export function HeadProvider({ collector, children }: { collector: HeadCollector; children: ReactNode }) {
  return <HeadContext.Provider value={collector}>{children}</HeadContext.Provider>;
}

export function useHeadCollector(): HeadCollector | null {
  return useContext(HeadContext);
}
