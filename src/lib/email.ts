// src/lib/email.ts
// Thin client wrapper around the public.queue_email RPC. Queues a transactional
// email; pg_cron + the send-email edge function handle delivery via Resend.

import { supabase } from './supabase';

export type EmailTemplate = 'host_invite' | 'game_recap' | 'admin_alert' | 'generic';

export interface QueueEmailInput {
  to: string;
  subject: string;
  template: EmailTemplate;
  payload?: Record<string, unknown>;
}

export interface QueueEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function queueEmail({ to, subject, template, payload = {} }: QueueEmailInput): Promise<QueueEmailResult> {
  const { data, error } = await supabase.rpc('queue_email', {
    p_to: to,
    p_subject: subject,
    p_template: template,
    p_payload: payload,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data as string };
}

/** Convenience wrappers */

export function queueHostInvite(to: string, hostName: string, roomCode: string, joinUrl?: string) {
  return queueEmail({
    to,
    subject: `${hostName} invited you to a Eurovision night`,
    template: 'host_invite',
    payload: { host_name: hostName, room_code: roomCode, join_url: joinUrl ?? `https://eurovision.games/room/${roomCode}` },
  });
}

export function queueGameRecap(to: string, args: {
  playerName: string;
  totalPoints: number;
  rank: number;
  totalPlayers: number;
  winners?: Array<{ category: string; player_name: string }>;
}) {
  return queueEmail({
    to,
    subject: 'Your Eurovision night recap',
    template: 'game_recap',
    payload: {
      player_name: args.playerName,
      total_points: args.totalPoints,
      rank: args.rank,
      total_players: args.totalPlayers,
      winners: args.winners ?? [],
    },
  });
}
