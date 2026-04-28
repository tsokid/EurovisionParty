import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Eurovision website result page URLs per year/event
const KNOWN_URLS: Record<string, string> = {
  '2025_grand_final': 'https://eurovision.tv/event/basel-2025/grand-final',
  '2024_grand_final': 'https://eurovision.tv/event/malmo-2024/grand-final',
}

interface ScrapeResult {
  year: number
  event: string
  url: string
  countries: Array<{ rank: number; id: string; name: string; points: number }>
  scrapedAt: string
  method: 'json_api' | 'html_parse' | 'manual'
}

// Try to extract JSON data embedded in the page (most Eurovision pages use Next.js / React SSR)
async function tryJsonExtract(html: string): Promise<ScrapeResult['countries'] | null> {
  // Pattern 1: __NEXT_DATA__ script tag (Next.js SSR)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      // Navigate the data structure looking for results/ranking
      const props = nextData?.props?.pageProps
      if (props?.results || props?.ranking || props?.countries) {
        const raw = props.results || props.ranking || props.countries
        return parseGenericResults(raw)
      }
    } catch {
      // continue
    }
  }

  // Pattern 2: Inline JSON blob with "ranking" or "results" key
  const jsonBlobMatch = html.match(/"ranking"\s*:\s*(\[[\s\S]{10,5000}?\])/)
  if (jsonBlobMatch) {
    try {
      const arr = JSON.parse(jsonBlobMatch[1])
      return parseGenericResults(arr)
    } catch {
      // continue
    }
  }

  return null
}

function parseGenericResults(raw: unknown): ScrapeResult['countries'] | null {
  if (!Array.isArray(raw)) return null
  const countries: ScrapeResult['countries'] = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const id = String(r.countryCode || r.country_code || r.iso || r.id || '').toUpperCase()
    const name = String(r.country || r.name || r.countryName || '')
    const points = Number(r.points || r.totalPoints || r.score || 0)
    const rank = Number(r.rank || r.place || r.position || i + 1)
    if (id.length === 2) countries.push({ rank, id, name, points })
  }
  if (countries.length < 5) return null
  return countries.sort((a, b) => a.rank - b.rank)
}

// Fallback: parse HTML tables (Eurovision used table-based markup in older pages)
function tryHtmlTableParse(html: string): ScrapeResult['countries'] | null {
  const countries: ScrapeResult['countries'] = []
  // Match table rows with flag/country/points patterns
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const rows = html.match(rowRegex) || []
  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []
    if (cells.length < 3) continue
    const getText = (cell: string) => cell.replace(/<[^>]+>/g, '').trim()
    const rankStr = getText(cells[0])
    const rank = parseInt(rankStr)
    if (isNaN(rank) || rank < 1 || rank > 30) continue
    // Look for 2-letter country code in class or data attribute
    const codeMatch = row.match(/data-country="([A-Z]{2})"/) || row.match(/country-([A-Z]{2})\b/)
    const id = codeMatch ? codeMatch[1] : ''
    const name = getText(cells[1] || cells[2])
    const pointsStr = getText(cells[cells.length - 1])
    const points = parseInt(pointsStr.replace(/[^0-9]/g, '')) || 0
    if (id.length === 2 && name.length > 1) {
      countries.push({ rank, id, name, points })
    }
  }
  if (countries.length < 5) return null
  return countries.sort((a, b) => a.rank - b.rank)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const body = await req.json().catch(() => ({}))
    const urlKey: string = body.urlKey || '2025_grand_final'
    const customUrl: string | undefined = body.url

    const targetUrl = customUrl || KNOWN_URLS[urlKey]
    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: `Unknown urlKey "${urlKey}". Known: ${Object.keys(KNOWN_URLS).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[scrape-results] Fetching: ${targetUrl}`)

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EurovisionPartyBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: `HTTP ${resp.status} from ${targetUrl}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const html = await resp.text()
    console.log(`[scrape-results] Got ${html.length} bytes`)

    // Try JSON first (most reliable), then HTML
    let countries = await tryJsonExtract(html)
    let method: ScrapeResult['method'] = 'json_api'

    if (!countries) {
      countries = tryHtmlTableParse(html)
      method = 'html_parse'
    }

    if (!countries || countries.length < 5) {
      // Return the raw HTML snippet for debugging (first 3000 chars)
      return new Response(
        JSON.stringify({
          error: 'Could not extract results from page',
          debug: {
            url: targetUrl,
            htmlPreview: html.substring(0, 3000),
            htmlLength: html.length,
            hasNextData: html.includes('__NEXT_DATA__'),
            hasRankingJson: html.includes('"ranking"'),
          },
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const result: ScrapeResult = {
      year: parseInt(urlKey.split('_')[0]),
      event: urlKey,
      url: targetUrl,
      countries,
      scrapedAt: new Date().toISOString(),
      method,
    }

    // Optionally persist to season_config if requested
    if (body.persist) {
      const { error: upsertErr } = await supabase
        .from('season_config')
        .upsert({
          year: result.year,
          event_key: urlKey,
          scrape_url: targetUrl,
          last_scraped_at: result.scrapedAt,
          countries_json: countries,
        }, { onConflict: 'event_key' })
      if (upsertErr) console.error('[scrape-results] persist error:', upsertErr)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[scrape-results] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
