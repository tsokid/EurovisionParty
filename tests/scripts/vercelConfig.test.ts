import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PAGE_REGISTRY } from '../../src/lib/seo/registry'

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
    // Missing content files 404 instead of falling back to the SPA shell,
    // so useContent sees `missing` rather than HTML.
    for (const p of ['/content/contests/1066.json', '/content/countries/index.json', '/content/site.json']) {
      expect(re.test(p), p).toBe(false)
    }
    // Exact /en and /el match the rewrite, which is fine: Vercel checks the
    // filesystem before rewrites, so the prerendered en.html / el.html wins.
    for (const p of ['/en', '/el']) {
      expect(re.test(p), p).toBe(true)
    }
  })

  describe('legacy unprefixed URLs (I1) and home (I2)', () => {
    type Redirect = {
      source: string
      destination: string
      permanent: boolean
      has?: Array<{ type: string; key: string; value: string }>
    }
    const redirects: Redirect[] = cfg.redirects

    // Minimal path-to-regexp for the forms used here: `/:name(alt|alt)` and literals.
    function match(source: string, path: string): Record<string, string> | null {
      const names: string[] = []
      const re = new RegExp(
        '^' + source.replace(/:(\w+)\(([^)]*)\)/g, (_m, name, alt) => {
          names.push(name)
          return `(${alt})`
        }) + '$',
      )
      const m = re.exec(path)
      if (!m) return null
      return Object.fromEntries(names.map((n, i) => [n, m[i + 1]]))
    }

    // `has` values are full-match regexes (anchored), as on Vercel/Next.js.
    /** First redirect that applies to (path, accept-language), resolved; null if none. */
    function resolveRedirect(path: string, acceptLanguage: string): { to: string; r: Redirect; index: number } | null {
      for (const [index, r] of redirects.entries()) {
        const params = match(r.source, path)
        if (!params) continue
        const hasOk = (r.has ?? []).every(
          (h) => h.type === 'header' && h.key === 'accept-language' && new RegExp('^' + h.value + '$').test(acceptLanguage),
        )
        if (!hasOk) continue
        const to = r.destination.replace(/:(\w+)/g, (_m, n) => params[n] ?? `:${n}`)
        return { to, r, index }
      }
      return null
    }

    const slugs = PAGE_REGISTRY.filter((p) => p.id !== 'home').map((p) => p.slugByLocale.en)

    it('covers all 16 non-home registry pages', () => {
      expect(slugs).toHaveLength(16)
    })

    it.each(slugs)('%s 308s to /en<slug>, or /el<slug> for Greek browsers', (slug) => {
      const en = resolveRedirect(slug, 'en-GB,en;q=0.9')
      expect(en?.to).toBe(`/en${slug}`)
      expect(en?.r.permanent).toBe(true)
      expect(en?.r.has).toBeUndefined()

      for (const al of ['el', 'el-GR,el;q=0.9,en;q=0.8', 'en-US,en;q=0.9,el;q=0.8']) {
        const el = resolveRedirect(slug, al)
        expect(el?.to, al).toBe(`/el${slug}`)
        expect(el?.r.permanent).toBe(true)
        expect(el!.index).toBeLessThan(en!.index)
      }
    })

    it('does not treat look-alike language tags as Greek', () => {
      expect(resolveRedirect('/faq', 'de-DE,de;q=0.9')?.to).toBe('/en/faq')
      expect(resolveRedirect('/faq', '')?.to).toBe('/en/faq')
    })

    it.each(['/online-games', '/mobile-games'])('%s 308s to /en/eurovision-games', (p) => {
      const r = resolveRedirect(p, 'el-GR')
      expect(r?.to).toBe('/en/eurovision-games')
      expect(r?.r.permanent).toBe(true)
    })

    it('home 308s to /en, or /el for Greek browsers (el variant first)', () => {
      const en = resolveRedirect('/', 'en-US')
      expect(en?.to).toBe('/en')
      expect(en?.r.permanent).toBe(true)
      expect(en?.r.has).toBeUndefined()
      const el = resolveRedirect('/', 'el-GR,el;q=0.9')
      expect(el?.to).toBe('/el')
      expect(el?.r.permanent).toBe(true)
      expect(el!.index).toBeLessThan(en!.index)
    })

    it('does not redirect app routes or locale pages', () => {
      for (const p of ['/room/ABCD', '/admin', '/en', '/el', '/en/faq', '/el/how-to-play', '/sitemap.xml']) {
        expect(resolveRedirect(p, 'el-GR'), p).toBeNull()
      }
    })
  })
})
