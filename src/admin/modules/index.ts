import type { ComponentType } from 'react';
import EurovisionParser from './EurovisionParser';

export interface AdminModule {
  id: string;
  label: string;
  emoji: string;
  Component: ComponentType;
}

export const MODULES: AdminModule[] = [
  { id: 'eurovision', label: 'Eurovision Parser', emoji: '🛰️', Component: EurovisionParser },
];
