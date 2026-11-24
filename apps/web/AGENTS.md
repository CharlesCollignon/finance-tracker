# The web app (`apps/web`)

Next.js 16 App Router, React 19, Tailwind 4, deployed on Vercel (`cdg1`).
Read `node_modules/next/dist/docs/` before using a Next API: this version
differs from older training data. The root `AGENTS.md` applies too.

## Shape

| Folder                  | What                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| `app/(app)/`            | Signed-in screens. Server components read Supabase with the cookie session.  |
| `app/(auth)/`           | Sign in, sign up, password reset, joining a shared space.                    |
| `app/(marketing)/`      | The public site: landing, blog, Entraide, Nouveautés, legal, download pages. |
| `app/api/`              | Bearer routes for the phone, crons, webhooks.                                |
| `lib/actions/`          | Server actions, one file per area, all through `asUser` / `asOwner`.         |
| `lib/queries/`          | Server reads used by pages.                                                  |
| `components/finance/`   | The app's screens and blocks.                                                |
| `components/marketing/` | The site. Its copy lives beside it (`*-copy.ts` / `*-copy.fr.ts`).           |
| `content/guides/`       | « Le blog » guides in MDX. List a new one in `lib/guide-list.ts`.            |
| `proxy.ts`              | Next 16's middleware: session refresh and route protection.                  |

Which page shows what, and which modules and tables each one uses, is in
`docs/feature-map.md`.

## Writes

- A write is a server action in `lib/actions/<area>.ts` that calls
  `@finance/data` through `asUser` (the signed-in person) or `asOwner` (the
  space they are looking at). It returns `ActionResult` and ends in
  `revalidateApp()`, which redraws every `(app)` page.
- When the phone needs the same write with a server secret, put the body in
  a shared `lib/<area>/…` module. Call it from both the action and a bearer
  route in `app/api/`, so there is one implementation (see
  `lib/entraide-write.ts`, `lib/wallet-read/write.ts`).
- Errors shown to people are catalogue keys or sentences already in their
  words. Use `dbError` (`@finance/data/errors`); Postgres' English never
  reaches a toast.
- A web delete removes its row at once (`useOptimistic`) and gives an Undo
  toast (`use-deleted-toast.ts`).

## Rules learned here

- **The server/client boundary is only checked when a module runs**, not by
  tsc or lint. Keep anything a server component imports out of modules that
  load icons, hooks or `createContext` (`lib/navigation.ts` loads icons; nav
  badges live in `lib/nav-badges.ts` for that reason). After touching a
  layout or the shell, load a page before calling it done.
- **Fonts are self-hosted** with `next/font/local` (`app/fonts/`). Don't
  bring back `next/font/google`: it broke production builds
  ([0027](../../docs/decisions/0027-self-hosted-fonts.md)).
- **No shadows.** Every `--shadow-*` is `none`, and with Tailwind 4 a
  `shadow-*` class also wipes the focus ring. `lib/no-shadows.test.ts` guards
  it.
- **Arrivals fade:** `fade-in` / `fade-out` classes or `FADE`
  (`components/motion/fade.ts`), and `useFadePresence` for sheets and menus.
- **Designs** are a `data-design` attribute on `<html>` (cookie `pc-design`).
  Blocks carry tag classes (`surface-card`, `list-row`, `stat-hero`,
  `position-tile`, `ledger-*`, `cal-*`…) styled per design in
  `app/globals.css` under `:root[data-design=…]`. Give a new block its tag
  rather than styling it per design inline. The phone's palettes are held to
  the CSS by `@finance/core` `design-parity.test.ts`.
- **Entry sheets** are built on `components/finance/sheet/entry-sheet.tsx`.
- **The site and the app don't share backgrounds or motion.** Marketing
  pages sit inside `.marketing-shell`. A design never applies there.
- **Legal switches** (`components/marketing/legal-status.ts`) publish legal
  commitments. Only the owner flips them.
- **The site's French copy (`*-copy.fr.ts`) holds no-break spaces** before
  « : », « ; » and « ? » (U+00A0), and plain spaces inside guillemets. A
  search-and-replace typed with ordinary spaces finds nothing: match on a
  shorter stretch, or write the no-break space explicitly.
- **A stale `.next/types/validator.ts` fails `tsc`** after a route is moved
  or removed. `npx next typegen` (from `apps/web`) rewrites it without a
  build.
- **Links to `/signup` and `/login` are never prefetched**, or the demo
  signs its visitors out.
- **Crons** check `CRON_SECRET` (Vercel sends it as a bearer token) and run
  under the service role. A cron is declared in `vercel.json` and documented
  in `docs/operations.md`.

## Checking it

`apps/web/.env.local` points at the **hosted** database. Never sign in with
a real account or write test data through it. Ways to see a change are in
the root `AGENTS.md` « This machine ». The cheapest after a deploy is
`https://pluclair.com/demo`. Before that, use a component harness or the
branch's Vercel preview.
