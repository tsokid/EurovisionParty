import type { ComponentType } from 'react';
import EurovisionParser from './EurovisionParser';
import Winners from './Winners';
import SuperAdmins from './SuperAdmins';
import RoomPhases from './RoomPhases';

export interface AdminModule {
  id: string;
  label: string;
  emoji: string;
  Component: ComponentType;
}

export const MODULES: AdminModule[] = [
  { id: 'winners',    label: 'Winners',           emoji: '🏆', Component: Winners },
  { id: 'eurovision', label: 'Eurovision Parser', emoji: '🛰️', Component: EurovisionParser },
  { id: 'phases',     label: 'Room Phases',       emoji: '🎬', Component: RoomPhases },
  { id: 'admins',     label: 'Super admins',      emoji: '🛡️', Component: SuperAdmins },
];
