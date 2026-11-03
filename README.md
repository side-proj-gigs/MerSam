# MerSam

A full-stack web application for MerSam Water Systems and Plumbing Services: a public marketing
site, an office dashboard, invoicing, work completion reports and shareable staff cards.

Built with Next.js 16 (App Router), TypeScript, Postgres on Neon, Drizzle ORM and Tailwind CSS v4,
laid out in Clean Architecture.

---

## Getting started

```bash
npm install
cp .env.example .env     # then fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate       # create the schema
npm run db:seed          # services, content, settings and two worked examples
npm run dev              # http://localhost:3000
```

Sign in to the dashboard at `/admin/login` with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string, used at runtime |
| `DATABASE_URL_UNPOOLED` | yes | Direct connection, used for migrations (the pooler does not support the advisory locks the migrator takes) |
| `AUTH_SECRET` | yes | Signs session tokens. 32 characters or more in production |
| `SESSION_TTL_HOURS` | no | Session lifetime, default 12 |
| `NEXT_PUBLIC_SITE_URL` | yes in production | Absolute site address. **Staff card QR codes encode this**, so a wrong value produces codes that point at the wrong host |
| `STORAGE_DRIVER` | no | `s3` for Neon object storage, `local` to keep uploads in Postgres |
| `S3_*` | if `STORAGE_DRIVER=s3` | Endpoint, bucket, region and credentials |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | no | Owner account created by the seed |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript across the whole project |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a production build |
| `npm run qa:reset` | Removes the records the test suite creates, keeping the seeded examples |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed content. Safe to re-run; it upserts |

---

## What is in here

### Public site
Home, services index and 13 service detail pages, projects index and detail, about, FAQ and
contact. Everything on these pages comes from the database and is editable in the dashboard.
Service and project pages are statically generated and revalidated every five minutes.

### Office dashboard (`/admin`)
- **Enquiries** from the public quote form, with status, notes and one-click conversion to a client
- **Clients** and **Jobs**
- **Invoices**: line items, discounts, VAT, payments, PDF and Word export
- **Work reports**: the numbered completion and payment report, PDF and Word export
- **Services**, **Content** (testimonials, projects, FAQs), **Media**, **Settings**
- **Team**: accounts, roles and each person's digital business card

### Digital business cards (`/card/<slug>`)
Each member of staff can be given a shareable card carrying their photograph, role, contact
details and specialities. It offers a one-tap vCard download, and generates:

- a branded QR code in three themes, and
- a phone lock-screen wallpaper with the code in the middle.

Both are drawn from the raw QR matrix so they carry the brand without becoming unreadable. See
`docs/ARCHITECTURE.md` for why the finder patterns look the way they do.

---

## Architecture

```
src/
  core/            Entities, value objects and domain rules. No framework imports.
  application/     Use cases and the ports they depend on. No framework imports.
  infrastructure/  Drizzle repositories, auth, documents, QR, storage, container.
  presentation/    HTTP concerns: responses, sessions, idempotency, validation.
  app/             Next.js routes. Thin: parse, call a use case, respond.
  components/      UI. `ui/` primitives, `site/` public, `admin/` dashboard, `card/`.
```

The dependency rule points inwards: `app` and `components` may use `presentation`, which uses
`application`, which uses `core`. `infrastructure` implements the ports `application` declares and
is wired to them in one place, `infrastructure/container.ts`.

Full detail, including the non-obvious decisions and the bugs found while testing, is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). A record of what was built and verified is in
[`docs/PROGRESS.md`](docs/PROGRESS.md).

---

## Cross-cutting concerns

| Concern | Where it lives |
|---|---|
| State management | React Query for server state, React state for UI state, `useLocalStorage` for drafts |
| Caching | Read-through in-process cache on public content, invalidated on every admin write; ISR on public pages; immutable cache headers on uploaded media |
| Optimised API calls | Paged and filtered server side, `keepPreviousData` so lists never collapse, one bundled query for the home page instead of a waterfall |
| Lazy loading | Route-level code splitting, `next/image` lazy below the fold, `IntersectionObserver` for reveals and count-ups |
| Debouncing | 350ms on every admin search, coalesced scroll handlers via `requestAnimationFrame` |
| Idempotency | `Idempotency-Key` on every create, backed by a unique index. Plus a content-hash duplicate guard on the public enquiry form |
| Clean Architecture | The layering above, with ports in `application/ports` |

---

## Testing

```bash
npm test          # 62 unit tests
npm run test:e2e  # 50 end-to-end tests, desktop and phone
```

The unit tests cover the money arithmetic, invoice and report totals, status transitions, value
objects, document numbering and vCard generation. Two of them assert that the system reproduces
the totals on the real signed invoice and work report the company already uses, and five enforce
the Clean Architecture dependency rule so it cannot erode one convenient import at a time.

The end-to-end tests run against a production build and cover the public pages, the enquiry form
(including its idempotency and duplicate handling), sign in and its rate limiting, the full
invoice lifecycle through to PDF and Word output, report generation, the digital card, and phone
layout. One of them decodes a generated QR code with a real decoder, because a branded code that
does not scan is worse than no code at all.

---

## Deployment notes

- Point `DATABASE_URL` at the **pooled** Neon endpoint and `DATABASE_URL_UNPOOLED` at the direct
  one. Run `npm run db:migrate` as part of release, before the new build serves traffic.
- Set `NEXT_PUBLIC_SITE_URL` to the real domain before publishing any staff card, since existing
  printed codes encode whatever it was at the time.
- Change `ADMIN_PASSWORD` from the default. The application refuses to start in production if it
  is left as shipped, and requires `AUTH_SECRET` to be at least 32 characters.
- Uploaded media is served through `/api/media/<id>/raw` rather than straight from the bucket, so
  the storage driver can change without breaking a single stored URL.
- Neon suspends idle compute, which closes pooled connections. The pool handles that: it logs the
  dropped client and retries connection-level failures, so a suspend is invisible rather than an
  error. `npx tsx scripts/verify-db-recovery.ts` demonstrates it against your own database.
- TLS is configured in code with certificate verification on, rather than inherited from the
  `sslmode` parameter. Leave `sslmode=require` in the connection string; it is stripped before the
  driver sees it and the stronger setting is applied.
