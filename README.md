# MerSam

A full-stack web application for MerSam Water Systems and Plumbing Services: a public marketing
site, an office dashboard, invoicing, proposals, work completion reports, outbound email and
shareable staff cards.

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
| `STORAGE_DRIVER` | no | `local` (the default) keeps uploads in Postgres, `s3` uses an object store. An unreachable bucket falls back to Postgres rather than failing uploads |
| `S3_*` | if `STORAGE_DRIVER=s3` | Endpoint, bucket, region and credentials |
| `EMAIL_PROVIDER` | no | `auto` (default), `resend` or `gmail` |
| `RESEND_API_KEY` | no | Enables outbound email through Resend. Left blank, the dashboard says so plainly and every document is still downloadable |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_SENDER` | no | Enables outbound email through a Gmail account. OAuth credentials, not an API key: run `npm run gmail:authorise` to mint the refresh token |
| `EMAIL_FROM` | if sending | Sender address. Must be on a domain verified with Resend |
| `EMAIL_FROM_NAME` / `EMAIL_REPLY_TO` | no | Display name and reply address |
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
| `npm run verify:email` | Renders every outbound message to `.local/email-preview` and checks it, sending nothing |
| `npm run gmail:authorise` | One-time Google consent that prints a Gmail refresh token |
| `npm run fix:image-urls` | Rewrites stored links to our own media into relative paths |
| `npm run qa:reset` | Removes the records the test suite creates, keeping the seeded examples |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed content. Safe to re-run; it upserts |

---

## What is in here

### Public site
Home, services index and 13 service detail pages, projects index and detail, about, FAQ and
contact, plus a privacy policy and terms of service. Everything on these pages comes from the
database and is editable in the dashboard.
Service and project pages are statically generated and revalidated every five minutes.

### Office dashboard (`/admin`)
- **Enquiries** from the public quote form, with status, notes and one-click conversion to a client
- **Clients** and **Jobs**
- **Proposals**: a priced letter to a potential client, drafted straight from an enquiry, with
  grouped scope sections, optional extras quoted outside the total, PDF and Word export, and a
  recorded decision when the client answers
- **Invoices**: line items, discounts, VAT, payments, PDF and Word export
- **Work reports**: the numbered completion and payment report, PDF and Word export
- **Media**: a library of photographs and documents. A tile opens a viewer showing the whole
  file uncropped, with its dimensions, size and address, and arrow keys move through the page
- **Services**, **Content** (testimonials, projects, FAQs), **Settings**
- **Team**: accounts, roles and each person's digital business card

### Outbound email
Either **Resend** or a **Gmail account** carries the messages, and it is treated as optional
throughout. Both talk HTTPS, so neither depends on SMTP, which a serverless host does not allow
out. Resend sends from your own domain and is the better choice for invoices; Gmail needs no
domain verification but everything arrives from that mailbox under Google's own daily limits.

Gmail is **not** configured with an API key. Google documents an API key as being for public
data, and a mailbox is not that, so `messages.send` wants an OAuth 2.0 access token. Setting it
up once:

1. In the Google Cloud console, enable the Gmail API, configure the OAuth consent screen, and
   create an OAuth client of type **Web application**.
2. Add `http://localhost:5410/callback` to its authorised redirect URIs. Consent happens on your
   own machine, so a production URL cannot receive the code.
3. Put the downloaded client secret JSON in `files/` (gitignored) and run
   `npm run gmail:authorise`. It reads the file, opens the consent screen, and prints every value
   to set, locally and in Vercel.

The refresh token can send mail as that account until it is revoked at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions). Treat it as a
password.

**Before Gmail works in production**, the OAuth consent screen has to leave Testing status, and
Google's review has two hard prerequisites:

- **A domain you actually own.** Google verifies the *top private domain* of your home page. For
  `anything.vercel.app` that is `vercel.app`, which belongs to Vercel, so it can never be
  verified. Point your own domain at the deployment, verify it in Google Search Console using an
  account that is an Owner or Editor on the Cloud project, and list it under Authorised domains.
- **A privacy policy on that same domain, linked from the home page.** `/privacy` is that page.
  It discloses the Gmail scope, what is and is not done with Google user data, and the Limited
  Use commitment, which is what the reviewer checks for.

Left in Testing status no review is needed, but authorisations expire after seven days and mail
stops until you re-authorise. `gmail.send` is a *sensitive* scope rather than a restricted one,
so verification does not require a third-party security assessment. With no API key the
dashboard says which piece is missing, every document stays downloadable, and nothing fails.
With a key configured, five messages go out:

| Message | Sent when |
|---|---|
| Enquiry confirmation | Somebody submits the public quote form, carrying their reference |
| Office alert | The same submission, so nobody has to watch the dashboard |
| Invoice | Sent from the invoice, with the PDF attached |
| Work report | Sent from the report, with the PDF attached |
| Proposal | Sent from the proposal. A successful send is what marks it as issued |

Every attempt is written to an email log whether it succeeded, failed or was skipped, so the
detail pages can say when a document last reached someone. The office is blind copied on
everything, and Settings, Email has a send-a-test button that proves the whole path end to end.

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
npm test          # 114 unit tests
npm run test:e2e  # 73 end-to-end tests, desktop and phone
```

The unit tests cover the money arithmetic, invoice, proposal and report totals, status
transitions, value objects, document numbering, vCard generation and the email dispatcher, which
has to report a provider failure as an outcome rather than throw it at whoever raised the
invoice. Two of them assert that the system reproduces
the totals on the real signed invoice and work report the company already uses, and six enforce
the Clean Architecture dependency rule, and the absence of browser dialogs, so neither can
erode one convenient line at a time.

The end-to-end tests run against a production build and cover the public pages, the enquiry form
(including its idempotency and duplicate handling), sign in and its rate limiting, the full
invoice lifecycle through to PDF and Word output, proposal writing through to a recorded
decision, report generation, the digital card, and phone layout. The email tests assert the
behaviour that has to hold whether or not a provider is configured, which is that the dashboard
states up front what will happen rather than failing after someone has composed a message. One of them decodes a generated QR code with a real decoder, because a branded code that
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
- **Uploads are capped at 4MB, because a serverless request body on Vercel is capped at 4.5MB.**
  Anything larger is answered by the platform with its own 413 before the application sees it, so
  the cap sits below that and oversized photographs are shrunk in the browser before they are
  sent. Raising `MAX_UPLOAD_BYTES` without moving off a serverless host puts uploads back in the
  hole they were in: accepted by the form, refused by the platform, explained by nobody.
- `GET /api/health` reports which store uploads are actually going to, and says why if the
  configured one is unreachable. Check it first when an upload misbehaves in production.
- **An image address pasted into a content field is reduced to a relative path when it is
  saved.** `next/image` answers 400 for an absolute URL whose host is not in `remotePatterns`,
  and a site does not list itself, so a full link copied out of the media library showed nothing
  at all. Admin image fields now have a "Library" button that writes the right value directly.
- Neon suspends idle compute, which closes pooled connections. The pool handles that: it logs the
  dropped client and retries connection-level failures, so a suspend is invisible rather than an
  error. `npx tsx scripts/verify-db-recovery.ts` demonstrates it against your own database.
- Email is off until `RESEND_API_KEY` and `EMAIL_FROM` are set **and** the box is ticked under
  Settings, Email. Verify the sending domain with Resend first, or messages are accepted by the
  API and then rejected downstream.
- TLS is configured in code with certificate verification on, rather than inherited from the
  `sslmode` parameter. Leave `sslmode=require` in the connection string; it is stripped before the
  driver sees it and the stronger setting is applied.
