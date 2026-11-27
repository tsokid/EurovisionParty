// The rooms columns the app reads. Never `select('*')`: the password hash
// is not for players (security pack 2d; 103 revokes it from the API roles).
// One literal string, so supabase-js can type the rows from it.
export const ROOM_COLUMNS = 'id, code, host_id, host_name, year, phase, max_players, quiz_rounds, duel_limit, created_at, phase_updated_at, quiz_opened_at, predictions_opened_at, predictions_locked_at, results_source, results_confirmed, last_activity_at' as const;
