-- 084_scoring_rpc_caller_checks.sql
-- Final-review fixes (docs/superpowers/sdd-reports/final-review.md M1–M3,
-- S1–S3). Every scoring RPC is SECURITY DEFINER and takes the player id from
-- the client, so each one must prove the caller IS that player.
--
--   M1  submit_duel_answers: caller must be p_player_id (my_player_id of the
--       duel's room) and a participant of the duel.
--   M2  submit_quiz_answer: the check was `p_player_id != my_player_id(..)`.
--       For a non-member my_player_id is NULL, `x != NULL` is NULL and IF NULL
--       does not raise. Now IS DISTINCT FROM.
--   M3  apply_duel_decision (steal / double): caller must be p_player_id, and
--       p_player_id must be the duel's winner. The old `winner_id != p` was
--       also NULL-blind: on a tie (winner_id NULL) anyone could "double".
--       Also pinned search_path and required status = 'completed'.
--   All three: CREATE FUNCTION grants EXECUTE to PUBLIC and Supabase grants
--   functions to anon by default, so revoke both and grant authenticated.
--
--   S1  players: a client INSERT can no longer choose joined_at (the
--       player_secrets late-joiner guard relies on it) or the score columns;
--       a client UPDATE can never change joined_at, user_id or room_id.
--   S2  submit_duel_answers: answers must be for the duel's own questions,
--       each at most once (no 50 copies of one correct answer); the legacy
--       client total is clamped to 12 per question. duels: clients may only
--       insert the columns a challenge needs and only update status /
--       accepted_at, so scores and winner_id are written by the RPC alone.
--   S3  predictions: a player can insert / update picks only while the room
--       is in 'predictions_open'. Scoring runs in SECURITY DEFINER functions
--       owned by the table owner, which RLS does not apply to.
--
-- Function bodies are copied from their latest definitions (quiz and duel:
-- 083, decision: 008) with only the changes marked "084". Signatures are
-- unchanged, so client calls (useQuiz, useDuels) resolve as before.

begin;

-- ── M2  Quiz ────────────────────────────────────────────────────────────

create or replace function public.submit_quiz_answer(
  p_room_id            UUID,
  p_player_id          UUID,
  p_round_number       INT,
  p_question_id        INT,
  p_answer_index       INT,
  p_is_correct         BOOLEAN,
  p_question_opened_at TIMESTAMPTZ,
  p_response_ms        INT DEFAULT NULL   -- 083: client-measured reaction time
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_index  INT;
  v_is_correct     BOOLEAN;
  v_answered_at    TIMESTAMPTZ;
  v_response_secs  NUMERIC(5,2);
  v_points         INT;
  v_answer_id      UUID;
BEGIN
  -- 084: NULL-safe. A caller with no player in the room gets NULL here.
  IF p_player_id IS DISTINCT FROM my_player_id(p_room_id) THEN
    RAISE EXCEPTION 'player_id does not belong to the calling user';
  END IF;

  v_answered_at   := NOW();

  IF p_response_ms IS NOT NULL THEN
    -- 083: trusted client timing (casual party game), clamped to
    -- [0, 16000] ms: the 15 s question plus the same 1 s slack as before.
    -- Rounded UP to the hundredth so the stored value never lands on the
    -- faster side of a tier boundary (3001 ms → 3.01 s → 8 points).
    v_response_secs := CEIL(LEAST(GREATEST(p_response_ms, 0), 16000) / 10.0) / 100.0;
  ELSE
    -- Legacy path (clients before 083), unchanged.
    v_response_secs := EXTRACT(EPOCH FROM (v_answered_at - p_question_opened_at));

    IF v_response_secs > 16 THEN v_response_secs := 16; END IF;
    IF v_response_secs < 0  THEN v_response_secs := 16; END IF;
  END IF;

  SELECT correct_index INTO v_correct_index
    FROM public.quiz_questions WHERE id = p_question_id;

  v_is_correct := (v_correct_index IS NOT NULL AND p_answer_index = v_correct_index);

  -- Tier scoring: ≤3s = 12pts, ≤7s = 8pts, else = 4pts
  -- No upper bound on the slow tier — network/startup latency means correct
  -- answers can legitimately arrive past 15s and still deserve 4pts.
  v_points := 0;
  IF v_is_correct THEN
    IF    v_response_secs <= 3 THEN v_points := 12;
    ELSIF v_response_secs <= 7 THEN v_points := 8;
    ELSE                             v_points := 4;
    END IF;
  END IF;

  INSERT INTO quiz_answers (
    room_id, player_id, round_number, question_id,
    answer_index, is_correct, question_opened_at,
    answered_at, response_seconds, points_awarded
  ) VALUES (
    p_room_id, p_player_id, p_round_number, p_question_id,
    p_answer_index, v_is_correct, p_question_opened_at,
    v_answered_at, v_response_secs, v_points
  ) RETURNING id INTO v_answer_id;

  IF v_points > 0 THEN
    UPDATE players SET quiz_points = quiz_points + v_points WHERE id = p_player_id;
  END IF;

  RETURN jsonb_build_object(
    'id',               v_answer_id,
    'points_awarded',   v_points,
    'response_seconds', v_response_secs,
    'is_correct',       v_is_correct
  );
END;
$$;

revoke execute on function public.submit_quiz_answer(uuid, uuid, int, int, int, boolean, timestamptz, int) from public, anon;
grant  execute on function public.submit_quiz_answer(uuid, uuid, int, int, int, boolean, timestamptz, int) to authenticated;

-- ── M1 + S2  Duel answers ───────────────────────────────────────────────

create or replace function public.submit_duel_answers(
  p_duel_id     UUID,
  p_player_id   UUID,
  p_answers     JSONB,
  p_total_score INT,
  p_response_ms INT[] DEFAULT NULL   -- 083: client-measured reaction time per answer, in p_answers order
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- 083: pinned (028 had none); every object used lives in public
AS $$
DECLARE
  v_duel RECORD;
  v_is_challenger BOOLEAN;
  v_opponent_answered BOOLEAN;
  v_opponent_score INT;
  v_winner_id UUID;
  v_loser_id UUID;
  v_final_status TEXT;
  v_answers JSONB;   -- 083
  v_score   INT;     -- 083
  v_qids    INT[];   -- 084: the duel's questions
  v_n       INT;     -- 084: answers submitted
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  -- 084: the caller must be p_player_id, and p_player_id a participant.
  IF p_player_id IS DISTINCT FROM my_player_id(v_duel.room_id) THEN
    RAISE EXCEPTION 'player_id does not belong to the calling user';
  END IF;
  IF p_player_id NOT IN (v_duel.challenger_id, v_duel.challenged_id) THEN
    RAISE EXCEPTION 'Not a participant in this duel';
  END IF;

  IF v_duel.status NOT IN ('accepted', 'answering') THEN
    RAISE EXCEPTION 'Duel is not in answerable state: %', v_duel.status;
  END IF;

  v_is_challenger := (v_duel.challenger_id = p_player_id);

  IF v_is_challenger AND v_duel.challenger_answers IS NOT NULL AND jsonb_array_length(v_duel.challenger_answers) > 0 THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;
  IF NOT v_is_challenger AND v_duel.challenged_answers IS NOT NULL AND jsonb_array_length(v_duel.challenged_answers) > 0 THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;

  -- 084: answers are bound to the duel's own questions. At least one, at
  -- most one per question, and only questions of this duel, so a score can
  -- never exceed 12 per question. (Pre-006 duels only have question_id.)
  v_qids := COALESCE(NULLIF(v_duel.question_ids, '{}'::INT[]), ARRAY[v_duel.question_id]);
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_answers must be an array';
  END IF;
  v_n := jsonb_array_length(p_answers);
  IF v_n < 1 OR v_n > COALESCE(cardinality(array_remove(v_qids, NULL)), 0) THEN
    RAISE EXCEPTION 'Expected one answer per duel question';
  END IF;
  IF EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_answers) AS e(a)
        WHERE (e.a ->> 'questionId') IS NULL
           OR NOT ((e.a ->> 'questionId')::INT = ANY (v_qids))
     )
     OR (SELECT count(DISTINCT (e.a ->> 'questionId')::INT)
           FROM jsonb_array_elements(p_answers) AS e(a)) <> v_n THEN
    RAISE EXCEPTION 'Answers must be for this duel''s questions, once each';
  END IF;

  -- 083: with client timings, the server scores each answer itself:
  -- correct (answerIndex = quiz_questions.correct_index) earns
  -- 12 − floor(ms / 1000), with ms trusted from the client (casual party
  -- game) but clamped to the duel's [0, 12000] ms window. The stored answer
  -- carries the clamped responseMs and the server's points, and the score is
  -- their sum (p_total_score is ignored). Without timings: legacy, the
  -- client's answers are stored as sent and its total clamped (084).
  IF p_response_ms IS NOT NULL THEN
    IF COALESCE(array_length(p_response_ms, 1), 0) <> v_n THEN
      RAISE EXCEPTION 'p_response_ms must have one entry per answer';
    END IF;

    SELECT COALESCE(jsonb_agg(e.a || jsonb_build_object('responseMs', s.ms, 'points', s.pts) ORDER BY e.ord), '[]'::jsonb),
           COALESCE(SUM(s.pts), 0)::INT
      INTO v_answers, v_score
      FROM jsonb_array_elements(p_answers) WITH ORDINALITY AS e(a, ord)
      LEFT JOIN public.quiz_questions qq
             ON qq.id = (e.a ->> 'questionId')::INT
      CROSS JOIN LATERAL (
        SELECT LEAST(GREATEST(COALESCE(p_response_ms[e.ord], 12000), 0), 12000) AS ms
      ) m
      CROSS JOIN LATERAL (
        SELECT m.ms,
               CASE WHEN qq.correct_index IS NOT NULL
                         AND (e.a ->> 'answerIndex')::INT = qq.correct_index
                    THEN GREATEST(0, 12 - m.ms / 1000)   -- INT division = floor
                    ELSE 0
               END AS pts
      ) s;
  ELSE
    v_answers := p_answers;
    -- 084: clamp the client total to what the submitted answers can earn.
    v_score   := LEAST(GREATEST(COALESCE(p_total_score, 0), 0), 12 * v_n);
  END IF;

  IF v_is_challenger THEN
    v_opponent_answered := (v_duel.challenged_answers IS NOT NULL AND jsonb_array_length(COALESCE(v_duel.challenged_answers, '[]'::jsonb)) > 0);
    v_opponent_score := COALESCE(v_duel.challenged_score, 0);
  ELSE
    v_opponent_answered := (v_duel.challenger_answers IS NOT NULL AND jsonb_array_length(COALESCE(v_duel.challenger_answers, '[]'::jsonb)) > 0);
    v_opponent_score := COALESCE(v_duel.challenger_score, 0);
  END IF;

  -- Write our answers (interim status while opponent still has to answer)
  IF v_is_challenger THEN
    UPDATE duels SET
      challenger_answers = v_answers,
      challenger_score = v_score,
      status = CASE WHEN v_opponent_answered THEN 'completed' ELSE 'answering' END
    WHERE id = p_duel_id;
  ELSE
    UPDATE duels SET
      challenged_answers = v_answers,
      challenged_score = v_score,
      status = CASE WHEN v_opponent_answered THEN 'completed' ELSE 'answering' END
    WHERE id = p_duel_id;
  END IF;

  v_winner_id := NULL;
  v_loser_id := NULL;
  -- 084: report the status as stored ('answering' until the opponent answers).
  v_final_status := 'answering';

  -- If both have answered, decide outcome by total score only.
  -- Equal totals → tie. No winner. No points changed hands.
  IF v_opponent_answered THEN
    v_final_status := 'completed';
    IF v_score > v_opponent_score THEN
      v_winner_id := p_player_id;
      v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
    ELSIF v_score < v_opponent_score THEN
      v_winner_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
      v_loser_id := p_player_id;
    ELSE
      v_final_status := 'tie';
    END IF;

    UPDATE duels SET
      winner_id = v_winner_id,
      loser_id = v_loser_id,
      completed_at = NOW(),
      status = v_final_status
    WHERE id = p_duel_id;
  END IF;

  RETURN jsonb_build_object(
    'winner_id', v_winner_id,
    'loser_id', v_loser_id,
    'status', v_final_status,
    'opponent_answered', v_opponent_answered,
    'score', v_score   -- 083: the score as stored
  );
END;
$$;

revoke execute on function public.submit_duel_answers(uuid, uuid, jsonb, int, int[]) from public, anon;
grant  execute on function public.submit_duel_answers(uuid, uuid, jsonb, int, int[]) to authenticated;

-- ── M3  Steal / double ──────────────────────────────────────────────────

create or replace function public.apply_duel_decision(
  p_duel_id UUID,
  p_decision TEXT,
  p_player_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- 084: pinned (008 had none)
AS $$
DECLARE
  v_duel RECORD;
  v_winner_score INT;
  v_loser_id UUID;
  v_loser_total_points INT;
  v_actual_steal INT;
BEGIN
  -- 084: lock the row so two decisions cannot both pass the NULL check.
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  -- 084: the caller must be p_player_id.
  IF p_player_id IS DISTINCT FROM my_player_id(v_duel.room_id) THEN
    RAISE EXCEPTION 'player_id does not belong to the calling user';
  END IF;

  -- 084: NULL-safe (a tie has no winner), and only a completed duel.
  IF v_duel.winner_id IS DISTINCT FROM p_player_id OR v_duel.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Only the winner can make the decision';
  END IF;

  IF v_duel.winner_decision IS NOT NULL THEN
    RAISE EXCEPTION 'Decision already made';
  END IF;

  -- Get winner's score from this duel
  IF v_duel.challenger_id = p_player_id THEN
    v_winner_score := v_duel.challenger_score;
    v_loser_id := v_duel.challenged_id;
  ELSE
    v_winner_score := v_duel.challenged_score;
    v_loser_id := v_duel.challenger_id;
  END IF;

  IF p_decision = 'steal' THEN
    -- Check loser's total_points (this is the generated column, read-only)
    SELECT total_points INTO v_loser_total_points FROM players WHERE id = v_loser_id;
    v_actual_steal := LEAST(v_winner_score, GREATEST(0, v_loser_total_points));

    IF v_actual_steal <= 0 THEN
      RAISE EXCEPTION 'Opponent has no points to steal';
    END IF;

    -- Only update duel_points (NOT total_points — it's generated)
    UPDATE players SET duel_points = duel_points + v_actual_steal WHERE id = p_player_id;
    UPDATE players SET duel_points = duel_points - v_actual_steal WHERE id = v_loser_id;

    UPDATE duels SET winner_decision = 'steal',
                     decision_made_at = NOW(),
                     points_transferred = v_actual_steal
    WHERE id = p_duel_id;

  ELSIF p_decision = 'double' THEN
    -- Winner gets double their score via duel_points
    UPDATE players SET duel_points = duel_points + (v_winner_score * 2) WHERE id = p_player_id;

    UPDATE duels SET winner_decision = 'double',
                     decision_made_at = NOW(),
                     points_transferred = v_winner_score * 2
    WHERE id = p_duel_id;

  ELSE
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;
END;
$$;

revoke execute on function public.apply_duel_decision(uuid, text, uuid) from public, anon;
grant  execute on function public.apply_duel_decision(uuid, text, uuid) to authenticated;

-- ── S2  duels: clients write only what a challenge / accept needs ──────
-- useDuels inserts room_id, challenger_id, challenged_id, question_ids,
-- question_id (+ is_rematch, parent_duel_id for a rematch) and updates
-- status + accepted_at on accept. Everything else is written by the
-- SECURITY DEFINER RPCs (owner privileges, unaffected).
revoke insert, update on public.duels from anon, authenticated;
grant insert (room_id, challenger_id, challenged_id, question_ids, question_id, is_rematch, parent_duel_id)
  on public.duels to authenticated;
grant update (status, accepted_at) on public.duels to authenticated;

-- ── S1  players: identity and score columns are server-owned ───────────
-- Only for client roles: SECURITY DEFINER functions run as the owner and
-- migrations / admin run as postgres, so their writes are unchanged.
create or replace function public.players_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- player_secrets_select trusts joined_at to tell a member from a late
    -- joiner; a client must not be able to backdate it.
    new.joined_at    := now();
    new.quiz_points  := 0;
    new.pred_points  := 0;
    new.duel_points  := 0;
    new.points_spent := 0;
    return new;
  end if;

  -- UPDATE: column privileges (051) already exclude these; refuse loudly
  -- here too so a future broad GRANT cannot reopen them.
  if new.joined_at is distinct from old.joined_at
     or new.user_id is distinct from old.user_id
     or new.room_id is distinct from old.room_id then
    raise exception 'joined_at, user_id and room_id cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_players_guard_client_write on public.players;
create trigger trg_players_guard_client_write
  before insert or update on public.players
  for each row execute function public.players_guard_client_write();

-- ── S3  predictions: player picks only while predictions are open ───────
drop policy if exists predictions_insert on public.predictions;
create policy predictions_insert on public.predictions
  for insert to authenticated
  with check (
    player_id = my_player_id(room_id)
    and exists (select 1 from public.rooms r where r.id = room_id and r.phase = 'predictions_open')
  );

drop policy if exists predictions_update on public.predictions;
create policy predictions_update on public.predictions
  for update to authenticated
  using  (player_id = my_player_id(room_id))
  with check (
    player_id = my_player_id(room_id)
    and exists (select 1 from public.rooms r where r.id = room_id and r.phase = 'predictions_open')
  );

commit;

-- PostgREST caches function signatures; pick up the new ones.
notify pgrst, 'reload schema';
