import type { ComponentType } from 'react';
import EurovisionParser from './EurovisionParser';
import Winners from './Winners';
import SuperAdmins from './SuperAdmins';
import RoomPhases from './RoomPhases';
import PhaseMonitor from './PhaseMonitor';
import Contests from './Contests';

export interface AdminModule {
  id: string;
  label: string;
  emoji: string;
  Component: ComponentType;
}

export const MODULES: AdminModule[] = [
  { id: 'contests',   label: 'Contests',          emoji: '🗓️', Component: Contests },
  { id: 'winners',    label: 'Winners',           emoji: '🏆', Component: Winners },
  { id: 'eurovision', label: 'Eurovision Parser', emoji: '🛰️', Component: EurovisionParser },
  { id: 'monitor',    label: 'Phase Monitor',     emoji: '📊', Component: PhaseMonitor },
  { id: 'phases',     label: 'Room Phases',       emoji: '🎬', Component: RoomPhases },
  { id: 'admins',     label: 'Super admins',      emoji: '🛡️', Component: SuperAdmins },
];
