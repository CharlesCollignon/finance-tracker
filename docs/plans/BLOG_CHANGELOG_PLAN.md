# Nouveautés et Le blog

October 2026. Pluclair is online and the owner wants the site and the apps to
feel alive: a changelog of what ships, « super friendly », in a Framer /
Awwwards style, and a blog where the owner publishes practical guides and where
signed-in users post, ask and answer one another. Decided in one session on
2026-10-12.

One branch per phase, one concern per commit, every gate in
`.github/workflows/ci.yml` green at each commit; the owner merges. Each phase
updates `docs/how-pluclair-works.md`, `CONTEXT.md`, `apps/web/PRODUCT.md` and
both `DESIGN.md` files wherever it changes what they say. Every new motion is
written into the Motion section of `apps/web/DESIGN.md`, as the about page's
was.

## Standing rule: « Nouveautés » is never behind

Decided 2026-10-12, after Phase 1 shipped. Every change that reaches `main`
and that someone using Pluclair can see adds its entry to
`packages/core/src/changelog-entries.ts` in the same branch, before the
merge, dated the day it lands; `node scripts/changelog-draft.mjs` lists what
has landed since the newest entry, and `--stats` updates the figures the
page states. A change nobody can see says so with a `Changelog: none` line
in a commit or in the merge message.

Held three ways: the rule in `AGENTS.md`, which every agent session reads;
this section; and a Claude Code hook in `.claude/settings.json`
(`scripts/changelog-guard.mjs`) that refuses a merge into `main`, or a push
of `main`, touching the apps, the shared packages or the migrations without
an entry or a `Changelog:` line. The hook only sees what Claude Code runs; a
merge made by hand is held by the rule alone.

## What is there today

- **The marketing site** (`app/(marketing)`: `/`, `/features/[slug]`,
  `/a-propos`, legal pages) is one dark surface with Lenis smooth scroll,
  `motion/react` reveals (`LandingReveal.tsx`: `RiseWords`, `FadeUp`), glass
  panels and a fixed ambient bed. The nav is one glass pill that grows its own
  panel (`LandingHeader.tsx`).
- **A changelog in miniature already exists**: the about page's « Run »
  (`about/Run.tsx`), a line the scroll draws through eight dated stops. The
  history for a real one is there too: 917 commits since 15 June, 106 merged
  branches since September (88 in October alone), all in English and in code
  terms, so none of it can be shown as it is.
- **No `sitemap.ts`, no `robots.ts`, no Open Graph images.** A blog needs all
  three to be found.
- **The phone is handed out as an APK** (`/android`) with no store and no
  `expo-updates`. Someone who installs it never hears there is a newer one
  unless the app tells them, and `apps/mobile/app.json` is still `1.0.0`.
- **Names taken**: « Journal » is the ledger, « Questions » is Ask Pluclair.
- **Copy rules** (`landing-copy.ts`, `about-copy.ts`): only what is true and
  checkable, French first, no advice, « gratuit » said exactly.
- **Legal pages** 404 in production while `LEGAL_DRAFT` is true
  (`components/marketing/legal-status.ts`).

## Decisions taken (2026-10-12)

- **The changelog is « Nouveautés »**, at `/nouveautes`, and also inside the
  web app and on the phone.
- **Readers act on it**: a reaction on each shipped entry, and a vote
  (« J'attends ça ») on each « Bientôt » item.
- **The blog is « Le blog »**, at `/blog`, with two parts: **Guides**, practical
  explainers the owner publishes (I draft, the owner edits), and **Entraide**,
  where a signed-in user posts, asks, and others answer.
- Not chosen: behind-the-scenes notes and a monthly money report. The owner can
  still post in Entraide as Pluclair.

## Assumed — to confirm before the phase that needs it

1. **Entraide is read by anyone, written by an account.** Threads are public
   and indexed (that is most of the "life" and the search traffic); posting,
   answering, reacting and voting need to be signed in.
2. **Pseudonyms.** A handle chosen at the first post; never a name or an email.
3. **Moderation after the fact.** A post appears at once; anyone signed in can
   report it; the owner hides or restores from a queue; three distinct reports
   hide a post until the owner looks. (Instead: hold each account's first post
   for review.)
4. **Commitment 3 of PRODUCT.md** (« It does not tell the user what to do »)
   stays binding on Pluclair's own voice (guides, the owner's answers marked
   « Pluclair »); members' answers are labelled as members' views, not
   Pluclair's advice. This changes a documented principle, so it needs the
   owner's yes.
5. **No karma.** Reaction counts on entries and answers, but no reputation,
   points, levels or leaderboard: the landing's « Aucun score » stays true.
6. **Guides in French only.** An English reader gets the French text with one
   line saying so. Nouveautés is bilingual (entries are short).
7. **Entraide on the web first.** The phone links to it; a native Entraide is
   the last phase.
8. **Deleting an account** replaces its posts and answers with « Message
   supprimé », so threads stay readable.
9. **A `news` push**, for « À la une » entries only, at most one a week, quiet
   hours honoured, its own switch in Profile.

## The shared direction

Both pages live in the marketing shell, so they inherit its dark room, glass,
Lenis scroll and nav. The guard-rails are DESIGN.md's: one easing curve beside
springs, gold on the figure, the three marketing greys, no confetti, and under
reduced motion every section stands at its final state with nothing playing.
Built with the Hallmark skill, as the about page was.

Signatures to reuse rather than reinvent: `RiseWords` headings, the promise's
word-by-word lighting, the Journal's re-dealt list (`AnimatedDays.tsx`), the
tabs' sliding pill, the cards' pointer light, the figure face's rolling digits,
the « Bêta ouverte » live ring (`.about-live`), and the existing app mocks
(`components/marketing/mocks`, `feature/demos`).

## Phase 0 — Groundwork (branch `site-groundwork`) — merged 2026-10-12

- `app/sitemap.ts` (landing, feature pages, about, legal when visible, then
  Nouveautés entries and blog pages as they arrive) and `app/robots.ts`.
- One Open Graph card (`next/og`, the site's own Instrument Sans as static
  TTFs instanced from the woff2 in `app/fonts`, which `next/og` cannot read):
  the dark room, the orb rising, a title. Drawn for the landing, the about
  page and each feature page, which also get their own `og:` titles.
- Not here, because the reachability gate fails on code nothing reaches yet:
  the RSS helper comes with the first feed (Phase 1), and each nav entry with
  its page.

## Phase 1 — Nouveautés, the page (branch `nouveautes-page`) — merged 2026-10-12

Built as planned, with these differences: 58 entries (the backfill runs
from 15 June); the hero's figures are entries listed and commits, and
beside them a strip of one bar per week since the first commit, which takes
the list to a week when pressed; most entries are ruled rows and only the
featured ones glass cards; the « new since your visit » marker is the status
green, not gold (DESIGN.md's Rare Accent Rule: nothing here is a figure or a
moment). The landing's « Bientôt » now reads `ROADMAP`, so in production it
shows the blog, Entraide and the stores. Checked in a component harness
with headless Chromium at 1440, 375 and 320 px and under reduced motion; not
yet on a Vercel preview.

**Data**, in `packages/core/src/changelog.ts`, so the web and the phone read
the same list:

```ts
interface ChangelogEntry {
  id: string;                      // stable: reactions key on it
  date: string;                    // ISO, the day it reached main
  kind: "new" | "better" | "fixed";
  platforms: ("web" | "phone")[];
  area: LandingPageId | "app";     // icon, and the feature page it links to
  featured?: boolean;              // « À la une »: a wide card with a live mock
  demo?: DemoId;                   // which existing mock plays in its card
  apk?: string;                    // the APK version that carries it
  href?: string;                   // feature page or guide that explains it
  fr: { title: string; body: string; detail?: string };
  en: { title: string; body: string; detail?: string };
}
```

The « Bientôt » items move into the same module and the landing's « Bientôt »
reads them, so the two never drift. Tests: unique ids, dates descending and
never in the future, both languages filled, a demo for every featured entry,
APK versions increasing.

**Writing them.** `scripts/changelog-draft.mjs` prints the merges since the
newest entry with their commits, and the totals (commits, merges) the page
shows, written into the data file rather than counted at build (Vercel clones
shallow). From now on, a branch that changes what a user sees adds its entry,
dated on merge. **Backfill**: June to August as a handful of « Les débuts »
entries matching the about page's run; September and October as about forty
entries curated from the 106 merges, fixes grouped.

**The page:**

- **Hero.** « Nouveautés » rises out of a mask; beside it the live ring and
  « Mis à jour il y a 2 jours »; three figures roll in the figure face:
  changes shipped, weeks running, the current APK version.
- **« Depuis votre dernière visite ».** A chip counting entries newer than the
  last one seen (`localStorage` for a visitor; the account's own value once
  signed in, Phase 3). Tapping it scrolls to the first; each of those entries
  carries a gold hairline that fades once it has been on screen a moment.
- **Filters**, sticky under the nav pill: Tout · Nouveau · Amélioré · Corrigé,
  and Web · Téléphone. The pill slides on the tabs' spring and the list is
  re-dealt with the Journal's choreography (stayers slide, leavers fade,
  arrivals rise a beat apart, capped at eight).
- **The river.** Entries grouped by week. A sticky month marker on the left
  rolls its name (« Octobre » to « Septembre ») as the page crosses a month.
  Featured entries are wide glass cards whose mock plays only while in view;
  others are compact rows; a week's fixes fold into « 3 corrections ».
- **Opening an entry.** The card grows into a panel in place (shared layout),
  with the longer text, its platforms, the link to the feature page or guide
  and its reactions. `/nouveautes/[id]` opens the page on that entry, with its
  own OG image, so one change can be shared.
- **« Bientôt »** closes the page: the coming items as cards (votes in
  Phase 2), then RSS.
- **On the landing**, a pill under the hero: live dot, « Nouveau », the latest
  featured entry's title, linking to it.

## Phase 2 — Reactions and votes (branch `nouveautes-reactions`) — merged 2026-10-12

Built as below, on the site and on the phone's `nouveautes` screen, with
migration 070 for the owner to run. Signing in from a reaction now comes
back to the change (`?next=` on all three sign-ins). Icons: a heart, a
thumb, clapping hands (sparkles on the phone), an hourglass for the vote.

- **Three reactions**, drawn icons rather than emoji: « J'adore », « Utile »,
  « Enfin ! ». One of each per account per entry, a toggle. **One vote**,
  « J'attends ça », per « Bientôt » item. The list keeps the owner's order;
  votes do not sort it.
- **Signed in to act, counts for everyone.** A visitor's tap opens a small
  popover « Connectez-vous pour réagir » that returns to the entry after
  login. A count of zero shows the icon alone.
- **One table for everything that is reacted to** (Entraide reuses it):
  `reactions(target text, user_id, kind, created_at)`, primary key on all
  three, `target` such as `changelog:<id>`, `roadmap:<id>`, later
  `post:<uuid>`. RLS: insert and delete one's own; raw rows never readable by
  others. Counts through a security-definer function taking a list of
  targets, so no user id leaves the database. A trigger caps reactions per
  account per hour.
- **The tap.** The icon pops on the spring, the count rolls, the write is
  optimistic and rolled back with a toast if it fails. The page stays static;
  counts and one's own reactions load on the client.

## Phase 3 — Nouveautés in the apps (branch `nouveautes-in-app`) — merged 2026-10-12

Built with two changes from below: the web's « Nouveautés » row opens the
public page rather than a sheet (one place to read, and reading it clears
the dot), and the `news` push waits for assumption 9 to be confirmed. The
dot is the status green, not gold. Migration 069 was run on the hosted
database by the owner on 2026-10-12. A release is one command,
`node scripts/release-android.mjs`: version, EAS build, GitHub release;
the site reads the version from the release's tag (`docs/store/README.md`).

- **Seen, once for both apps**: `user_preferences.changelog_seen` (the newest
  entry id read), so reading on the phone clears the web's dot.
- **A public feed**: `/nouveautes/feed.json` (static, cached), with the
  entries, the « Bientôt » items and the latest APK version and link. The
  phone reads it, so an old APK still sees new entries.
- **Web app**: a gold dot on Profile in the nav (through the existing nav
  badges) while something is unseen; a « Nouveautés » row in Profile opens a
  sheet of what is new since the last visit, with reactions; « Tout voir »
  goes to `/nouveautes`.
- **Phone**: the same row and dot in Profile. After an update (installed
  version newer than the last launched one), « Quoi de neuf » once: the
  entries carried by that APK as cards rising in turn (Reanimated), swiped
  through, with a haptic on each. **New version banner**: when the feed's APK
  is newer than the installed one, a dismissible banner on Le point,
  « Une nouvelle version est disponible », opening `/android`. This needs the
  APK's `version` and `versionCode` bumped at every build, written into
  `docs/store/README.md`.
- The `news` push kind (assumption 9) in `notification-kinds.ts`.

## Phase 4 — Le blog: Guides (branch `blog-guides`) — built, waiting on the owner

Built with these differences from below. No remark plugin was needed. With
three guides, the index has no rubrique chips or search yet (they come when
there are enough to look through), and every cover is CSS, WebGL for none.
Reading progress is not in the nav pill, in gold: it is a line beside the
contents on a desktop and a hairline across the top on a phone, in ink, as a
guide read is not a figure or a moment. Headings do not rise and no sentence
is lit word by word; the text holds still. The kit became `<Steps>`,
`<Aside>`, `<Term>`, `<Calc>` (a worked sum, for `<Figure>`), `<Envelopes>`
(a table, cards on a phone, for `<Compare>`), `<InPluclair>` (where it is in
the app, for `<Mock>`) and `<Sources>`. « Une question ? » writes to the
feedback address until Entraide opens. The second guide is « Le bilan du
mois : ce que le solde de la banque révèle ». The PEA guide's rules were read
on service-public.gouv.fr on 2026-10-13, and each guide waits for the
owner's edit. « Le blog » is in the menu sheet, the footer and, at the
owner's word on 2026-10-13, the desktop pill from the xl width up, beside
« Nouveautés »: the links a little closer, and the tightened pill 58rem.

- **Content in the repository** as MDX: `@next/mdx`, one file per guide under
  `apps/web/content/guides/`, each exporting its `metadata` (title,
  description, date, updated, rubrique, cover seed); loaded by dynamic import
  with `generateStaticParams` and `dynamicParams = false`; remark plugins
  passed by name for Turbopack (see `node_modules/next/dist/docs/01-app/02-guides/mdx.md`).
  Versioned, free, reviewed like code.
- **`/blog`**: two doors, Guides and Entraide (Phase 5). The latest guide large
  with its cover; covers drawn per guide from its seed (a still of the gold
  orb and aurora, CSS and SVG; WebGL only for the large one); an uneven grid
  of cards with the pointer light; rubrique chips on the sliding pill; a
  search over titles and summaries.
- **A guide**: the nav pill's outline fills in gold as it is read (reading
  progress folded into the existing nav); a table of contents in the margin
  on desktop with the current section's line growing; headings rise; one key
  sentence lit word by word. An MDX kit: `<Figure>` (rolls in the figure
  face), `<Steps>`, `<Mock>` (an app mock), `<Compare>`, `<Aside>` (a margin
  note), `<Term>` (a glass popover: PEA, CTO, débit différé). It ends on the
  next guide, and « Une question ? Posez-la dans Entraide » (prefilled once
  Phase 5 is there).
- **Rules**: explanation, never advice; every figure sourced, dated and
  linked (« à jour le … »); legal facts checked. Per guide: OG image,
  JSON-LD `Article`, sitemap, RSS.
- **Three guides to open with**, drafted by me, edited by the owner:
  « Le jour de lecture : pourquoi votre mois ne finit pas le 31 »,
  « Clore son mois : ce que le solde de la banque révèle »,
  « PEA, CTO, assurance-vie, PER : ce qu'est chaque enveloppe ».

## Phase 5 — Le blog: Entraide

Publishing what users write makes Pluclair a host of other people's content,
with duties that do not apply today. The rules come first and Entraide stays
behind a flag until they are signed.

### 5a — The rules (branch `entraide-rules`)

- **« Les règles d'Entraide »**, a page: be kind; no personal data (IBAN,
  account numbers, address); no promotion, referral codes or sponsored links;
  no soliciting money or investments; nothing illegal. Answers are members'
  views, not advice from Pluclair.
- **Terms**: a user-content section (the licence to show it, the right to hide
  it, the author's responsibility), the report mechanism and the reasons given
  when something is hidden (Digital Services Act, arts. 16 and 17, which apply
  to every host however small), Pluclair's status as host (LCEN).
- **Privacy policy**: handles, public posts, retention, what deletion does.
- **For the lawyer the owner plans to see**: the identification data a host
  must keep about who posted (LCEN art. 6 and its 2021 decree), and whether
  the platform-level DSA duties' small-business exemption applies to a private
  individual.
- Entraide opens in production only once `LEGAL_DRAFT` is false.

### 5b — Posting and answering (branch `entraide`)

- **Data**: `community_profiles(user_id, handle unique, banned_at)`;
  `posts(id, author_id, kind 'question' | 'share', title, body, guide_slug,
  status 'visible' | 'hidden' | 'deleted', solved_reply_id, created_at,
  edited_at, search tsvector 'french')`; `replies(id, post_id, author_id,
  body, status, created_at, edited_at)`; `reactions` from Phase 2 (« Utile »,
  « Merci »); `reports(id, target, reporter_id, reason, note, created_at,
  resolved_at, outcome)`. RLS: visible rows readable by anyone; authors write
  and soft-delete their own; moderation only through server actions behind a
  `community.moderate` flag.
- **Limits**: posts and replies per account per day (trigger); no links from
  an account younger than a day; links rendered `rel="ugc nofollow noopener"`;
  a length cap. Signup protection (Turnstile on Supabase Auth) if spam
  appears.
- **Text**: the Ask Markdown subset (`packages/core/src/ask-markdown.ts`)
  plus links. Before saving, a core function masks IBANs, card numbers, emails
  and phone numbers, and the preview tells the writer what it masked (tested).
- **Pages**: `/blog/entraide` (Toutes · Sans réponse · Résolues · Partages;
  Récentes · Les plus utiles), `/blog/entraide/[id]-[slug]` (a thread).
- **The interactions**: a pill « Posez votre question… » grows into the editor
  in place; while the title is typed, « Déjà demandé ? » slides in the
  matching threads and guides (Postgres full-text search, French); a live
  preview; on posting, the new card flies to the top of the list. Replies
  arrive on the spring. The asker marks one answer « Résolu »: a check draws
  itself, the answer slides up under the question, the thread's badge turns
  gold. Reactions as in Phase 2. Everything optimistic, rolled back with a
  toast.
- The owner's account carries a « Pluclair » badge.
- **Notifications**: a `community` kind (an answer to my post, my answer
  marked resolved), in the app and as a push, on by default.

### 5c — Moderation (branch `entraide-moderation`)

- « Signaler » on every post and answer, with a reason.
- The owner's queue, `/blog/entraide/moderation`, behind the flag: hide or
  restore with a reason sent to the author, ban a handle. A push to the owner
  on each report. Three distinct reports hide a post until reviewed.
- Account deletion handles posts and answers (assumption 8).

## Phase 6 — Entraide on the phone (later)

Read, post, answer and react natively, with the same rules and the same
tables. Until then, a « Le blog » row in Profile opens the web page.

## Order and size

| Phase | What | Size |
| --- | --- | --- |
| 0 | Groundwork: sitemap, robots, OG, RSS, nav | S |
| 1 | Nouveautés: data, backfill, page | L |
| 3 | Nouveautés in the apps, new-APK banner | M |
| 2 | Reactions and votes | M |
| 4 | Guides | M–L |
| 5a–c | Entraide: rules, posting, moderation | XL |
| 6 | Entraide on the phone | L |

Phase 3 before Phase 2: APK users need to hear about new versions now; the
reactions can follow. Phases 0 and 1 are visible first and need no database.

## How it is checked

Vitest for the data module, the masking, the counts function and the RLS
(against the local Supabase). Visuals on the Vercel branch previews with
headless Playwright, not a local `next dev` (this machine runs out of memory;
see the session notes). Reduced motion checked on every page.

## The owner's part

- Read the backfilled entries and edit the guides' drafts.
- Answer the assumptions above, Phase 5's before it starts.
- Bump the APK version at each build.
- Sign off the rules, terms and privacy text, and see the lawyer about hosting.
- Give a moderation habit: how quickly a report is looked at.
- The Vercel preview bypass secret for the visual checks.

## Open points

- Whether an entry can carry a short screen recording instead of a live mock
  (heavier, but closer to the real app).
- Whether a « Bientôt » item that ships should keep its votes on the entry
  that delivers it.
