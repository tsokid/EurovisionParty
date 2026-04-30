// supabase/functions/send-email/templates.ts
// Pure template renderers — one per `email_log.template` value.
// Inputs are validated lightly; missing fields fall back to safe defaults.

const BRAND_HEADER = `
  <td style="padding:28px 32px 16px 32px;background:linear-gradient(135deg,#6b21a8 0%,#db2777 100%);">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:rgba(255,255,255,0.85);">Eurovision Games</div>
`;

const BRAND_FOOTER = `
  <td style="padding:18px 32px;background:#0b0420;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:rgba(255,255,255,0.4);">
    Eurovision Games · A free, browser-based party game for Eurovision night.<br />
    Not affiliated with the European Broadcasting Union (EBU) or the Eurovision Song Contest.
    <a href="https://eurovision.games/privacy" style="color:rgba(255,255,255,0.5);">Privacy</a> ·
    <a href="https://eurovision.games/terms" style="color:rgba(255,255,255,0.5);">Terms</a>
  </td>
`;

function shell(headline: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0420;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0420;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#150836;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
      <tr>${BRAND_HEADER}
        <div style="font-size:22px;font-weight:800;color:#fff;margin-top:6px;">${escape(headline)}</div>
      </td></tr>
      <tr><td style="padding:32px;">${bodyHtml}</td></tr>
      <tr>${BRAND_FOOTER}</tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderTemplate(template: string, payload: Record<string, unknown>): string {
  switch (template) {
    case 'host_invite': return hostInvite(payload);
    case 'game_recap':  return gameRecap(payload);
    case 'admin_alert': return adminAlert(payload);
    case 'generic':
    default:            return generic(payload);
  }
}

function hostInvite(p: Record<string, unknown>): string {
  const hostName = str(p.host_name, 'A friend');
  const roomCode = str(p.room_code, '');
  const joinUrl = str(p.join_url, `https://eurovision.games/room/${roomCode}`);
  const showDate = str(p.show_date, 'Saturday 16 May 2026');
  return shell(
    `${hostName} invited you to a Eurovision night`,
    `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.85);">
      <strong style="color:#fff;">${escape(hostName)}</strong> is hosting a Eurovision Games room for the
      <strong style="color:#fff;">${escape(showDate)}</strong> grand final and wants you to play.
    </p>
    <p style="margin:0 0 8px 0;font-size:13px;color:rgba(255,255,255,0.55);">Room code:</p>
    <div style="margin:8px 0 24px 0;padding:18px 20px;background:#0b0420;border:1px solid rgba(255,255,255,0.12);border-radius:14px;font-size:32px;font-weight:800;letter-spacing:0.32em;text-align:center;color:#fff;font-family:'SFMono-Regular',Consolas,monospace;">
      ${escape(roomCode || '——————')}
    </div>
    <p style="margin:0 0 24px 0;">
      <a href="${escapeAttr(joinUrl)}" style="display:inline-block;padding:12px 20px;background:#db2777;color:#fff;font-size:14px;font-weight:700;border-radius:10px;text-decoration:none;">Join the room</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.55;color:rgba(255,255,255,0.45);">
      You'll pick five Top-5 finishers and five Worst-5, then play live trivia and duels during the show. No account needed — just a name.
    </p>
    `,
  );
}

function gameRecap(p: Record<string, unknown>): string {
  const playerName = str(p.player_name, 'Player');
  const totalPoints = num(p.total_points, 0);
  const rank = num(p.rank, 0);
  const totalPlayers = num(p.total_players, 0);
  const winners = Array.isArray(p.winners) ? (p.winners as Array<Record<string, unknown>>) : [];
  const winnerRows = winners
    .map((w) => `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.65);">${escape(str(w.category, ''))}</td><td style="padding:6px 0;text-align:right;color:#fff;font-weight:700;">${escape(str(w.player_name, ''))}</td></tr>`)
    .join('');
  return shell(
    `Your Eurovision night recap`,
    `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.85);">
      Hey <strong style="color:#fff;">${escape(playerName)}</strong> — here's how your Eurovision Games night ended.
    </p>
    <div style="margin:16px 0;padding:18px;background:#0b0420;border-radius:14px;border:1px solid rgba(255,255,255,0.1);">
      <div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.12em;">Final score</div>
      <div style="font-size:32px;font-weight:800;color:#fff;margin-top:4px;">${totalPoints} pts</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Rank ${rank} of ${totalPlayers}</div>
    </div>
    ${winnerRows ? `<h3 style="margin:24px 0 8px 0;color:#fff;font-size:14px;">Winners</h3><table style="width:100%;font-size:13px;">${winnerRows}</table>` : ''}
    <p style="margin:24px 0 0 0;font-size:12px;color:rgba(255,255,255,0.45);">See you next year. <a href="https://eurovision.games" style="color:#ec4899;">eurovision.games</a></p>
    `,
  );
}

function adminAlert(p: Record<string, unknown>): string {
  const title = str(p.title, 'Admin alert');
  const body = str(p.body, '');
  const link = str(p.link, '');
  return shell(title, `
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.85);">${escape(body)}</p>
    ${link ? `<p style="margin:0;"><a href="${escapeAttr(link)}" style="color:#ec4899;font-weight:700;">Open admin →</a></p>` : ''}
  `);
}

function generic(p: Record<string, unknown>): string {
  const title = str(p.title, 'Eurovision Games');
  const body = str(p.body, '');
  return shell(title, `<p style="margin:0;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">${escape(body)}</p>`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(s: string): string {
  return escape(s).replace(/`/g, '&#96;');
}
