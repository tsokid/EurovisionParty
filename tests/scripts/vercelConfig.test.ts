import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cfg = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ameneqrrfdhntfzvchnn.supabase.co wss://ameneqrrfdhntfzvchnn.supabase.co; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none';"

describe('vercel.json', () => {
  it('has no legacy routes key', () => {
    expect(cfg.routes).toBeUndefined()
  })

  it('enables clean URLs without trailing slash', () => {
    expect(cfg.cleanUrls).toBe(true)
    expect(cfg.trailingSlash).toBe(false)
  })

  it('keeps CSP header unchanged', () => {
    const all = cfg.headers.find((h: any) => h.source === '/(.*)')
    const csp = all.headers.find((h: any) => h.key === 'Content-Security-Policy')
    expect(csp.value).toBe(CSP)
    const assets = cfg.headers.find((h: any) => h.source === '/assets/(.*)')
    expect(assets.headers[0].value).toBe('public, max-age=31536000, immutable')
  })

  it('has permanent redirects for renamed pages', () => {
    const want: Array<[string, string]> = [
      ['/:locale(en|el)/eurovision-quiz', '/:locale/eurovision-trivia'],
      ['/:locale(en|el)/host-eurovision-party', '/:locale/eurovision-party'],
      ['/eurovision-quiz', '/en/eurovision-trivia'],
      ['/host-eurovision-party', '/en/eurovision-party'],
    ]
    for (const [source, destination] of want) {
      const r = cfg.redirects.find((x: any) => x.source === source)
      expect(r, source).toBeDefined()
      expect(r.destination).toBe(destination)
      expect(r.permanent).toBe(true)
    }
  })

  it('SPA rewrite falls back outside locale prefixes only', () => {
    expect(cfg.rewrites).toHaveLength(1)
    const rw = cfg.rewrites[0]
    expect(rw.destination).toBe('/')
    const re = new RegExp('^' + rw.source + '$')
    for (const p of ['/room/ABCD', '/admin', '/how-to-play', '/online-games', '/']) {
      expect(re.test(p), p).toBe(true)
    }
    for (const p of ['/en/no-such-page', '/el/faq']) {
      expect(re.test(p), p).toBe(false)
    }
    // Exact /en and /el match the rewrite, which is fine: Vercel checks the
    // filesystem before rewrites, so the prerendered en.html / el.html wins.
    for (const p of ['/en', '/el']) {
      expect(re.test(p), p).toBe(true)
    }
  })
})
