// @vitest-environment node
// 099 (the server serves and scores every question). The database is built
// up to 098, given the broad table grants production has, then 099 is
// applied, so every refusal in the SQL proof is 099's doing. Also checks
// that the rollback applies cleanly.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser } from './harness';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const PRODUCTION_GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant insert, update on public.notifications to anon;
`;

describe('099 question serving', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '098' });
    await db.exec(PRODUCTION_GRANTS);
    // 097 narrowed duels and quiz tables; re-apply it over the broad grants, as production has it.
    await db.exec(read('supabase/migrations/097_security_pack2a.sql'));
    await db.exec(read('supabase/migrations/098_question_bank.sql'));
    await db.exec(read('supabase/migrations/099_question_serving.sql'));
    await asUser(db, null);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the SQL proof passes and leaves nothing behind', async () => {
    await db.exec(read('supabase/tests/099_question_serving.test.sql'));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.rooms where code = 'SRV099'`);
    expect(left.rows[0].n).toBe(0);
  });

  it('the rollback applies, then 099 applies again', async () => {
    await db.exec(read('supabase/rollbacks/099_question_serving_rollback.sql'));
    const gone = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where tablename = 'question_serves'`);
    expect(gone.rows[0].n).toBe(0);
    await db.exec(read('supabase/migrations/099_question_serving.sql'));
    const back = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where tablename = 'question_serves'`);
    expect(back.rows[0].n).toBe(1);
  });
});

describe('100 question serving contract', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb({ upTo: '099' });
    await db.exec(PRODUCTION_GRANTS);
    await db.exec(read('supabase/migrations/100_question_serving_contract.sql'));
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  const canRun = async (sig: string) => (await db.query<{ ok: boolean }>(
    `select has_function_privilege('authenticated', '${sig}', 'EXECUTE') as ok`)).rows[0].ok;
  const QUIZ = 'public.submit_quiz_answer(uuid, uuid, integer, integer, integer, boolean, timestamp with time zone, integer)';
  const DUEL = 'public.submit_duel_answers(uuid, uuid, jsonb, integer, integer[])';

  it('closes the old answer paths and keeps the served ones', async () => {
    expect(await canRun(QUIZ)).toBe(false);
    expect(await canRun(DUEL)).toBe(false);
    expect(await canRun('public.quiz_answer(uuid, integer)')).toBe(true);
    expect(await canRun('public.duel_answer(uuid, integer)')).toBe(true);
  });

  it('the rollback reopens them', async () => {
    await db.exec(read('supabase/rollbacks/100_question_serving_contract_rollback.sql'));
    expect(await canRun(QUIZ)).toBe(true);
    expect(await canRun(DUEL)).toBe(true);
  });
});

describe('101 question review status', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb({ upTo: '100' });
    await db.exec(`insert into public.quiz_questions (id, correct_index, topic, difficulty, question_en, question_el,
      options_en, options_el, fact, status, lyric_check) values
      (97001, 0, 'lyrics', 'easy', 'Q?', 'Ε;', '{a,b,c,d}', '{α,β,γ,δ}', 'lyric fact', 'draft', true),
      (97002, 0, 'song', 'easy', 'Q2?', 'Ε2;', '{a,b,c,d}', '{α,β,γ,δ}', 'other fact', 'draft', false)`);
    await db.exec(read('supabase/migrations/101_question_review_status.sql'));
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('lyric drafts move to review; other drafts stay; review is a valid state', async () => {
    const r = await db.query<{ id: number; status: string }>(`select id, status from public.quiz_questions where id in (97001, 97002) order by id`);
    expect(r.rows.map((x) => x.status)).toEqual(['review', 'draft']);
    await db.exec(`update public.quiz_questions set status = 'review' where id = 97002`);
    await expect(db.exec(`update public.quiz_questions set status = 'gone' where id = 97002`)).rejects.toThrow(/status_check/);
  });

  it('the rollback turns review back into draft', async () => {
    await db.exec(read('supabase/rollbacks/101_question_review_status_rollback.sql'));
    const r = await db.query<{ n: number }>(`select count(*)::int n from public.quiz_questions where status = 'review'`);
    expect(r.rows[0].n).toBe(0);
  });
});

describe('102 question delete guard', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb({ upTo: '101' });
    await db.exec(`insert into public.quiz_questions (id, correct_index, topic, difficulty, question_en, question_el,
      options_en, options_el, fact, status) values
      (98001, 0, 'song', 'easy', 'Q1?', 'Ε1;', '{a,b,c,d}', '{α,β,γ,δ}', 'played fact', 'draft'),
      (98002, 0, 'song', 'easy', 'Q2?', 'Ε2;', '{a,b,c,d}', '{α,β,γ,δ}', 'unplayed fact', 'draft')`);
    await db.exec(`insert into auth.users (id) values ('a0000000-0000-4000-8000-000000000102');
      insert into public.rooms (id, code, host_id, host_name, phase, password_hash) values
        ('10000000-0000-4000-8000-000000000102', 'DEL102', 'a0000000-0000-4000-8000-000000000102', 'Α', 'lobby', '');
      insert into public.players (id, room_id, user_id, name, is_host) values
        ('aaaaaaaa-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000102', 'Α', true);
      insert into public.quiz_answers (room_id, player_id, round_number, question_id, answer_index, is_correct, question_opened_at, answered_at, points_awarded)
        values ('10000000-0000-4000-8000-000000000102', 'aaaaaaaa-0000-4000-8000-000000000102', 1, 98001, 0, true, now(), now(), 12);`);
    await db.exec(read('supabase/migrations/102_question_delete_guard.sql'));
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('a question never shown can be deleted; a played one cannot', async () => {
    await db.exec(`delete from public.quiz_questions where id = 98002`);
    await expect(db.exec(`delete from public.quiz_questions where id = 98001`)).rejects.toThrow(/question_played/);
    const r = await db.query<{ n: number }>(`select count(*)::int n from public.quiz_questions where id in (98001, 98002)`);
    expect(r.rows[0].n).toBe(1);
  });

  it('the rollback removes the guard', async () => {
    await db.exec(read('supabase/rollbacks/102_question_delete_guard_rollback.sql'));
    await db.exec(`delete from public.quiz_answers where question_id = 98001; delete from public.quiz_questions where id = 98001`);
  });
});
