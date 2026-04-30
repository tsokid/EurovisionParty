import type { ComponentType } from 'react';
import EurovisionParser from './EurovisionParser';
import EmailLog from './EmailLog';
import Winners from './Winners';
import SuperAdmins from './SuperAdmins';

export interface AdminModule {
  id: string;
  label: string;
  emoji: string;
  Component: ComponentType;
}

export const MODULES: AdminModule[] = [
  { id: 'winners',    label: 'Winners',           emoji: '🏆', Component: Winners },
  { id: 'eurovision', label: 'Eurovision Parser', emoji: '🛰️', Component: EurovisionParser },
  { id: 'email',      label: 'Email Log',         emoji: '📧', Component: EmailLog },
  { id: 'admins',     label: 'Super admins',      emoji: '🛡️', Component: SuperAdmins },
];
