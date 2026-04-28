/**
 * Progressive results simulation.
 *
 * Inserts 2025 results one position at a time (last → first) with a configurable
 * delay between each insert, simulating live vote counting.
 *
 * Usage:
 *   node scripts/simulate-progressive.js "<service-role-key>" <room-id> [delay-ms=5000]
 *
 * The room must already exist. Run seed-2025-results.js first to create one.
 *
 * The script clears any existing results for the room, then drips positions in
 * from 26th place to 1st (the way broadcasters reveal rankings live).
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://ameneqrrfdhntfzvchnn.supabase.co'

// Full 2025 ranking – same as seed-2025-results.js
const RANKING_2025 = [
  'AT','IL','FR','LT','ES','EE','DE','PT','NL','NO',
  'CY','PL','CH','GR','FI','SE','AL','HR','MD','DK',
  'IE','GB','RS','IT','AM','BE',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main () {
  const serviceKey = process.argv[2]
  const roomId     = process.argv[3]
  const delayMs    = parseInt(process.argv[4] || '5000', 10)

  if (!serviceKey || !roomId) {
    console.error('Usage: node scripts/simulate-progressive.js "<service-role-key>" <room-id> [delay-ms]')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, serviceKey)

  // Verify room exists
  const { data: room, error: rErr } = await supabase.from('rooms').select('id,code').eq('id', roomId).single()
  if (rErr || !room) { console.error('Room not found:', rErr); process.exit(1) }
  console.log(`Starting progressive simulation for room ${room.code} (${roomId})`)
  console.log(`Delay between positions: ${delayMs}ms`)
  console.log('Revealing from 26th place → 1st…\n')

  // Clear existing results
  await supabase.from('results').delete().eq('room_id', roomId)
  await supabase.from('rooms').update({ results_confirmed: false, results_source: 'pending' }).eq('id', roomId)

  // Build the final ranking in reverse (26th → 1st)
  const revealOrder = [...RANKING_2025].reverse()  // last → first place

  for (let i = 0; i < revealOrder.length; i++) {
    const countryId = revealOrder[i]
    const place = RANKING_2025.length - i  // 26, 25, 24, … 1

    // Build partial ranking from last-revealed to first
    // After revealing place=26: partial = [BE]
    // After revealing place=25: partial = [AM, BE]
    // etc. — we accumulate from bottom up
    // The final_ranking column is always top→bottom (1st = index 0)
    const partialBottomUp = revealOrder.slice(0, i + 1)
    const partialRanking = [...partialBottomUp].reverse()

    // We insert as partial until all 26 are in
    const isComplete = (i + 1) === revealOrder.length

    const { error: upsertErr } = await supabase
      .from('results')
      .upsert(
        {
          room_id: roomId,
          final_ranking: partialRanking,
          source: 'progressive_sim',
          is_partial: !isComplete,
          positions_confirmed: partialRanking.length,
          fetched_at: new Date().toISOString(),
          confirmed_at: isComplete ? new Date().toISOString() : null,
        },
        { onConflict: 'room_id' },
      )

    if (upsertErr) {
      console.error(`Error at position ${place}:`, upsertErr)
      continue
    }

    if (isComplete) {
      // Mark room as confirmed
      await supabase
        .from('rooms')
        .update({ results_confirmed: true, results_source: 'progressive_sim' })
        .eq('id', roomId)
    }

    const bar = '█'.repeat(i + 1) + '░'.repeat(revealOrder.length - i - 1)
    process.stdout.write(`\r[${bar}] #${String(place).padStart(2)} ${countryId} ${isComplete ? '✅ DONE' : '   '}`)

    if (!isComplete) await sleep(delayMs)
  }

  console.log('\n\nProgressive simulation complete.')
  console.log('All 26 positions revealed. Predictions scoring can now run.')
}

main().catch(err => { console.error(err); process.exit(1) })
