import type { ComponentType } from 'react';
import EurovisionParser from './EurovisionParser';
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
  { id: 'admins',     label: 'Super admins',      emoji: '🛡️', Component: SuperAdmins },
];
