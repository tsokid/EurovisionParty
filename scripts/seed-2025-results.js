/**
 * Seed a test room with Eurovision 2025 Basel Grand Final results.
 *
 * Usage:
 *   node scripts/seed-2025-results.js "<supabase-service-role-key>" [room-id]
 *
 * If no room-id is given, the script creates a new test room.
 *
 * Results source: Eurovision 2025 Grand Final, Basel (17 May 2025)
 * Winner: Austria – JJ "Wasted Love"
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://ameneqrrfdhntfzvchnn.supabase.co'

// Eurovision 2025 Basel Grand Final – final ranking (1st → last)
// https://eurovision.tv/event/basel-2025/grand-final
const RANKING_2025 = [
  'AT', // 1  Austria      – JJ "Wasted Love"
  'IL', // 2  Israel        – Yuval Raphael "New Day Will Rise"
  'FR', // 3  France        – Louane "maman"
  'LT', // 4  Lithuania     – Katarsis "Tavo akys"
  'ES', // 5  Spain         – Melody "Esa diva"
  'EE', // 6  Estonia       – Tommy Cash "Espresso Macchiato"
  'DE', // 7  Germany       – Abor & Tynna "Baller"
  'PT', // 8  Portugal      – Napa "Deslocado"
  'NL', // 9  Netherlands   – Claude "C'est la vie"
  'NO', // 10 Norway        – Kyle Alessandro "Lighter"
  'CY', // 11 Cyprus        – Theo Evan "Shh"
  'PL', // 12 Poland        – Justyna Steczkowska "GAJA"  (actually PL qualified)
  'CH', // 13 Switzerland   – Zoë Më "Voyage"
  'GR', // 14 Greece        – Klavdia "Asteromáta"
  'FI', // 15 Finland       – Erika Vikman "Ich komme"
  'SE', // 16 Sweden        – KAJ "Bara bada bastu"
  'AL', // 17 Albania       – Shkodra Elektronike "Zjerm"
  'HR', // 18 Croatia       – Marko Bošnjak "Poison Cake"
  'MD', // 19 Moldova       – Spectrum "I'm Overstimulated"
  'DK', // 20 Denmark       – Sissal "Hallucination"
  'IE', // 21 Ireland       – Emmy "Laika Party"
  'GB', // 22 United Kingdom – Remember Monday "What The Hell Just Happened?"
  'RS', // 23 Serbia        – Princ "Mila moja"
  'IT', // 24 Italy         – Lucio Corsi "Volevo essere un duro"
  'AM', // 25 Armenia       – PARG "SURVIVOR"
  'BE', // 26 Belgium       – Red Sebastian "Strobe Lights"
]

async function main () {
  const serviceKey = process.argv[2]
  const targetRoomId = process.argv[3]

  if (!serviceKey) {
    console.error('Usage: node scripts/seed-2025-results.js "<service-role-key>" [room-id]')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, serviceKey)

  let roomId = targetRoomId

  if (!roomId) {
    // Create a test room
    const testCode = 'TST5'
    console.log(`Creating test room ${testCode}…`)

    // Create a fake host player first
    const { data: player, error: pErr } = await supabase
      .from('players')
      .insert({
        name: 'Seed Bot',
        avatar_emoji: '🤖',
        is_host: true,
        is_active: true,
        status: 'active',
        quiz_points: 0,
        pred_points: 0,
        duel_points: 0,
        points_spent: 0,
        total_points: 0,
        decline_count: 0,
      })
      .select('id')
      .single()

    if (pErr) { console.error('Player create error:', pErr); process.exit(1) }

    const { data: room, error: rErr } = await supabase
      .from('rooms')
      .insert({
        code: testCode,
        host_id: player.id,
        host_name: 'Seed Bot',
        year: 2025,
        phase: 'final',
        max_players: 20,
        quiz_rounds: 3,
        duel_limit: 3,
        results_confirmed: false,
        results_source: 'pending',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (rErr) { console.error('Room create error:', rErr); process.exit(1) }
    roomId = room.id

    // Link player to room
    await supabase.from('players').update({ room_id: roomId }).eq('id', player.id)
    console.log(`✅ Test room created: ${testCode} (${roomId})`)
  }

  // Upsert results
  console.log('Inserting 2025 results…')
  const { error: resErr } = await supabase
    .from('results')
    .upsert(
      {
        room_id: roomId,
        final_ranking: RANKING_2025,
        source: 'seed_2025',
        confirmed_at: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        is_partial: false,
        positions_confirmed: RANKING_2025.length,
      },
      { onConflict: 'room_id' },
    )

  if (resErr) { console.error('Results insert error:', resErr); process.exit(1) }

  // Mark room results_confirmed
  await supabase.from('rooms').update({ results_confirmed: true, results_source: 'seed_2025' }).eq('id', roomId)

  console.log(`✅ 2025 results seeded into room ${roomId}`)
  console.log('Ranking (1st → last):')
  RANKING_2025.forEach((id, i) => console.log(`  ${String(i + 1).padStart(2)}. ${id}`))
}

main().catch(err => { console.error(err); process.exit(1) })
