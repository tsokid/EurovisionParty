import type { ComponentType } from 'react';
import EurovisionParser from './EurovisionParser';
import EmailLog from './EmailLog';

export interface AdminModule {
  id: string;
  label: string;
  emoji: string;
  Component: ComponentType;
}

export const MODULES: AdminModule[] = [
  { id: 'eurovision', label: 'Eurovision Parser', emoji: '🛰️', Component: EurovisionParser },
  { id: 'email',      label: 'Email Log',         emoji: '📧', Component: EmailLog },
];
