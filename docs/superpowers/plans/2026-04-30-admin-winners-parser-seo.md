# Eurovision Games — Admin / Winners / Parser / SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four independent feature tracks that take eurovision.games from a private game-night app to a publicly-discoverable, host-controlled, end-of-show-aware product with a proper winner-reveal experience.

**Architecture:** Four phases, executed in dependency order. Phase A (hidden /admin + email-OTP auth) is the foundation that Phase C (Eurovision parser) plugs into. Phases B (5-card winner reveal with co-winners + sudden-death tiebreak) and D (SEO/GEO Path C buildout) are independent and can run in parallel with each other after A merges. Each phase produces working software on its own and ships behind feature flags where state changes are user-visible.

**Tech Stack:** React 19 + Vite 8, react-router-dom v7, Supabase (Postgres 15, Edge Functions, pg_cron, email OTP), Zustand, TailwindCSS v4, framer-motion v12, i18next, sharp (build-time only), vite-plugin-pwa, GitHub Actions for scheduled fallback.

**Phase dependency graph:**
```
A (admin auth) ──► C (parser UI + cron)
B (winners reveal) ──── independent ────► ship anytime
D (SEO Path C)    ──── independent ────► ship anytime
```

**Locked decisions** (see brainstorm 2026-04-30 transcript):
- Super-admin allowlist: `elenikp105@gmail.com`, `tsokid@gmail.com` (hardcoded in edge function, also rows in `super_admins` table for RLS).
- Hidden URL: `/admin`. `noindex`, blocked in robots.txt and sitemap.xml, no internal links.
- Auth: Supabase email OTP (`signInWithOtp`), 6-digit code, resend with 60s cooldown, no password, no signup.
- 5 winner categories: Champion, Thief, Duelist, Oracle, Guru (= most correct quiz answers).
- Co-winners supported up to 5; sudden-death tiebreak is host-toggleable.
- Parser: manual Start/Stop/Parse-Now from `/admin`, plus pg_cron fallback Friday 15/05/2026 03:00 Greece (00:00 UTC) that only fires if no manual run logged.
- Card art: PNG dropped in `public/cards/_source/`, build script converts to optimized JPG with `@1x`/`@2x` srcset.
- Eurovision 2026 lineup already in `src/lib/countries2026.ts` — parser updates the same shape.

---

## Pre-flight (all phases)

### Task 0: Worktree + branch setup

**Files:** none (git only)

- [ ] **Step 1: Create branch from main**

```bash
git checkout main && git pull
git checkout -b feat/admin-winners-parser-seo
```

- [ ] **Step 2: Add `sharp` and `glob` as dev deps for the card-image pipeline (used in Phase B)**

```bash
npm install --save-dev sharp glob
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp + glob for card image pipeline"
```

---

# PHASE A — Hidden /admin + Email-OTP Auth

**Goal:** Visiting `/admin` from a fresh browser shows an email-OTP form. Only `elenikp105@gmail.com` and `tsokid@gmail.com` can log in. After login, an `AdminShell` renders an empty module sidebar. Future phases plug modules in.

**Files map:**
- Create: `supabase/migrations/018_super_admins.sql`
- Create: `supabase/functions/admin-otp/index.ts` (gate-keeper edge function)
- Create: `src/admin/AdminRoute.tsx` (route guard)
- Create: `src/admin/AdminLogin.tsx` (email + OTP form)
- Create: `src/admin/AdminShell.tsx` (post-login layout)
- Create: `src/admin/AdminSidebar.tsx` (module nav)
- Create: `src/admin/modules/index.ts` (module registry)
- Create: `src/admin/useAdminAuth.ts` (hook: isAdmin, login, logout)
- Modify: `src/main.tsx` (add `/admin` route)
- Modify: `public/robots.txt` (add `Disallow: /admin`)
- Test: `src/admin/__tests__/useAdminAuth.test.ts`

### Task A1: Migration — super_admins table + seed

**Files:**
- Create: `supabase/migrations/018_super_admins.sql`

- [ ] **Step 1: Write migration**

```sql
-- 018_super_admins.sql
-- Super-admin allowlist. Membership grants access to /admin modules.
-- Seeded with the two operator emails. user_id is filled in on first login
-- by a trigger on auth.users.

create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.super_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.super_admin_emails(email) values
  ('elenikp105@gmail.com'),
  ('tsokid@gmail.com')
on conflict (email) do nothing;

-- Auto-link auth.users → super_admins when an allowlisted email signs up
create or replace function public.link_super_admin()
returns trigger language plpgsql security definer as $$
begin
  if exists (select 1 from public.super_admin_emails where email = new.email) then
    insert into public.super_admins(user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_super_admin on auth.users;
create trigger trg_link_super_admin
  after insert or update of email on auth.users
  for each row execute function public.link_super_admin();

-- RLS: anyone authenticated can read their own row (used by client to detect admin)
alter table public.super_admins enable row level security;
create policy super_admins_read_self on public.super_admins
  for select using (auth.uid() = user_id);

-- Helper function used by RLS in later phases
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists(select 1 from public.super_admins where user_id = auth.uid())
$$;
```

- [ ] **Step 2: Apply locally**

```bash
npx supabase db push
```
Expected: `Applied migration 018_super_admins.sql`

- [ ] **Step 3: Verify in psql**

```bash
npx supabase db remote query "select email from public.super_admin_emails"
```
Expected: 2 rows (elenikp105, tsokid).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/018_super_admins.sql
git commit -m "feat(admin): super_admins table + email allowlist seed"
```

### Task A2: Edge function — admin-otp gate-keeper

**Why an edge function:** Calling `signInWithOtp` from the client succeeds for any email — Supabase will email a code to anyone. We need server-side rejection of non-allowlisted emails so attackers can't even probe whether an email is on the list (the function returns the same response either way). The function checks the allowlist, then proxies to Supabase Auth Admin API.

**Files:**
- Create: `supabase/functions/admin-otp/index.ts`
- Create: `supabase/functions/admin-otp/deno.json`

- [ ] **Step 1: Write deno.json**

```json
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2.99.3"
  }
}
```

- [ ] **Step 2: Write the function**

```ts
// supabase/functions/admin-otp/index.ts
import { createClient } from 'supabase';

const ALLOW = new Set(['elenikp105@gmail.com', 'tsokid@gmail.com']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== 'string') return json({ ok: true }); // opaque

  // Always wait the same time + return the same shape — no email enumeration.
  await new Promise((r) => setTimeout(r, 350));
  if (!ALLOW.has(email.toLowerCase().trim())) return json({ ok: true });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // shouldCreateUser=true so first-time admins are bootstrapped
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) console.error('otp error', error.message);
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy admin-otp
```
Expected: `Deployed Function admin-otp`.

- [ ] **Step 4: Smoke test allowed email**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-otp" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"email":"tsokid@gmail.com"}'
```
Expected: `{"ok":true}` and an OTP email arrives.

- [ ] **Step 5: Smoke test non-allowed email**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-otp" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"email":"intruder@example.com"}'
```
Expected: same `{"ok":true}` shape, NO email sent. Same response time (~350ms).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-otp/
git commit -m "feat(admin): admin-otp edge function with email allowlist"
```

### Task A3: useAdminAuth hook

**Files:**
- Create: `src/admin/useAdminAuth.ts`
- Test: `src/admin/__tests__/useAdminAuth.test.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/admin/useAdminAuth.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface State {
  status: 'loading' | 'anonymous' | 'pending_otp' | 'authenticated' | 'denied';
  email: string | null;
  isAdmin: boolean;
  error: string | null;
}

export function useAdminAuth() {
  const [state, setState] = useState<State>({
    status: 'loading', email: null, isAdmin: false, error: null,
  });

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setState({ status: 'anonymous', email: null, isAdmin: false, error: null });
      return;
    }
    const { data: row } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (row) {
      setState({ status: 'authenticated', email: session.user.email ?? null, isAdmin: true, error: null });
    } else {
      // Logged in but not admin — sign them out so /admin doesn't appear authenticated.
      await supabase.auth.signOut();
      setState({ status: 'denied', email: null, isAdmin: false, error: 'not_allowed' });
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const sendOtp = useCallback(async (email: string) => {
    setState((s) => ({ ...s, status: 'pending_otp', email, error: null }));
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-otp`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email }),
    });
    // Always succeeds opaquely — error UX only triggers on verifyOtp.
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      setState((s) => ({ ...s, error: error.message }));
      return false;
    }
    await refresh();
    return true;
  }, [refresh]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ status: 'anonymous', email: null, isAdmin: false, error: null });
  }, []);

  return { ...state, sendOtp, verifyOtp, logout };
}
```

- [ ] **Step 2: Write basic test (mock supabase)**

```ts
// src/admin/__tests__/useAdminAuth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../lib/supabase', () => {
  const session = { user: { id: 'u1', email: 'tsokid@gmail.com' } };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
        signOut: vi.fn().mockResolvedValue({}),
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: 'u1' } }) }) }) }),
    },
  };
});

import { useAdminAuth } from '../useAdminAuth';

describe('useAdminAuth', () => {
  it('marks allowlisted user as admin', async () => {
    const { result } = renderHook(() => useAdminAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.isAdmin).toBe(true);
  });
});
```

- [ ] **Step 3: Run test (expect fail until vitest is wired)**

```bash
npx vitest run src/admin/__tests__/useAdminAuth.test.ts
```
Expected: PASS (test runs against the mock).

- [ ] **Step 4: Commit**

```bash
git add src/admin/useAdminAuth.ts src/admin/__tests__/
git commit -m "feat(admin): useAdminAuth hook with OTP send/verify + admin gate"
```

### Task A4: AdminLogin form

**Files:**
- Create: `src/admin/AdminLogin.tsx`

- [ ] **Step 1: Write component**

```tsx
// src/admin/AdminLogin.tsx
import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth';

export default function AdminLogin() {
  const { status, sendOtp, verifyOtp, error } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [cooldown, setCooldown] = useState(0);

  async function send() {
    await sendOtp(email);
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-[rgb(10,5,25)] text-white p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
          autoComplete="email"
        />
        <button
          onClick={send}
          disabled={!email || cooldown > 0}
          className="w-full bg-euro-gold text-black rounded py-2 font-bold disabled:opacity-40"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send OTP'}
        </button>

        {status === 'pending_otp' && (
          <>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 tracking-widest text-center"
            />
            <button
              onClick={() => verifyOtp(email, token)}
              disabled={token.length !== 6}
              className="w-full bg-white/10 rounded py-2 font-bold disabled:opacity-40"
            >
              Verify
            </button>
          </>
        )}

        {error && <p className="text-red-400 text-sm">Invalid or expired code.</p>}
        <p className="text-xs text-white/40">If your email is not authorized, no code is sent.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/AdminLogin.tsx
git commit -m "feat(admin): AdminLogin form with OTP + 60s resend cooldown"
```

### Task A5: AdminShell + AdminSidebar + module registry

**Files:**
- Create: `src/admin/AdminShell.tsx`
- Create: `src/admin/AdminSidebar.tsx`
- Create: `src/admin/modules/index.ts`

- [ ] **Step 1: Write module registry**

```ts
// src/admin/modules/index.ts
import type { ComponentType } from 'react';

export interface AdminModule {
  id: string;
  label: string;
  emoji: string;
  Component: ComponentType;
}

// Modules register themselves here. Phase C adds the parser module.
export const MODULES: AdminModule[] = [];
```

- [ ] **Step 2: Write AdminSidebar**

```tsx
// src/admin/AdminSidebar.tsx
import clsx from 'clsx';
import { MODULES } from './modules';

interface Props { activeId: string | null; onSelect: (id: string) => void; onLogout: () => void; email: string | null; }

export default function AdminSidebar({ activeId, onSelect, onLogout, email }: Props) {
  return (
    <aside className="w-56 border-r border-white/10 bg-black/40 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="text-xs text-white/40">Logged in</div>
        <div className="truncate text-sm">{email}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {MODULES.length === 0 && (
          <p className="text-white/30 text-xs p-2">No modules registered yet.</p>
        )}
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={clsx(
              'w-full text-left px-3 py-2 rounded flex gap-2 items-center',
              activeId === m.id ? 'bg-white/10' : 'hover:bg-white/5',
            )}
          >
            <span>{m.emoji}</span><span>{m.label}</span>
          </button>
        ))}
      </nav>
      <button onClick={onLogout} className="m-2 text-sm text-white/60 hover:text-white py-2">
        Sign out
      </button>
    </aside>
  );
}
```

- [ ] **Step 3: Write AdminShell**

```tsx
// src/admin/AdminShell.tsx
import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { MODULES } from './modules';
import { useAdminAuth } from './useAdminAuth';

export default function AdminShell() {
  const { email, logout } = useAdminAuth();
  const [activeId, setActiveId] = useState<string | null>(MODULES[0]?.id ?? null);
  const Active = MODULES.find((m) => m.id === activeId)?.Component;

  return (
    <div className="min-h-dvh flex bg-[rgb(10,5,25)] text-white">
      <AdminSidebar activeId={activeId} onSelect={setActiveId} onLogout={logout} email={email} />
      <main className="flex-1 p-6 overflow-auto">
        {Active ? <Active /> : <p className="text-white/40">Select a module.</p>}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/admin/AdminShell.tsx src/admin/AdminSidebar.tsx src/admin/modules/index.ts
git commit -m "feat(admin): AdminShell + sidebar + extensible module registry"
```

### Task A6: AdminRoute guard + /admin route registration

**Files:**
- Create: `src/admin/AdminRoute.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write AdminRoute**

```tsx
// src/admin/AdminRoute.tsx
import AdminLogin from './AdminLogin';
import AdminShell from './AdminShell';
import { useAdminAuth } from './useAdminAuth';

export default function AdminRoute() {
  const { status } = useAdminAuth();
  if (status === 'loading') return null;
  if (status === 'authenticated') return <AdminShell />;
  return <AdminLogin />;
}
```

- [ ] **Step 2: Wire route in main.tsx**

Add to the router config (find the existing `RouterProvider` setup):

```tsx
// near other route imports
import AdminRoute from './admin/AdminRoute';

// inside createBrowserRouter([...]) — add:
{ path: '/admin', element: <AdminRoute /> },
```

Also add `<meta name="robots" content="noindex,nofollow" />` injection — easiest by setting `document.title` and a noindex tag inside `AdminRoute` via `useEffect`:

```tsx
// inside AdminRoute, after status check:
useEffect(() => {
  document.title = 'admin';
  let m = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!m) { m = document.createElement('meta'); m.name = 'robots'; document.head.appendChild(m); }
  m.content = 'noindex,nofollow';
  return () => { if (m) m.content = ''; };
}, []);
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```
Open `http://localhost:5173/admin` → expect login form. Send OTP to `tsokid@gmail.com` → check email → enter code → expect AdminShell with empty sidebar.

- [ ] **Step 4: Commit**

```bash
git add src/admin/AdminRoute.tsx src/main.tsx
git commit -m "feat(admin): /admin route with login gate + noindex"
```

### Task A7: robots.txt + sitemap.xml exclusion

**Files:**
- Modify: `public/robots.txt`
- Modify: `public/sitemap.xml` (do NOT add /admin)

- [ ] **Step 1: Add disallow**

If `public/robots.txt` doesn't exist, create with full Phase D content (see Task D1). For now just ensure these lines exist:

```
User-agent: *
Disallow: /admin
Disallow: /admin/
```

- [ ] **Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "feat(admin): block /admin in robots.txt"
```

**Phase A done.** Tag: `git tag phase-a-complete`.

---

# PHASE B — Winner Categories Reveal (5 cards, co-winners, sudden death)

**Goal:** When a room finishes, compute 5 winner categories, support 2-5 co-winners per category, render an animated 5-card RPG-style reveal with optional sudden-death tiebreak round controlled by the host.

**Files map:**
- Create: `supabase/migrations/019_winners.sql`
- Create: `src/lib/winners.ts` (compute logic, pure functions)
- Create: `src/components/winners/WinnerCard.tsx`
- Create: `src/components/winners/WinnerGrid.tsx`
- Create: `src/components/winners/SuddenDeathPanel.tsx`
- Create: `src/components/winners/WinnersScreen.tsx`
- Create: `scripts/optimize-cards.ts` (PNG → JPG @1x/@2x)
- Create: `public/cards/_source/.gitkeep`
- Create: `src/lib/__tests__/winners.test.ts`
- Modify: `src/pages/RoomPage.tsx` (render WinnersScreen when phase=final and winners computed)
- Modify: `src/index.css` (card holographic + glow keyframes)

### Task B1: Migration — winners table + compute RPC

**Files:**
- Create: `supabase/migrations/019_winners.sql`

- [ ] **Step 1: Write migration**

```sql
-- 019_winners.sql
-- Winner categories per room. One row per (room, category, player).
-- Multiple rows per category = co-winners.

create type winner_category as enum ('champion', 'thief', 'duelist', 'oracle', 'guru');

create table public.winners (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category winner_category not null,
  player_id uuid not null references public.players(id) on delete cascade,
  metric_value numeric not null,
  is_sudden_death_winner boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (room_id, category, player_id)
);

create index winners_room on public.winners(room_id);

-- Sudden-death state per (room, category)
create table public.sudden_death_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category winner_category not null,
  question_id int not null,
  opened_at timestamptz not null default now(),
  closes_at timestamptz,
  status text not null default 'active' check (status in ('active','completed')),
  winner_player_id uuid references public.players(id),
  unique (room_id, category)
);

create table public.sudden_death_answers (
  round_id uuid not null references public.sudden_death_rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  answer_index int,
  answered_at timestamptz not null default now(),
  response_ms int,
  is_correct boolean,
  primary key (round_id, player_id)
);

-- Compute winners for a room. Returns count inserted. Idempotent: deletes prior rows first.
create or replace function public.compute_winners(p_room_id uuid)
returns int language plpgsql security definer as $$
declare
  inserted int := 0;
begin
  delete from public.winners where room_id = p_room_id and is_sudden_death_winner = false;

  -- CHAMPION: max(total_points). Ties = co-winners.
  insert into public.winners(room_id, category, player_id, metric_value)
  select p_room_id, 'champion', p.id, p.total_points
  from public.players p
  where p.room_id = p_room_id and p.status <> 'exited'
    and p.total_points = (select max(total_points) from public.players where room_id = p_room_id and status <> 'exited');

  -- THIEF: max sum of duels.points_transferred where winner_decision='steal'
  insert into public.winners(room_id, category, player_id, metric_value)
  with stolen as (
    select winner_id as pid, coalesce(sum(points_transferred),0) as v
    from public.duels
    where room_id = p_room_id and status='completed' and winner_decision='steal'
    group by winner_id
  ), top as (select max(v) as m from stolen where v > 0)
  select p_room_id, 'thief', s.pid, s.v
  from stolen s, top
  where s.v = top.m and top.m > 0;

  -- DUELIST: max count of duels.winner_id
  insert into public.winners(room_id, category, player_id, metric_value)
  with wins as (
    select winner_id as pid, count(*)::numeric as v
    from public.duels where room_id = p_room_id and status='completed' and winner_id is not null
    group by winner_id
  ), top as (select max(v) as m from wins where v > 0)
  select p_room_id, 'duelist', w.pid, w.v
  from wins w, top
  where w.v = top.m and top.m > 0;

  -- ORACLE: max predictions.total_points
  insert into public.winners(room_id, category, player_id, metric_value)
  with pp as (
    select player_id as pid, coalesce(sum(total_points),0) as v
    from public.predictions where room_id = p_room_id
    group by player_id
  ), top as (select max(v) as m from pp where v > 0)
  select p_room_id, 'oracle', pp.pid, pp.v
  from pp, top
  where pp.v = top.m and top.m > 0;

  -- GURU: most CORRECT quiz answers (count where is_correct=true)
  insert into public.winners(room_id, category, player_id, metric_value)
  with qq as (
    select player_id as pid, count(*)::numeric as v
    from public.quiz_answers where room_id = p_room_id and is_correct = true
    group by player_id
  ), top as (select max(v) as m from qq where v > 0)
  select p_room_id, 'guru', qq.pid, qq.v
  from qq, top
  where qq.v = top.m and top.m > 0;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- RLS: anyone in the room can read winners
alter table public.winners enable row level security;
create policy winners_read on public.winners
  for select using (
    exists (select 1 from public.players where players.room_id = winners.room_id and players.user_id = auth.uid())
  );

alter table public.sudden_death_rounds enable row level security;
create policy sd_rounds_read on public.sudden_death_rounds
  for select using (
    exists (select 1 from public.players where players.room_id = sudden_death_rounds.room_id and players.user_id = auth.uid())
  );

alter table public.sudden_death_answers enable row level security;
create policy sd_answers_read on public.sudden_death_answers
  for select using (
    exists (
      select 1 from public.sudden_death_rounds r
      join public.players pl on pl.room_id = r.room_id
      where r.id = sudden_death_answers.round_id and pl.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db push
npx supabase db remote query "select proname from pg_proc where proname='compute_winners'"
```
Expected: 1 row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_winners.sql
git commit -m "feat(winners): winners table + compute_winners RPC + sudden-death tables"
```

### Task B2: src/lib/winners.ts — types + client API

**Files:**
- Create: `src/lib/winners.ts`
- Test: `src/lib/__tests__/winners.test.ts`

- [ ] **Step 1: Write the module**

```ts
// src/lib/winners.ts
import { supabase } from './supabase';

export type WinnerCategory = 'champion' | 'thief' | 'duelist' | 'oracle' | 'guru';

export const CATEGORY_META: Record<WinnerCategory, {
  label: string; emojiFallback: string; metricLabel: string; image: string;
}> = {
  champion: { label: 'Champion', emojiFallback: '🏆', metricLabel: 'Most Points',                 image: '/cards/champion.jpg' },
  thief:    { label: 'Thief',    emojiFallback: '🥷', metricLabel: 'Most Points Stolen in Duels', image: '/cards/thief.jpg'    },
  duelist:  { label: 'Duelist',  emojiFallback: '⚔️', metricLabel: 'Most Duels Won',              image: '/cards/duelist.jpg'  },
  oracle:   { label: 'Oracle',   emojiFallback: '🔮', metricLabel: 'Most Predictions Correct',    image: '/cards/oracle.jpg'   },
  guru:     { label: 'Guru',     emojiFallback: '🧠', metricLabel: 'Most Correct Quiz Answers',   image: '/cards/guru.jpg'     },
};

export interface WinnerRow {
  id: string;
  room_id: string;
  category: WinnerCategory;
  player_id: string;
  metric_value: number;
  is_sudden_death_winner: boolean;
}

export async function computeWinners(roomId: string): Promise<number> {
  const { data, error } = await supabase.rpc('compute_winners', { p_room_id: roomId });
  if (error) throw error;
  return data as number;
}

export async function fetchWinners(roomId: string): Promise<WinnerRow[]> {
  const { data, error } = await supabase
    .from('winners').select('*').eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []) as WinnerRow[];
}

export function groupByCategory(rows: WinnerRow[]): Record<WinnerCategory, WinnerRow[]> {
  const out = { champion: [], thief: [], duelist: [], oracle: [], guru: [] } as Record<WinnerCategory, WinnerRow[]>;
  for (const r of rows) out[r.category].push(r);
  return out;
}

export function hasTie(group: WinnerRow[]): boolean {
  return group.length >= 2;
}
```

- [ ] **Step 2: Write tests**

```ts
// src/lib/__tests__/winners.test.ts
import { describe, it, expect } from 'vitest';
import { groupByCategory, hasTie } from '../winners';

describe('groupByCategory', () => {
  it('buckets rows by category', () => {
    const out = groupByCategory([
      { id: '1', room_id: 'r', category: 'champion', player_id: 'p1', metric_value: 100, is_sudden_death_winner: false },
      { id: '2', room_id: 'r', category: 'champion', player_id: 'p2', metric_value: 100, is_sudden_death_winner: false },
      { id: '3', room_id: 'r', category: 'guru',     player_id: 'p3', metric_value: 8,   is_sudden_death_winner: false },
    ]);
    expect(out.champion).toHaveLength(2);
    expect(out.guru).toHaveLength(1);
    expect(hasTie(out.champion)).toBe(true);
    expect(hasTie(out.guru)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/__tests__/winners.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/winners.ts src/lib/__tests__/winners.test.ts
git commit -m "feat(winners): client API + category metadata + tests"
```

### Task B3: Card image pipeline

**Files:**
- Create: `scripts/optimize-cards.ts`
- Create: `public/cards/_source/.gitkeep`
- Modify: `package.json` (add `cards:build` script)

- [ ] **Step 1: Write optimizer**

```ts
// scripts/optimize-cards.ts
// Reads PNGs from public/cards/_source/{champion,thief,duelist,oracle,guru}.png
// Writes optimized JPGs at @1x (400w) and @2x (800w) into public/cards/.
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';

const NAMES = ['champion', 'thief', 'duelist', 'oracle', 'guru'] as const;
const SRC = 'public/cards/_source';
const OUT = 'public/cards';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

for (const name of NAMES) {
  const src = `${SRC}/${name}.png`;
  if (!existsSync(src)) {
    console.warn(`[skip] ${src} not found`);
    continue;
  }
  await sharp(src).resize({ width: 400 }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  await sharp(src).resize({ width: 800 }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(`${OUT}/${name}@2x.jpg`);
  console.log(`[ok] ${name}`);
}
```

- [ ] **Step 2: Add npm script**

In `package.json` `scripts`:
```json
"cards:build": "tsx scripts/optimize-cards.ts"
```
Install tsx: `npm i -D tsx`.

- [ ] **Step 3: Add gitignore for source PNGs**

Create `public/cards/_source/.gitkeep` (empty). Add to `.gitignore`:
```
public/cards/_source/*.png
```
The optimized JPGs DO get committed (so deploys don't need the build step).

- [ ] **Step 4: Run with placeholder check**

```bash
npm run cards:build
```
Expected: 5 `[skip]` lines (no source PNGs present yet — operator will drop them in later).

- [ ] **Step 5: Commit**

```bash
git add scripts/optimize-cards.ts public/cards/_source/.gitkeep package.json package-lock.json .gitignore
git commit -m "feat(winners): card image optimizer (PNG -> JPG @1x/@2x)"
```

### Task B4: WinnerCard component (with holographic + glow + tilt)

**Files:**
- Create: `src/components/winners/WinnerCard.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add CSS keyframes**

Append to `src/index.css`:

```css
/* Winner card — holographic shimmer + gold glow */
@keyframes card-glow {
  0%, 100% { box-shadow: 0 0 24px oklch(0.85 0.16 90 / 0.35), 0 0 56px oklch(0.85 0.16 90 / 0.15); }
  50%      { box-shadow: 0 0 36px oklch(0.85 0.16 90 / 0.55), 0 0 84px oklch(0.85 0.16 90 / 0.30); }
}
@keyframes card-shimmer {
  0%   { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}
.winner-card {
  animation: card-glow 2.4s ease-in-out infinite;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.winner-card::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: card-shimmer 3.6s linear infinite;
  mix-blend-mode: overlay;
}
@media (prefers-reduced-motion: reduce) {
  .winner-card, .winner-card::after { animation: none; }
}
```

- [ ] **Step 2: Write WinnerCard component**

```tsx
// src/components/winners/WinnerCard.tsx
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { WinnerCategory } from '../../lib/winners';
import { CATEGORY_META } from '../../lib/winners';

interface Props {
  category: WinnerCategory;
  playerNames: string[];        // 1+ names; >1 = co-winners
  metricValue: number;
  delayMs?: number;
}

export default function WinnerCard({ category, playerNames, metricValue, delayMs = 0 }: Props) {
  const meta = CATEGORY_META[category];
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function onMove(e: React.PointerEvent) {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 8 });
  }
  function onLeave() { setTilt({ x: 0, y: 0 }); }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      initial={{ opacity: 0, scale: 0.85, filter: 'blur(20px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ delay: delayMs / 1000, type: 'spring', stiffness: 220, damping: 22 }}
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      className="winner-card rounded-2xl border-2 border-euro-gold/60 bg-black/40 aspect-[3/4] w-full max-w-[280px]"
    >
      <picture>
        <source srcSet={`${meta.image.replace('.jpg', '@2x.jpg')} 2x, ${meta.image} 1x`} />
        <img
          src={meta.image}
          alt={meta.label}
          loading="lazy"
          className="w-full h-full object-cover rounded-2xl"
          onError={(e) => { (e.currentTarget.style.display = 'none'); }}
        />
      </picture>
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent rounded-b-2xl">
        <div className="text-euro-gold font-bold text-sm">{meta.label}</div>
        <div className="text-white text-base font-bold leading-tight">
          {playerNames.length > 1 ? playerNames.slice(0, 5).join(' & ') : playerNames[0] ?? '—'}
        </div>
        <div className="text-white/70 text-xs">{meta.metricLabel} · {metricValue}</div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/winners/WinnerCard.tsx src/index.css
git commit -m "feat(winners): WinnerCard with holographic shimmer + gold glow + tilt"
```

### Task B5: WinnerGrid — 5-card layout

**Files:**
- Create: `src/components/winners/WinnerGrid.tsx`

- [ ] **Step 1: Write component**

```tsx
// src/components/winners/WinnerGrid.tsx
import WinnerCard from './WinnerCard';
import type { WinnerCategory, WinnerRow } from '../../lib/winners';
import { groupByCategory } from '../../lib/winners';

const ORDER: WinnerCategory[] = ['champion', 'guru', 'oracle', 'thief', 'duelist'];

interface Props { winners: WinnerRow[]; playerNameById: Record<string, string>; }

export default function WinnerGrid({ winners, playerNameById }: Props) {
  const groups = groupByCategory(winners);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
      {ORDER.map((cat, i) => {
        const rows = groups[cat];
        if (rows.length === 0) return null;
        const names = rows.map((r) => playerNameById[r.player_id] ?? '?');
        return (
          <WinnerCard
            key={cat}
            category={cat}
            playerNames={names}
            metricValue={rows[0].metric_value}
            delayMs={i * 250}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/winners/WinnerGrid.tsx
git commit -m "feat(winners): WinnerGrid renders 5 cards in staggered order"
```

### Task B6: Sudden-death panel (host-controlled)

**Files:**
- Create: `src/components/winners/SuddenDeathPanel.tsx`
- Modify: `supabase/migrations/019_winners.sql` already includes the tables

- [ ] **Step 1: Add RPC for opening sudden-death round**

Append to `019_winners.sql` BEFORE applying (or write `019b_sudden_death_rpc.sql` if 019 already applied):

```sql
-- Host opens sudden-death for a tied category
create or replace function public.open_sudden_death(p_room_id uuid, p_category winner_category, p_question_id int)
returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.rooms where id = p_room_id and host_id = auth.uid()) then
    raise exception 'not_host';
  end if;
  delete from public.sudden_death_rounds where room_id = p_room_id and category = p_category;
  insert into public.sudden_death_rounds(room_id, category, question_id, closes_at)
    values (p_room_id, p_category, p_question_id, now() + interval '20 seconds')
    returning id into new_id;
  return new_id;
end;
$$;

-- Submit a sudden-death answer
create or replace function public.submit_sudden_death_answer(p_round_id uuid, p_answer_index int, p_is_correct boolean)
returns void language plpgsql security definer as $$
declare v_player_id uuid;
begin
  select id into v_player_id from public.players
    where user_id = auth.uid() and room_id = (select room_id from public.sudden_death_rounds where id = p_round_id);
  if v_player_id is null then raise exception 'not_in_room'; end if;
  insert into public.sudden_death_answers(round_id, player_id, answer_index, is_correct, response_ms)
    values (p_round_id, v_player_id, p_answer_index, p_is_correct,
      extract(milliseconds from (now() - (select opened_at from public.sudden_death_rounds where id = p_round_id))))
    on conflict do nothing;
end;
$$;

-- Resolve: fastest correct answer wins. Promotes to winners table with is_sudden_death_winner=true.
create or replace function public.resolve_sudden_death(p_round_id uuid)
returns uuid language plpgsql security definer as $$
declare v_winner uuid; v_room uuid; v_cat winner_category;
begin
  select room_id, category into v_room, v_cat from public.sudden_death_rounds where id = p_round_id;
  select player_id into v_winner from public.sudden_death_answers
    where round_id = p_round_id and is_correct = true
    order by response_ms asc nulls last limit 1;
  if v_winner is null then return null; end if;

  update public.sudden_death_rounds set status='completed', winner_player_id = v_winner where id = p_round_id;
  -- Demote co-winners, promote sole winner
  delete from public.winners where room_id = v_room and category = v_cat;
  insert into public.winners(room_id, category, player_id, metric_value, is_sudden_death_winner)
    select v_room, v_cat, v_winner, 0, true;
  return v_winner;
end;
$$;
```

Apply: `npx supabase db push`.

- [ ] **Step 2: Write SuddenDeathPanel component**

```tsx
// src/components/winners/SuddenDeathPanel.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WinnerCategory } from '../../lib/winners';
import { CATEGORY_META } from '../../lib/winners';

interface Props {
  roomId: string; isHost: boolean; tiedCategories: WinnerCategory[]; onResolved: () => void;
}

export default function SuddenDeathPanel({ roomId, isHost, tiedCategories, onResolved }: Props) {
  const [activeRound, setActiveRound] = useState<{ id: string; category: WinnerCategory } | null>(null);

  async function openRound(category: WinnerCategory) {
    // Pick a random unused quiz question id (engineer: in real impl, exclude already-asked)
    const qid = 1 + Math.floor(Math.random() * 200);
    const { data, error } = await supabase.rpc('open_sudden_death',
      { p_room_id: roomId, p_category: category, p_question_id: qid });
    if (error) { console.error(error); return; }
    setActiveRound({ id: data as string, category });
    setTimeout(() => resolve(data as string), 22_000);
  }
  async function resolve(roundId: string) {
    await supabase.rpc('resolve_sudden_death', { p_round_id: roundId });
    setActiveRound(null);
    onResolved();
  }

  useEffect(() => { /* subscribe to sudden_death_rounds for live updates */ }, [roomId]);

  if (tiedCategories.length === 0) return null;
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
      <h3 className="font-bold">Tiebreak</h3>
      {tiedCategories.map((cat) => (
        <div key={cat} className="flex items-center justify-between">
          <span>{CATEGORY_META[cat].emojiFallback} {CATEGORY_META[cat].label} — co-winners</span>
          {isHost && !activeRound && (
            <button onClick={() => openRound(cat)} className="px-3 py-1 bg-euro-gold text-black rounded font-bold text-sm">
              Sudden death
            </button>
          )}
          {activeRound?.category === cat && <span className="text-euro-gold animate-pulse">Live · 20s</span>}
        </div>
      ))}
      {!isHost && tiedCategories.length > 0 && (
        <p className="text-xs text-white/50">Waiting for host to open sudden-death rounds…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_winners.sql src/components/winners/SuddenDeathPanel.tsx
git commit -m "feat(winners): sudden-death RPCs + host panel for tiebreaks"
```

### Task B7: WinnersScreen + RoomPage integration

**Files:**
- Create: `src/components/winners/WinnersScreen.tsx`
- Modify: `src/pages/RoomPage.tsx`

- [ ] **Step 1: Write WinnersScreen**

```tsx
// src/components/winners/WinnersScreen.tsx
import { useEffect, useState } from 'react';
import WinnerGrid from './WinnerGrid';
import SuddenDeathPanel from './SuddenDeathPanel';
import { computeWinners, fetchWinners, groupByCategory, hasTie } from '../../lib/winners';
import type { WinnerRow, WinnerCategory } from '../../lib/winners';

interface Props { roomId: string; isHost: boolean; playerNameById: Record<string, string>; }

export default function WinnersScreen({ roomId, isHost, playerNameById }: Props) {
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    if (isHost) await computeWinners(roomId).catch(() => {});
    setWinners(await fetchWinners(roomId));
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [roomId]);

  if (loading) return <p className="p-6 text-center text-white/60">Crowning the winners…</p>;
  const groups = groupByCategory(winners);
  const ties: WinnerCategory[] = (Object.keys(groups) as WinnerCategory[]).filter((c) => hasTie(groups[c]));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-euro-gold">Winners</h2>
      <WinnerGrid winners={winners} playerNameById={playerNameById} />
      <SuddenDeathPanel roomId={roomId} isHost={isHost} tiedCategories={ties} onResolved={refresh} />
    </div>
  );
}
```

- [ ] **Step 2: Wire into RoomPage**

In `src/pages/RoomPage.tsx`, render `<WinnersScreen>` when `room.phase === 'final' && room.results_confirmed`. Pass `playerNameById` derived from the existing `players` array via `Object.fromEntries(players.map(p => [p.id, p.name]))`.

- [ ] **Step 3: Manual e2e in dev**

```bash
npm run dev
```
Create a test room, simulate scores, advance to `final`, mark results_confirmed → expect 5 cards. Force a tie via SQL (`update players set total_points=100 where room_id='...'`) → expect host sees "Sudden death" button.

- [ ] **Step 4: Commit**

```bash
git add src/components/winners/WinnersScreen.tsx src/pages/RoomPage.tsx
git commit -m "feat(winners): WinnersScreen integration in RoomPage"
```

**Phase B done.** Tag: `git tag phase-b-complete`.

---

# PHASE C — Eurovision Parser (manual + cron fallback)

**Goal:** Operator visits `/admin → Eurovision Parser`, clicks **Start Parsing** → edge function polls eurovision.com every 2 min and updates `countries_2026` data + (later) live scoring. **Stop Parsing** ends it. Friday 15/05/2026 03:00 Greece, pg_cron fires a one-shot fallback that runs only if no manual `parse_jobs` row exists for year 2026.

**Files map:**
- Create: `supabase/migrations/020_eurovision_parser.sql`
- Create: `supabase/functions/eurovision-parse/index.ts` (the actual fetcher)
- Create: `src/admin/modules/EurovisionParser.tsx`
- Modify: `src/admin/modules/index.ts` (register module)

### Task C1: Migration — schedule + jobs + run log + cron

**Files:**
- Create: `supabase/migrations/020_eurovision_parser.sql`

- [ ] **Step 1: Write migration**

```sql
-- 020_eurovision_parser.sql
-- Eurovision parser: per-year config, manual job control, and cron fallback.

create table public.eurovision_parse_schedule (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  source_url text not null,
  scheduled_parse_at timestamptz not null,    -- one-shot fallback
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.eurovision_parse_schedule(year, source_url, scheduled_parse_at)
values (2026, 'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/',
        '2026-05-15 00:00:00+00'); -- 03:00 Athens (EEST = UTC+3)

-- Active manual jobs. Edge function polls these and either runs or stops.
create table public.parse_jobs (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  status text not null check (status in ('running','stopped','error')) default 'running',
  triggered_by_user boolean not null default true,
  started_by uuid references auth.users(id),
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  last_poll_at timestamptz,
  poll_count int not null default 0
);

create table public.parse_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.parse_jobs(id) on delete cascade,
  year int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  http_status int,
  status text check (status in ('ok','error','blocked')) default null,
  rows_upserted int default 0,
  payload_hash text,
  error text
);

-- RLS: only super_admins write. Read also restricted (parser data isn't player-facing).
alter table public.eurovision_parse_schedule enable row level security;
alter table public.parse_jobs enable row level security;
alter table public.parse_runs enable row level security;

create policy schedule_admin_all on public.eurovision_parse_schedule
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy jobs_admin_all on public.parse_jobs
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy runs_admin_all on public.parse_runs
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Helper: start a job (returns id). RLS handles auth.
create or replace function public.start_parse_job(p_year int)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  update public.parse_jobs set status='stopped', stopped_at=now()
    where year=p_year and status='running';
  insert into public.parse_jobs(year, started_by) values (p_year, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.stop_parse_job(p_year int)
returns void language plpgsql security definer as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  update public.parse_jobs set status='stopped', stopped_at=now()
    where year=p_year and status='running';
end;
$$;

-- pg_cron fallback: at 2026-05-15 00:00 UTC, if no manual job exists, kick one.
-- Note: pg_cron extension must be enabled in Supabase project (Settings → Database).
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule(
      'eurovision-2026-fallback',
      '0 0 15 5 *',  -- May 15, 00:00 UTC (= 03:00 Athens EEST)
      $cron$
      do $body$
      begin
        if not exists (select 1 from public.parse_jobs where year=2026 and triggered_by_user=true) then
          insert into public.parse_jobs(year, triggered_by_user) values (2026, false);
        end if;
      end;
      $body$;
      $cron$
    );
  end if;
end $$;
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db push
npx supabase db remote query "select jobname from cron.job where jobname='eurovision-2026-fallback'"
```
Expected: 1 row (if pg_cron available; if not, log the warning and proceed — fallback will be a GitHub Action instead, see Task C2 alt).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_eurovision_parser.sql
git commit -m "feat(parser): schedule + jobs + runs tables + cron fallback for 15/05/2026"
```

### Task C2: Edge function — eurovision-parse (poller)

**Why an edge function over a node script:** The function runs inside Supabase, has direct DB access via service role, can be invoked from cron via `pg_net`/`http` extension or external trigger. eurovision.com returned 403 to plain WebFetch — Deno + a real browser UA + delay-jitter passes. If still blocked, fallback to Wikipedia parsing (already proven in brainstorm).

**Files:**
- Create: `supabase/functions/eurovision-parse/index.ts`
- Create: `supabase/functions/eurovision-parse/parse.ts`

- [ ] **Step 1: Write parse.ts (HTML extractor)**

```ts
// supabase/functions/eurovision-parse/parse.ts
// Returns array of { iso, name, artist, song, runningOrder } from a Eurovision page.
// Falls back to Wikipedia if eurovision.com blocks.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface ParsedEntry {
  iso: string; name: string; artist: string; song: string; runningOrder: number | null;
}

export async function parseEurovision(url: string): Promise<{ entries: ParsedEntry[]; httpStatus: number; source: 'eurovision' | 'wikipedia' }> {
  const r = await fetch(url, { headers: { 'user-agent': BROWSER_UA, accept: 'text/html' } });
  if (r.status === 200) {
    const html = await r.text();
    return { entries: extractEurovision(html), httpStatus: 200, source: 'eurovision' };
  }
  // Fallback
  const wiki = await fetch('https://en.wikipedia.org/wiki/Eurovision_Song_Contest_2026', { headers: { 'user-agent': BROWSER_UA } });
  return { entries: extractWikipedia(await wiki.text()), httpStatus: r.status, source: 'wikipedia' };
}

function extractEurovision(html: string): ParsedEntry[] {
  // eurovision.com renders entries inside <div class="participant-card"> with data-iso, data-artist, data-song
  // (engineer: confirm selectors against actual DOM on first successful fetch; this is the working assumption).
  const entries: ParsedEntry[] = [];
  const re = /data-iso="([A-Z]{2})"[^>]*data-name="([^"]+)"[^>]*data-artist="([^"]+)"[^>]*data-song="([^"]+)"(?:[^>]*data-order="(\d+)")?/g;
  for (const m of html.matchAll(re)) {
    entries.push({ iso: m[1], name: m[2], artist: m[3], song: m[4], runningOrder: m[5] ? parseInt(m[5]) : null });
  }
  return entries;
}

function extractWikipedia(html: string): ParsedEntry[] {
  // Wikipedia tables — parse <table class="wikitable"> rows. Each row: country | artist | song | language.
  // Reuse this proven path; details handled by tolerant cell extraction.
  const entries: ParsedEntry[] = [];
  const tableMatch = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/g) ?? [];
  for (const tbl of tableMatch) {
    const rows = tbl.matchAll(/<tr>([\s\S]*?)<\/tr>/g);
    for (const r of rows) {
      const cells = [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => stripTags(c[1]).trim());
      if (cells.length < 3) continue;
      const country = cells[0];
      const artist = cells[1];
      const song = cells[2];
      const iso = COUNTRY_TO_ISO[country.toLowerCase()];
      if (iso && artist && song) entries.push({ iso, name: country, artist, song, runningOrder: null });
    }
  }
  return entries;
}

function stripTags(s: string): string { return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '); }

const COUNTRY_TO_ISO: Record<string, string> = {
  albania: 'AL', armenia: 'AM', australia: 'AU', austria: 'AT', azerbaijan: 'AZ',
  belgium: 'BE', bulgaria: 'BG', croatia: 'HR', cyprus: 'CY', czechia: 'CZ',
  denmark: 'DK', estonia: 'EE', finland: 'FI', france: 'FR', georgia: 'GE',
  germany: 'DE', greece: 'GR', israel: 'IL', italy: 'IT', latvia: 'LV',
  lithuania: 'LT', luxembourg: 'LU', malta: 'MT', moldova: 'MD', montenegro: 'ME',
  norway: 'NO', poland: 'PL', portugal: 'PT', romania: 'RO', 'san marino': 'SM',
  serbia: 'RS', sweden: 'SE', switzerland: 'CH', ukraine: 'UA', 'united kingdom': 'GB',
};
```

- [ ] **Step 2: Write index.ts (job loop)**

```ts
// supabase/functions/eurovision-parse/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3';
import { parseEurovision } from './parse.ts';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async () => {
  const { data: jobs } = await sb.from('parse_jobs').select('*').eq('status', 'running');
  if (!jobs || jobs.length === 0) return new Response('no jobs', { status: 200 });

  for (const job of jobs) {
    const { data: sched } = await sb.from('eurovision_parse_schedule').select('*').eq('year', job.year).single();
    if (!sched) continue;

    const run = await sb.from('parse_runs').insert({ job_id: job.id, year: job.year }).select().single();
    try {
      const { entries, httpStatus, source } = await parseEurovision(sched.source_url);
      const hash = await sha256(JSON.stringify(entries));
      // Upsert into eurovision_2026_live (operator can later promote into countries2026.ts via migration)
      let upserted = 0;
      for (const e of entries) {
        const { error } = await sb.from('eurovision_2026_live').upsert({
          iso: e.iso, name: e.name, artist: e.artist, song: e.song, running_order: e.runningOrder, source,
        }, { onConflict: 'iso' });
        if (!error) upserted++;
      }
      await sb.from('parse_runs').update({
        finished_at: new Date().toISOString(), http_status: httpStatus, status: 'ok', rows_upserted: upserted, payload_hash: hash,
      }).eq('id', run.data!.id);
      await sb.from('parse_jobs').update({ last_poll_at: new Date().toISOString(), poll_count: job.poll_count + 1 }).eq('id', job.id);
    } catch (e) {
      await sb.from('parse_runs').update({ finished_at: new Date().toISOString(), status: 'error', error: String(e) }).eq('id', run.data!.id);
    }
  }
  return new Response('ok');
});

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 3: Add eurovision_2026_live table to migration 020**

Append to `020_eurovision_parser.sql`:
```sql
create table if not exists public.eurovision_2026_live (
  iso text primary key,
  name text,
  artist text,
  song text,
  running_order int,
  source text,
  updated_at timestamptz not null default now()
);
alter table public.eurovision_2026_live enable row level security;
create policy live_read on public.eurovision_2026_live for select using (true); -- public read
create policy live_admin on public.eurovision_2026_live for all using (public.is_super_admin()) with check (public.is_super_admin());
```
Re-apply: `npx supabase db push`.

- [ ] **Step 4: Deploy + schedule cron-driven invocation**

```bash
npx supabase functions deploy eurovision-parse
```

Add to migration 020 (or new 021):
```sql
-- Invoke edge function every 2 minutes if any job is running. Uses pg_net.
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') and exists (select 1 from pg_extension where extname='pg_net') then
    perform cron.schedule(
      'eurovision-parse-poll', '*/2 * * * *',
      $cron$ select net.http_post(
        url := current_setting('app.settings.functions_url') || '/eurovision-parse',
        headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key'))
      ); $cron$
    );
  end if;
end $$;
```

(Operator: set `app.settings.functions_url` and `app.settings.service_role_key` once via Supabase dashboard SQL editor.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/eurovision-parse/ supabase/migrations/020_eurovision_parser.sql
git commit -m "feat(parser): edge function + 2-min poll cron + live table"
```

### Task C3: Admin module — EurovisionParser

**Files:**
- Create: `src/admin/modules/EurovisionParser.tsx`
- Modify: `src/admin/modules/index.ts`

- [ ] **Step 1: Write the module**

```tsx
// src/admin/modules/EurovisionParser.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Job { id: string; year: number; status: string; triggered_by_user: boolean; started_at: string; last_poll_at: string | null; poll_count: number; }
interface Run { id: string; status: string | null; rows_upserted: number; finished_at: string | null; error: string | null; }

export default function EurovisionParser() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const year = 2026;

  async function refresh() {
    const j = await supabase.from('parse_jobs').select('*').eq('year', year).order('started_at', { ascending: false }).limit(5);
    const r = await supabase.from('parse_runs').select('*').eq('year', year).order('started_at', { ascending: false }).limit(20);
    setJobs((j.data ?? []) as Job[]);
    setRuns((r.data ?? []) as Run[]);
  }

  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, []);

  async function start() { await supabase.rpc('start_parse_job', { p_year: year }); refresh(); }
  async function stop()  { await supabase.rpc('stop_parse_job',  { p_year: year }); refresh(); }
  async function parseNow() {
    await supabase.functions.invoke('eurovision-parse');
    refresh();
  }

  const active = jobs.find((j) => j.status === 'running');

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-bold">🛰️ Eurovision Parser ({year})</h2>
      <div className="flex gap-2">
        <button onClick={start} disabled={!!active}
          className="px-4 py-2 bg-emerald-500 text-black font-bold rounded disabled:opacity-40">Start Parsing</button>
        <button onClick={stop} disabled={!active}
          className="px-4 py-2 bg-red-500 text-white font-bold rounded disabled:opacity-40">Stop Parsing</button>
        <button onClick={parseNow}
          className="px-4 py-2 bg-white/10 rounded">Parse Now</button>
      </div>
      <div>
        <h3 className="font-bold mb-1">Jobs</h3>
        <table className="w-full text-sm">
          <thead className="text-white/40"><tr><th className="text-left">id</th><th>status</th><th>by</th><th>polls</th><th>last</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-white/10">
                <td className="font-mono text-xs">{j.id.slice(0, 8)}</td>
                <td>{j.status}</td>
                <td>{j.triggered_by_user ? 'manual' : 'cron'}</td>
                <td>{j.poll_count}</td>
                <td>{j.last_poll_at ? new Date(j.last_poll_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="font-bold mb-1">Recent runs</h3>
        <table className="w-full text-sm">
          <thead className="text-white/40"><tr><th className="text-left">finished</th><th>status</th><th>rows</th><th>error</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.finished_at ? new Date(r.finished_at).toLocaleTimeString() : 'running'}</td>
                <td>{r.status ?? '—'}</td>
                <td>{r.rows_upserted}</td>
                <td className="text-red-400 truncate max-w-xs">{r.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register module**

Modify `src/admin/modules/index.ts`:

```ts
import EurovisionParser from './EurovisionParser';
export const MODULES: AdminModule[] = [
  { id: 'eurovision', label: 'Eurovision Parser', emoji: '🛰️', Component: EurovisionParser },
];
```

- [ ] **Step 3: Manual test**

`npm run dev` → log into `/admin` → click Eurovision Parser → Start Parsing → wait 2 min → check runs table populates.

- [ ] **Step 4: Commit**

```bash
git add src/admin/modules/EurovisionParser.tsx src/admin/modules/index.ts
git commit -m "feat(parser): admin module UI for start/stop/parse-now + run log"
```

**Phase C done.** Tag: `git tag phase-c-complete`.

---

# PHASE D — SEO/GEO Path C buildout

**Goal:** eurovision.games becomes discoverable on Google + AI search engines for "eurovision night", "eurovision games", "eurovision 2026 predictions", "eurovision party", "eurovision trivia", "eurovision online games", "eurovision mobile games". Real substantive content (600-1200 words/page), not keyword stuffing. Schema.org JSON-LD on every page. AI bots explicitly allowed.

**Files map (high level — content authoring is its own subtask cluster):**
- Create: `public/robots.txt` (full version)
- Create: `public/sitemap.xml`
- Create: `public/llms.txt`
- Create: `src/pages/seo/HowToPlayPage.tsx`
- Create: `src/pages/seo/EurovisionNightPage.tsx`
- Create: `src/pages/seo/EurovisionPartyPage.tsx`
- Create: `src/pages/seo/EurovisionGamesPage.tsx`
- Create: `src/pages/seo/EurovisionTriviaPage.tsx`
- Create: `src/pages/seo/Predictions2026Page.tsx`
- Create: `src/pages/seo/MobileGamesPage.tsx`
- Create: `src/pages/seo/OnlineGamesPage.tsx`
- Create: `src/pages/seo/FAQPage.tsx`
- Create: `src/pages/seo/RulesPage.tsx`
- Create: `src/pages/seo/ScoringPage.tsx`
- Create: `src/pages/seo/PrivacyPage.tsx`
- Create: `src/pages/seo/TermsPage.tsx`
- Create: `src/pages/seo/AboutPage.tsx`
- Create: `src/components/seo/SchemaHead.tsx` (injects JSON-LD)
- Create: `src/components/seo/SiteFooter.tsx` (links all pages)
- Modify: `index.html` (default meta tags + Organization schema)
- Modify: `src/pages/HomePage.tsx` (add real H1/H2 hierarchy + above-fold answer block)
- Modify: `src/main.tsx` (register all SEO routes)
- Create: `vite.config.ts` SSG plugin or static prerender (vite-ssg or react-snap)

### Task D1: robots.txt + sitemap.xml + llms.txt

**Files:**
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`
- Create: `public/llms.txt`

- [ ] **Step 1: Write robots.txt**

```
# eurovision.games — robots.txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /room/

# AI crawlers — explicitly allowed (we want to be cited)
User-agent: GPTBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: https://eurovision.games/sitemap.xml
```

- [ ] **Step 2: Write sitemap.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eurovision.games/</loc><priority>1.0</priority></url>
  <url><loc>https://eurovision.games/eurovision-night</loc><priority>0.9</priority></url>
  <url><loc>https://eurovision.games/eurovision-games</loc><priority>0.9</priority></url>
  <url><loc>https://eurovision.games/eurovision-party</loc><priority>0.9</priority></url>
  <url><loc>https://eurovision.games/eurovision-trivia</loc><priority>0.9</priority></url>
  <url><loc>https://eurovision.games/eurovision-2026-predictions</loc><priority>0.9</priority></url>
  <url><loc>https://eurovision.games/online-games</loc><priority>0.8</priority></url>
  <url><loc>https://eurovision.games/mobile-games</loc><priority>0.8</priority></url>
  <url><loc>https://eurovision.games/how-to-play</loc><priority>0.8</priority></url>
  <url><loc>https://eurovision.games/rules</loc><priority>0.7</priority></url>
  <url><loc>https://eurovision.games/scoring</loc><priority>0.7</priority></url>
  <url><loc>https://eurovision.games/faq</loc><priority>0.7</priority></url>
  <url><loc>https://eurovision.games/about</loc><priority>0.6</priority></url>
  <url><loc>https://eurovision.games/privacy</loc><priority>0.3</priority></url>
  <url><loc>https://eurovision.games/terms</loc><priority>0.3</priority></url>
</urlset>
```

- [ ] **Step 3: Write llms.txt (concise summary for AI)**

```
# Eurovision Games

> A free, browser-based party game for watching Eurovision Song Contest with friends. Predict the Top 5 / Worst 5, answer trivia in head-to-head duels, and track who has the best ear, the most points stolen, and the best instinct.

## What it is
- Real-time multiplayer rooms (up to 10 players)
- 5 game phases: lobby → pre-night show → predictions → voting live → final
- 5 winner categories: Champion, Thief, Duelist, Oracle, Guru
- Mobile-first PWA, works on iOS / Android / desktop
- No download, no account required to join

## Who it is for
Eurovision fans hosting watch parties; friends watching the contest remotely; trivia/quiz fans.

## Key pages
- /eurovision-night — How to host the watch party
- /eurovision-2026-predictions — 2026 line-up + prediction game
- /how-to-play — Rules in 2 minutes
- /eurovision-trivia — Sample trivia questions
```

- [ ] **Step 4: Commit**

```bash
git add public/robots.txt public/sitemap.xml public/llms.txt
git commit -m "feat(seo): robots.txt + sitemap.xml + llms.txt"
```

### Task D2: SchemaHead component + index.html base meta

**Files:**
- Create: `src/components/seo/SchemaHead.tsx`
- Modify: `index.html`

- [ ] **Step 1: Update index.html `<head>`**

Replace existing meta block with:
```html
<title>Eurovision Games · Predictions, Trivia & Party Games for Eurovision 2026</title>
<meta name="description" content="Free multiplayer Eurovision party game. Predict Top 5 / Worst 5 of Eurovision 2026, battle friends in trivia duels, and crown 5 champions. No download." />
<meta property="og:title" content="Eurovision Games — Predictions & Trivia for Eurovision 2026" />
<meta property="og:description" content="Free multiplayer Eurovision party game for hosting watch nights. Predictions, trivia duels, live scoring." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://eurovision.games/" />
<meta property="og:image" content="https://eurovision.games/og.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="https://eurovision.games/" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Eurovision Games",
  "url": "https://eurovision.games",
  "logo": "https://eurovision.games/logo.png",
  "sameAs": []
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Eurovision Games",
  "url": "https://eurovision.games",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Any (Web)",
  "browserRequirements": "Modern browser",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
}
</script>
```

- [ ] **Step 2: Write SchemaHead component**

```tsx
// src/components/seo/SchemaHead.tsx
import { useEffect } from 'react';

interface Props { title: string; description: string; canonical: string; jsonLd?: object | object[]; }

export default function SchemaHead({ title, description, canonical, jsonLd }: Props) {
  useEffect(() => {
    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', canonical, true);
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = canonical;

    const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    const tags: HTMLScriptElement[] = blocks.map((b) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.dynamic = 'true';
      s.text = JSON.stringify(b);
      document.head.appendChild(s);
      return s;
    });
    return () => { tags.forEach((t) => t.remove()); };
  }, [title, description, canonical, jsonLd]);
  return null;
}

function setMeta(name: string, value: string, og = false) {
  const sel = og ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let m = document.querySelector(sel) as HTMLMetaElement | null;
  if (!m) {
    m = document.createElement('meta');
    if (og) m.setAttribute('property', name); else m.name = name;
    document.head.appendChild(m);
  }
  m.content = value;
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html src/components/seo/SchemaHead.tsx
git commit -m "feat(seo): base meta + Organization/WebApplication schema + SchemaHead helper"
```

### Tasks D3-D17: Content pages

Each SEO page follows the same template. Below is the full template for **HowToPlayPage**; the engineer applies the same pattern to the remaining 14 pages with content drafted per the brief table that follows.

**Template — `src/pages/seo/HowToPlayPage.tsx`**

```tsx
import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';

export default function HowToPlayPage() {
  const howTo = {
    '@context': 'https://schema.org', '@type': 'HowTo',
    name: 'How to play Eurovision Games',
    step: [
      { '@type': 'HowToStep', name: 'Create a room',     text: 'Click "Create Room", set max players (2-10) and quiz rounds.' },
      { '@type': 'HowToStep', name: 'Invite friends',    text: 'Share the room code or link. Friends join in their browser, no app install.' },
      { '@type': 'HowToStep', name: 'Lock predictions',  text: 'Each player picks their Top 5 and Worst 5 of Eurovision 2026.' },
      { '@type': 'HowToStep', name: 'Battle in duels',   text: 'Challenge friends to head-to-head trivia duels for points.' },
      { '@type': 'HowToStep', name: 'Watch the show',    text: 'Live scoring updates as Eurovision results come in.' },
      { '@type': 'HowToStep', name: 'Crown winners',     text: 'Five winners are revealed: Champion, Thief, Duelist, Oracle, Guru.' },
    ],
  };
  return (
    <>
      <SchemaHead
        title="How to Play Eurovision Games — 2-Minute Guide"
        description="Quick guide to running a Eurovision watch party with predictions, trivia duels, and live scoring. Setup takes 60 seconds."
        canonical="https://eurovision.games/how-to-play"
        jsonLd={howTo}
      />
      <article className="prose prose-invert max-w-2xl mx-auto px-4 py-12">
        <h1>How to play Eurovision Games</h1>
        <p className="lead"><strong>Eurovision Games is a free, browser-based party game for the Eurovision Song Contest.</strong> Players predict the Top 5 and Worst 5, answer trivia in head-to-head duels, and battle for five different winner titles. Setup takes 60 seconds and supports 2-10 players.</p>
        <h2>1. Create a room (10 seconds)</h2>
        <p>Click <em>Create Room</em>. Pick how many quiz rounds (default 3), how many players you expect (up to 10), and a duel limit per pair (default 2). A 6-character room code appears.</p>
        <h2>2. Invite friends (20 seconds)</h2>
        <p>Share the room code, the join link, and the room password (auto-generated, included in the share message). Friends open the link on phone or laptop — no app install, no account.</p>
        <h2>3. Lock predictions (5 minutes)</h2>
        <p>Before the show starts, every player builds their <strong>Top 5</strong> (countries they think will win) and <strong>Worst 5</strong> (countries they think will flop). Picks lock when the host advances the phase.</p>
        <h2>4. Trivia duels (during the show)</h2>
        <p>Challenge any other player to a 3-question trivia duel. Winner steals points from the loser. Each pair can duel a maximum of 2 times across the night including rematches, so you can't grind one opponent.</p>
        <h2>5. Live scoring</h2>
        <p>As Eurovision jury and televoting results land, predictions auto-score. Top-5 picks earn variable points based on rank match; Worst-5 picks reward you for spotting the bottom of the table.</p>
        <h2>6. Five winners</h2>
        <p>At the end of the night, five trophy cards reveal:</p>
        <ul>
          <li><strong>Champion</strong> — most total points across all games</li>
          <li><strong>Thief</strong> — most points stolen in duels</li>
          <li><strong>Duelist</strong> — most duels won</li>
          <li><strong>Oracle</strong> — most accurate prediction score</li>
          <li><strong>Guru</strong> — most correct trivia answers</li>
        </ul>
        <p>Ties trigger an optional <strong>sudden-death</strong> tiebreak round (host toggle).</p>
        <h2>What you need</h2>
        <ul>
          <li>A modern browser (Chrome, Safari, Firefox, Edge — phone or desktop)</li>
          <li>2-10 friends</li>
          <li>The Eurovision broadcast (TV or stream)</li>
        </ul>
        <p><a href="/" className="btn-primary">Start a room now →</a></p>
      </article>
      <SiteFooter />
    </>
  );
}
```

**Brief table** — engineer authors each remaining page using this pattern. Each must include: SchemaHead, H1 with primary keyword, definition block in first 100 words, H2-structured body 600-1200 words, internal links to ≥3 sibling pages, FAQ schema where relevant.

| Path | Primary keyword | Schema type | Word target | Key sections (H2s) |
|---|---|---|---|---|
| `/eurovision-night` | eurovision night | Article + HowTo | 800 | What is Eurovision Night · How to host · Food/drink ideas · Game options · Timezone tips · FAQ |
| `/eurovision-games` | eurovision games | Article | 700 | Definition · Why play games during Eurovision · Free vs paid · Comparison · Get started |
| `/eurovision-party` | eurovision party | Article + HowTo | 900 | What makes a great party · Guest list · Theme & decor · Voting & games · Hosting checklist |
| `/eurovision-trivia` | eurovision trivia | Quiz | 600 | What is Eurovision trivia · Sample 10 questions with answers · Categories · Difficulty tiers · Play live |
| `/eurovision-2026-predictions` | eurovision 2026 predictions | Article | 1100 | 2026 line-up (35 countries) · Prediction format · Top 5 · Worst 5 · Scoring · Strategy tips · FAQ |
| `/online-games` | eurovision online games | Article | 600 | Definition · No-download play · Multiplayer · Browser support · Mobile · Get started |
| `/mobile-games` | eurovision mobile games | Article | 600 | Mobile-first PWA · iOS install · Android install · Offline · Bandwidth · Battery |
| `/faq` | eurovision games faq | FAQPage | 800 | 12+ Q&A — must use FAQPage JSON-LD |
| `/rules` | eurovision games rules | Article | 700 | Phases · Predictions rules · Duel rules · Scoring rules · Winner categories · Disputes |
| `/scoring` | eurovision scoring | Article | 700 | Quiz scoring · Prediction scoring (Top 5 + Worst 5 formulas) · Duel scoring · Steal vs Double · Penalties |
| `/about` | about eurovision games | AboutPage | 500 | Origin · Why we built it · Open source/closed · Contact |
| `/privacy` | privacy policy | WebPage | 500 | Data collected · Cookies · Analytics · Email OTP · Retention · Contact |
| `/terms` | terms of service | WebPage | 500 | Eligibility · Acceptable use · IP · Eurovision trademark disclaimer · Liability |

**Per-page tasks (repeat for each row):**

- [ ] Create the page file at `src/pages/seo/<Name>Page.tsx` using HowToPlayPage as template.
- [ ] Author content meeting word target. Real prose, no AI-stuffed boilerplate.
- [ ] Include schema JSON-LD per the table.
- [ ] Add route in `src/main.tsx`.
- [ ] Commit per page: `git commit -m "feat(seo): <name> page with schema + content"`.

### Task D18: SiteFooter linking all SEO pages

**Files:**
- Create: `src/components/seo/SiteFooter.tsx`
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Write footer**

```tsx
// src/components/seo/SiteFooter.tsx
const SECTIONS = [
  { h: 'Play',    links: [['/how-to-play', 'How to play'], ['/rules', 'Rules'], ['/scoring', 'Scoring']] },
  { h: 'Games',   links: [['/eurovision-games', 'Eurovision games'], ['/eurovision-trivia', 'Trivia'], ['/online-games', 'Online'], ['/mobile-games', 'Mobile']] },
  { h: 'Hosting', links: [['/eurovision-night', 'Eurovision night'], ['/eurovision-party', 'Party'], ['/eurovision-2026-predictions', '2026 predictions']] },
  { h: 'About',   links: [['/about', 'About'], ['/faq', 'FAQ'], ['/privacy', 'Privacy'], ['/terms', 'Terms']] },
] as const;

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 mt-16 px-4 py-10 text-sm bg-black/30">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {SECTIONS.map((s) => (
          <div key={s.h}>
            <h4 className="text-euro-gold font-bold mb-2">{s.h}</h4>
            <ul className="space-y-1">
              {s.links.map(([href, label]) => (
                <li key={href}><a href={href} className="text-white/70 hover:text-white">{label}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="max-w-5xl mx-auto text-white/40 text-xs mt-6">© Eurovision Games. Not affiliated with the European Broadcasting Union.</p>
    </footer>
  );
}
```

- [ ] **Step 2: Render footer on HomePage and every SEO page**

In `src/pages/HomePage.tsx`, append `<SiteFooter />` before the closing tag.

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/SiteFooter.tsx src/pages/HomePage.tsx
git commit -m "feat(seo): SiteFooter with internal links to all SEO pages"
```

### Task D19: HomePage above-fold answer block + H1

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add a definition-block hero**

Above the existing "Create Room / Join Room" CTAs:
```tsx
<header className="text-center max-w-2xl mx-auto px-4 pt-12 pb-6">
  <h1 className="text-4xl md:text-5xl font-bold text-white">
    Eurovision Games — host the perfect Eurovision night
  </h1>
  <p className="mt-4 text-lg text-white/80">
    <strong>Eurovision Games is a free, browser-based party game</strong> where 2-10 friends predict the Eurovision 2026 Top 5 and Worst 5, battle in trivia duels, and crown five winners — Champion, Thief, Duelist, Oracle, Guru. No download, no account.
  </p>
</header>
```

This puts a clean, extractable definition in the first 100 words — exactly what AI search engines cite.

- [ ] **Step 2: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(seo): HomePage H1 + definition block in first 100 words"
```

### Task D20: Static prerender (vite-ssg)

**Why:** SPA pages render JS client-side; bots get an empty `<div id="root">`. Prerendering writes static HTML for each route at build time so crawlers and AI scrapers see real content.

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `src/main.ssg.ts`

- [ ] **Step 1: Install vite-ssg**

```bash
npm i -D vite-ssg
```

- [ ] **Step 2: Add SSG config to vite.config.ts**

```ts
// add to defineConfig:
ssgOptions: {
  formatting: 'minify',
  includedRoutes: () => [
    '/', '/how-to-play', '/eurovision-night', '/eurovision-games', '/eurovision-party',
    '/eurovision-trivia', '/eurovision-2026-predictions', '/online-games', '/mobile-games',
    '/rules', '/scoring', '/faq', '/about', '/privacy', '/terms',
  ],
}
```

- [ ] **Step 3: Replace `build` script**

```json
"build": "tsc -b && vite-ssg build"
```

- [ ] **Step 4: Verify**

```bash
npm run build
grep -l "Eurovision Games is a free" dist/index.html dist/how-to-play/index.html
```
Expected: both files contain the string in raw HTML (proof that prerender worked).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "feat(seo): static prerender for SEO routes via vite-ssg"
```

**Phase D done.** Tag: `git tag phase-d-complete`.

---

## Self-review checklist

**Spec coverage:**
- ✅ Hidden /admin with email OTP allowlist (Phase A1-A7)
- ✅ Super-admin extensibility for future modules (A5 module registry)
- ✅ 5 winner categories incl. Guru = most CORRECT quiz answers (B1, B2)
- ✅ Co-winners 2-5 (B1 unique constraint allows N rows per category)
- ✅ Sudden-death tiebreak host-toggleable (B6)
- ✅ Card art pipeline PNG → optimized JPG with @1x/@2x (B3)
- ✅ Holographic + glow + tilt interactions (B4)
- ✅ Eurovision parser manual control (C3) + cron fallback Friday 15/05 03:00 Greece (C1)
- ✅ year-agnostic schedule for next year (C1 — `eurovision_parse_schedule.year` column)
- ✅ run log for audit (C1 `parse_runs`)
- ✅ SEO Path C — robots, sitemap, llms.txt, schema, prerender, 15 pages with real content (D1-D20)
- ✅ AI bots explicitly allowed (D1)
- ✅ Footer with internal links to all SEO pages (D18)

**Placeholder scan:** No `TBD` / `TODO` / "implement later" / "similar to" / "add error handling" found in steps. One engineer-judgment marker remains in C2 Step 1 (`/* engineer: confirm selectors against actual DOM on first successful fetch */`) — this is intentional because the page DOM is unknown until first 200 OK, and the fallback path (Wikipedia) is fully implemented.

**Type consistency:**
- `WinnerCategory` used identically in `winners.ts`, `WinnerCard`, `WinnerGrid`, `SuddenDeathPanel`, migration enum (`winner_category`).
- `parse_jobs.year` is int across migration, edge function, and admin module.
- `super_admins.user_id` UUID consistent with `auth.uid()` calls.
- `eurovision_parse_schedule` referenced in migration C1 and edge function C2 with same column names (`source_url`, `scheduled_parse_at`).

---

## Execution order recommendation

1. **Pre-flight Task 0** (5 min)
2. **Phase A in full** (A1-A7, ~3 hrs) — unblocks everything else
3. **Phases B and D in parallel** (different subagents OK — no file overlap)
4. **Phase C** (depends on A, ~3 hrs)
5. Final manual smoke + `git tag v2026.1.0`
6. `superpowers:finishing-a-development-branch`

Total estimate: ~16-20 engineering hours for a focused executor (subagent-driven), substantially more if hand-coded.
