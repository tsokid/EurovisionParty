const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  "https://ameneqrrfdhntfzvchnn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZW5lcXJyZmRobnRmenZjaG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDA2MjIsImV4cCI6MjA4OTY3NjYyMn0.yLl95FrX3rQuYgA2EArkmmpTRQLmZoCrBoKBT9x-mU4"
);

let pass = 0, fail = 0;
function ok(label, condition) {
  if (condition) { pass++; console.log("  ✅ " + label); }
  else { fail++; console.log("  ❌ " + label); }
}

async function test() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   EUROPARTY FINAL VERIFICATION SUITE     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Setup
  const { data: authA } = await sb.auth.signInAnonymously();
  const { data: authB } = await sb.auth.signInAnonymously();
  const code = "FN" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: room } = await sb.rpc("create_room_with_password", {
    p_code: code, p_host_name: "Host", p_password: "test123"
  }).single();
  const { data: pA } = await sb.from("players").insert({
    room_id: room.id, user_id: authA.user.id, name: "Host", avatar_emoji: "H", is_host: true
  }).select().single();
  const { data: pB } = await sb.from("players").insert({
    room_id: room.id, user_id: authB.user.id, name: "Player2", avatar_emoji: "P"
  }).select().single();

  // ═══ 1. AUTH & ROOM ═══
  console.log("── 1. Auth & Room ──");
  ok("Anonymous auth works", authA.user.id);
  ok("Room created with password", room.id && room.code === code);

  // ═══ 2. HOST-ONLY PHASE ADVANCE (Fix #4) ═══
  console.log("\n── 2. Host-Only Phase Advance ──");
  const { error: nonHostErr } = await sb.rpc("advance_room_phase", {
    p_room_id: room.id, p_player_id: pB.id
  });
  ok("Non-host blocked from advancing", nonHostErr && nonHostErr.message.includes("Only the host"));

  const { data: nextPhase, error: hostErr } = await sb.rpc("advance_room_phase", {
    p_room_id: room.id, p_player_id: pA.id
  });
  ok("Host can advance phase", !hostErr && nextPhase === "pre_night");

  // ═══ 3. SERVER-SIDE QUIZ SCORING (Fix #3, #7) ═══
  console.log("\n── 3. Server-Side Quiz Scoring ──");
  const opened2sAgo = new Date(Date.now() - 2000).toISOString();
  const { data: qr1 } = await sb.rpc("submit_quiz_answer", {
    p_room_id: room.id, p_player_id: pA.id, p_round_number: 1,
    p_question_id: 1, p_answer_index: 0, p_is_correct: true,
    p_question_opened_at: opened2sAgo
  });
  ok("Correct answer <3s = 12pts", qr1.points_awarded === 12);

  const { data: qr2 } = await sb.rpc("submit_quiz_answer", {
    p_room_id: room.id, p_player_id: pA.id, p_round_number: 1,
    p_question_id: 2, p_answer_index: 1, p_is_correct: false,
    p_question_opened_at: opened2sAgo
  });
  ok("Wrong answer = 0pts", qr2.points_awarded === 0);

  // Duplicate submission blocked
  const { error: dupeErr } = await sb.rpc("submit_quiz_answer", {
    p_room_id: room.id, p_player_id: pA.id, p_round_number: 1,
    p_question_id: 1, p_answer_index: 0, p_is_correct: true,
    p_question_opened_at: opened2sAgo
  });
  ok("Duplicate quiz answer blocked", !!dupeErr);

  // ═══ 4. DUEL FLOW (Fix #9-10 race condition) ═══
  console.log("\n── 4. Duel Flow ──");
  const { data: duel } = await sb.from("duels").insert({
    room_id: room.id, challenger_id: pA.id, challenged_id: pB.id,
    question_ids: [10, 11, 12], question_id: 10
  }).select().single();
  await sb.from("duels").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", duel.id);

  const aAnswers = [
    { questionId: 10, answerIndex: 0, answeredAt: new Date().toISOString(), responseMs: 800, points: 12 },
    { questionId: 11, answerIndex: 1, answeredAt: new Date().toISOString(), responseMs: 2500, points: 10 },
    { questionId: 12, answerIndex: 0, answeredAt: new Date().toISOString(), responseMs: 5000, points: 7 }
  ];
  const { data: r1 } = await sb.rpc("submit_duel_answers", {
    p_duel_id: duel.id, p_player_id: pA.id, p_answers: aAnswers, p_total_score: 29
  });
  ok("First player submits (not completed)", r1.completed === false);

  const bAnswers = [
    { questionId: 10, answerIndex: 0, answeredAt: new Date().toISOString(), responseMs: 1200, points: 11 },
    { questionId: 11, answerIndex: 2, answeredAt: new Date().toISOString(), responseMs: 3000, points: 0 },
    { questionId: 12, answerIndex: 0, answeredAt: new Date().toISOString(), responseMs: 4000, points: 8 }
  ];
  const { data: r2 } = await sb.rpc("submit_duel_answers", {
    p_duel_id: duel.id, p_player_id: pB.id, p_answers: bAnswers, p_total_score: 19
  });
  ok("Second player completes duel", r2.completed === true);
  ok("Winner is Host (29 > 19)", r2.winner_id === pA.id);

  // Decision
  const { error: decErr } = await sb.rpc("apply_duel_decision", {
    p_duel_id: duel.id, p_decision: "double", p_player_id: pA.id
  });
  ok("Duel decision (double) works", !decErr);
  const { data: hostAfterDuel } = await sb.from("players").select("duel_points, total_points").eq("id", pA.id).single();
  ok("Host duel_points = 58 (29×2)", hostAfterDuel.duel_points === 58);

  // ═══ 5. ATOMIC INTEL PURCHASE (Fix #5) ═══
  console.log("\n── 5. Atomic Intel Purchase ──");
  const { data: intelResult, error: intelErr } = await sb.rpc("purchase_intel", {
    p_room_id: room.id, p_player_id: pA.id, p_reveal_type: "top3", p_cost: 50
  });
  ok("Intel purchase succeeds", !intelErr);
  ok("Intel returns available flag", intelResult !== null);

  // Double purchase blocked
  const { error: dupeIntelErr } = await sb.rpc("purchase_intel", {
    p_room_id: room.id, p_player_id: pA.id, p_reveal_type: "top3", p_cost: 50
  });
  ok("Double purchase blocked", dupeIntelErr && dupeIntelErr.message.includes("Already purchased"));

  // ═══ 6. NOTIFICATION RPC (Fix #6) ═══
  console.log("\n── 6. Notification RPC ──");
  const { data: notifId, error: notifErr } = await sb.rpc("send_notification", {
    p_room_id: room.id, p_player_id: pB.id, p_type: "duel_challenge",
    p_payload: { challengerName: "Host" }
  });
  ok("Notification sent via RPC", !notifErr && notifId);

  // ═══ 7. PREDICTIONS + SCORING ═══
  console.log("\n── 7. Predictions + Scoring ──");
  await sb.from("predictions").upsert({
    room_id: room.id, player_id: pA.id,
    top5: ["SE", "FR", "IT", "UA", "CH"], worst5: ["AL", "MD", "EE", "LT", "CY"]
  }, { onConflict: "room_id,player_id" });

  const ranking = ["SE","FR","UA","IT","CH","FI","NO","ES","GR","NL","GB","IE","AT","IL","HR","RS","BE","PT","AU","AM","LT","CY","EE","MD","DE","AL"];
  await sb.rpc("save_results", { p_room_id: room.id, p_player_id: pA.id, p_final_ranking: ranking });
  const { data: scores } = await sb.rpc("score_all_predictions", { p_room_id: room.id });
  ok("Predictions scored", scores && scores.length > 0);
  ok("Host scored > 0 points", scores[0].total > 0);

  // ═══ 8. RATE LIMITS ═══
  console.log("\n── 8. Rate Limits ──");
  // Max players (set to 3, already have 2)
  await sb.from("rooms").update({ max_players: 3 }).eq("id", room.id);
  const { data: authC } = await sb.auth.signInAnonymously();
  await sb.from("players").insert({ room_id: room.id, user_id: authC.user.id, name: "P3", avatar_emoji: "3" });
  const { data: authD } = await sb.auth.signInAnonymously();
  const { error: fullErr } = await sb.from("players").insert({ room_id: room.id, user_id: authD.user.id, name: "P4", avatar_emoji: "4" });
  ok("Max players enforced", fullErr && fullErr.message.includes("full"));

  // Name uniqueness CI
  const { data: authE } = await sb.auth.signInAnonymously();
  // Deactivate P3 to free slot
  await sb.from("players").update({ is_active: false }).eq("name", "P3").eq("room_id", room.id);
  const { error: nameErr } = await sb.from("players").insert({ room_id: room.id, user_id: authE.user.id, name: "host", avatar_emoji: "X" });
  ok("CI name uniqueness enforced", nameErr && nameErr.message.includes("already taken"));

  // ═══ 9. GHOST CLEANUP ═══
  console.log("\n── 9. Ghost Cleanup ──");
  await sb.from("players").update({ last_seen_at: new Date(Date.now() - 3*60*60*1000).toISOString() }).eq("id", pB.id);
  const { data: ghostCount } = await sb.rpc("cleanup_ghost_players");
  ok("Ghost cleanup ran", ghostCount >= 1);

  // ═══ CLEANUP ═══
  await sb.from("notifications").delete().eq("room_id", room.id);
  await sb.from("predictions").delete().eq("room_id", room.id);
  await sb.from("results").delete().eq("room_id", room.id);
  await sb.from("intel_reveals").delete().eq("room_id", room.id);
  await sb.from("duels").delete().eq("room_id", room.id);
  await sb.from("quiz_answers").delete().eq("room_id", room.id);
  await sb.from("players").delete().eq("room_id", room.id);
  await sb.from("rooms").delete().eq("id", room.id);

  // ═══ RESULTS ═══
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  RESULTS: " + pass + " passed, " + fail + " failed" + " ".repeat(Math.max(0, 20 - String(pass).length - String(fail).length)) + "║");
  if (fail === 0) {
    console.log("║  🎉 ALL TESTS PASSED — SHIP IT!          ║");
  } else {
    console.log("║  ⚠️  SOME TESTS FAILED                    ║");
  }
  console.log("╚══════════════════════════════════════════╝");
}
test().catch(e => console.error("FATAL:", e.message));
