# Build record

Written for: the project owner and any reviewer checking what was delivered and how it was
verified.

---

## Scope delivered

| Area | State |
|---|---|
| Public marketing site | Home, services index, 13 service detail pages, projects index and detail, about, FAQ, contact |
| Enquiry capture | Public quote form through to a lead in the dashboard, with rate limiting, honeypot and duplicate handling |
| Office dashboard | Enquiries, clients, jobs, proposals, invoices, work reports, services, content, media, settings, team |
| Proposals | A priced letter to a potential client, drafted from an enquiry, grouped scope sections, optional extras outside the total, PDF and Word export, emailable, decision recorded |
| Outbound email | Resend, optional throughout: enquiry confirmation, office alert, invoice, work report and proposal, every attempt logged |
| Invoicing | Line items, discounts, VAT, payments, status lifecycle, PDF and Word export |
| Work reports | The numbered completion and payment report, buildable from an invoice, PDF and Word export |
| Digital staff cards | Public card page, branded QR in three themes, lock-screen wallpaper, vCard download |
| Admin configuration | Services, contact details, document defaults, SEO, content and media all editable |
| Loading experience | Water-themed splash, route-change progress bar, branded skeletons and panels |

### The 13 services

Water Treatment, Reverse Osmosis Water Treatment, Osmosis Membrane Supply and Replacement,
Borehole Drilling, Geophysical Surveys, Community Water Systems, General Plumbing, Pipe Laying,
Solar Water Heater Installation, Bathroom Accessories and Fittings, Leak Detection and Repair,
Pressure Testing of Pipes, Drainage Works.

Each has a hero image, long-form description, approach notes, deliverables, indicative price,
turnaround and its own statically generated page. All editable in the dashboard.

---

## Verification

Everything below was run, not assumed.

### Unit tests: 97 passing

```
tests/unit/architecture.test.ts    5 tests
tests/unit/storage.test.ts        12 tests
tests/unit/money.test.ts           8 tests
tests/unit/invoice.test.ts        16 tests
tests/unit/proposal.test.ts       15 tests
tests/unit/email.test.ts           8 tests
tests/unit/domain.test.ts         19 tests
tests/unit/db-resilience.test.ts   6 tests
tests/unit/db-connection.test.ts   8 tests
```

The proposal tests pin down the one piece of arithmetic that is easy to get wrong: an optional
extra is quoted beside the total, never inside it, and it must not attract VAT in the quoted
figure either. The email tests pin down the dispatcher's promise, which is that a missing API
key, a switched-off toggle, a malformed address and a provider outage all produce an outcome the
caller can report, never an exception thrown at whoever was raising the invoice.

The architecture tests fail the build if the domain ever imports a framework, if a use case ever
imports infrastructure, or if a route reaches the database outside the dependency builders.

Two assert against the company's real paperwork:

- The 23 line items from the signed Mr. Ebo invoice total **GHC 19,830.00**, matching the paper
  document exactly.
- The Shola work report totals **GHC 2,800.00**, fully paid, zero outstanding, matching the signed
  report.

### End-to-end tests: 70 passing

Run against a production build on a desktop viewport and a Pixel 7.

Covered: every public page and its structured data, category filtering, the FAQ accordion, 404
handling, security headers, theme persistence, the enquiry form and its validation, enquiry
idempotency and deduplication, the honeypot, sign in and its failure modes, deep-link return after
sign in, every dashboard section, the seeded invoice, a full invoice lifecycle from creation
through issue, over-payment rejection, part payment and both document downloads, invoice creation
idempotency, the seeded work report, report generation from an invoice, debounced search, sign
out, the digital card and its flip, the vCard, all three QR themes, the wallpaper, and phone
layout including horizontal-overflow checks on seven pages.

Proposals and email add: the seeded proposal keeping its optional extras outside the total, a
proposal written from scratch through pricing, PDF and Word download, mark as sent, a recorded
acceptance and the editor then refusing to reopen it; an enquiry turned into a priced draft once
rather than twice under a repeated idempotency key, with the enquirer's own words carried into
the scope; the send dialog stating up front whether email can go out; the status endpoint never
returning the provider key; the email settings tab refusing an unsendable test address; and an
unauthenticated send being rejected.

Media adds: a file picked in the browser reaching the database and its exact bytes coming back
out through the route the site links to, a file past the limit refused with its size and the
limit rather than a shrug, an oversized photograph shrunk in the browser instead of refused, and
the readiness probe naming the store uploads are going to.

### Documents

Generated against the live database and inspected as images, not just byte counts:

| Document | Result |
|---|---|
| Invoice PDF | 2 pages, Noto Sans embedded, logo present, total GHC 19,830.00, customer ID EB/161026 |
| Invoice DOCX | Valid zip, 20 parts, logo embedded, total GHC 19,830.00 |
| Report PDF | All 6 numbered sections, cost table, FULLY PAID status, GHC 2,800.00 |
| Report DOCX | Valid zip, 20 parts, matches the template structure |
| Proposal PDF | 2 pages, letterhead, prepared-for block, phased scope table, totals box, optional extras listed separately, dual signature block, total GHC 76,700.00 |
| Proposal DOCX | Valid zip, 141 KB, same figures and section grouping |

### QR codes

All six generated artefacts (3 code themes, 3 wallpaper themes) decode successfully under **both**
jsQR and OpenCV. See `docs/ARCHITECTURE.md` section 7 for the three defects this testing exposed
and how each was fixed.

### Email

All seven outbound messages were rendered from live records, written to disk and inspected as
images, not only checked for a non-empty string. `npm run verify:email` reproduces it and sends
nothing. Each is asserted to be a complete HTML document carrying the company name, to have a
plain text alternative, to contain no unresolved placeholder and no em or en dash, and the
proposal message is asserted to quote the same total the database stores.

Two defects were found this way and fixed:

- The footer address read "Kanda, Accra, Ghana, Accra, Ghana", because the city and country were
  appended to address lines that already contained them.
- The proposal message quoted only the total, with no mention of the optional extras that sit
  beside it on the attached PDF. It now quotes both, clearly separated.

### Other checks

- `npm run typecheck` clean across the project.
- `npm run build` succeeds; 13 service pages and 6 project pages statically generated.
- `npm audit --omit=dev` reports **0 vulnerabilities**.
- No em dashes or en dashes in source or in stored content, verified by
  `scripts/check-dashes.ts`.

---

## Defects found and fixed during testing

These were real, and are listed because they are the useful part of a build record.

1. **Sidebar linked to a page that did not exist.** The Team entry pointed at `/admin/users`; the
   page is at `/admin/team`. Caught by the navigation test.
2. **Horizontal reveal animations made phones scroll sideways.** Elements below the fold sat
   offset 28px to the right, widening the document. Narrow screens now get the vertical reveal.
3. **The branded QR code did not scan.** Three separate causes: non-contiguous modules breaking
   the timing pattern, over-rounded finder patterns, and a bright finder core inverting the
   1:1:3:1:1 signature. All three fixed and verified against two decoders.
4. **The wallpaper's glass panel killed QR contrast.** The code now sits on an opaque tile.
5. **Large headings overlapped the following line in PDFs.** react-pdf under-allocates their
   height without an explicit `lineHeight`.
6. **The customer reference read ME/161026 instead of EB/161026.** Courtesy titles are now skipped
   when deriving initials, matching how the office writes these.
7. **The splash screen could block interaction.** It waited on `window.load`, which a slow
   third-party image can delay indefinitely. It is now `pointer-events: none` with a hard ceiling.
8. **Document logos were the full lockup, unreadable at small sizes.** A trimmed symbol-only mark
   is now used in the header, sidebar and favicon.
9. **Two overlay backdrops shared an accessible name with the real close button**, making the
   control ambiguous to assistive technology. Backdrops are now hidden from the accessibility
   tree.
10. **Next 15.5.4 shipped with a published CVE** and `drizzle-orm` below 0.45.4 had a high
    advisory. Both upgraded before anything was built on them.

### Found after the first sign-off, from dev-server reports

11. **The connection pool had no error handler.** Neon suspends idle compute and closes every
    connection it is holding. In `pg`, an error on an idle client is emitted on the pool, and with
    no listener Node treats it as unhandled and takes the process down. A routine suspend was
    therefore capable of causing an outage. The pool now handles it, and queries retry on
    connection-level failures only. `scripts/verify-db-recovery.ts` proves recovery by terminating
    the backends underneath a live pool; six unit tests pin down which errors may be retried, so a
    constraint violation is never repeated.
12. **The theme script warned in development.** An inline `<script>` rendered by a React component
    never executes on a client render. It moved to `next/script` with `beforeInteractive`, which
    keeps the no-flash behaviour and is covered by the theme persistence test.
13. **The wallpaper preview on the card page returned 422.** The page requests a 430px wide
    thumbnail and the route required at least 640. The bounds were wrong, not the page. Two tests
    now cover it: the preview size renders, an absurd size is still rejected.
14. **Service page titles read "… | MerSam | MerSam".** The seeded SEO title carried a brand
    suffix that the layout template already appends.

### Found while building proposals and email

19. **The default proposal opening lowercased the title.** "Thank you for the opportunity to quote
    for borehole and treatment plant for ridge residences" reads as a mistake to a client, because
    the title carries proper nouns. The opening no longer folds it into a sentence.
20. **Signature rules on the proposal PDF sat at different heights.** The two cells are only the
    same height when both carry a job title. Each is now a fixed-height box, so the rules line up
    whether or not a role is set.
### Found in production, reported by the owner

22. **Media upload was broken on the deployed site, and nothing said why.** Three faults in one
    path. The object store bucket the deployment pointed at no longer existed, so every upload
    threw. The fallback to Postgres that was supposed to cover exactly this wrapped only the
    dynamic import, which never throws, so it had never once run: a dead bucket surfaced as a
    generic 500. And the application advertised an 8MB limit on a platform that refuses any
    request body over 4.5MB, so every ordinary phone photograph was rejected by the platform
    before the application saw it, with the client unable to parse the plain text reply to
    explain itself. The driver is now health checked before it is used, reads and deletes route
    on the shape of the key so media survives a driver change, the cap sits under the platform's,
    oversized images are downscaled in the browser, and `/api/health` reports which store is
    actually in use. Upload had no end-to-end coverage at all, which is why it shipped; it has
    four tests now.

21. **Every line item in the proposal editor shared a label.** "Title", "Quantity" and "Unit
    price" repeated down the form, so nothing identified which line a field belonged to for a
    screen reader, and nothing could address one in a test. Each now carries its line number.

### Found after the second sign-off, from a report of the splash hanging

15. **The splash screen hung permanently on first load.** React runs effects twice in development.
    The first run showed the splash and wrote the "once per session" flag; the cleanup cancelled
    its timers; the second run read the flag it had just written, took the early return, and
    scheduled nothing. Nothing was left to dismiss the overlay. The flag is now written when the
    splash *finishes*, never when it starts, and a ceiling timer guarantees it clears regardless.
    Covered by an end-to-end test that also asserts it never swallows a click.
16. **Database connections were encrypted but not authenticated.** The pool passed
    `rejectUnauthorized: false` whenever the connection string said `sslmode=require`, which
    disables certificate verification and leaves the connection open to interception. Neon
    presents a publicly trusted certificate, so verification was never needed to be turned off.
    TLS is now configured explicitly in `infrastructure/db/connection.ts` with verification on,
    which also removes the `pg-connection-string` deprecation warning, and eight tests pin the
    behaviour down.
17. **Next 16 blocked dev resources from other local origins.** Opening the dev server on
    `127.0.0.1` or a LAN address, for example to check a page on a phone, silently broke hot
    reload and hydration. `allowedDevOrigins` now covers them.
18. **An admin test assumed the seeded invoice was on the first page.** Repeated runs raised newer
    invoices that sorted above it. The test now searches for it, and `npm run qa:reset` removes
    the records the suite creates so the database does not grow without limit.

---

## Cross-cutting requirements

| Requirement | How it is met |
|---|---|
| State management | React Query for server state, local state for UI, `useLocalStorage` for the enquiry draft so a closed tab does not lose a long message |
| Caching and local storage | Read-through content cache invalidated on write, ISR on public pages, immutable headers on media, theme and draft in `localStorage`, splash flag in `sessionStorage`. Every storage access is wrapped, because it throws in private windows |
| Optimised API calls | Server-side paging and filtering, `keepPreviousData` so lists never collapse mid-fetch, one bundled home page query instead of six round trips, retries suppressed on 4xx |
| Lazy loading | Route-level splitting, lazy images below the fold, `IntersectionObserver` for reveals and counters, storage driver imported on demand |
| Debouncing | 350ms on admin search, `requestAnimationFrame` coalescing on scroll and parallax |
| Idempotency | `Idempotency-Key` on every create, unique-index backed, plus a content-hash guard on the public form |
| Clean Architecture | Four layers with the dependency rule pointing inwards, ports in `application/ports`, one composition root |

---

## Configuration before going live

1. Set `NEXT_PUBLIC_SITE_URL` to the real domain **before** publishing any staff card. QR codes
   encode this value, and a printed code cannot be corrected afterwards.
2. Change `ADMIN_PASSWORD` from the seeded default and set a `AUTH_SECRET` of at least 32
   characters. The application refuses to start in production otherwise.
3. Rotate the Neon credentials if they have been shared anywhere during development.
4. Replace the seeded stock photography through Media and Services. Current images are from
   Unsplash under a licence that permits commercial use without attribution, and each was
   inspected before being listed, but your own photographs of your own work will serve better.
5. Email stays off until `RESEND_API_KEY` and `EMAIL_FROM` are set, the sending domain is
   verified with Resend, and the box is ticked under Settings, Email. Send a test from that tab
   before relying on it. Until then nothing breaks: documents are downloaded and sent by hand,
   and the dashboard says so.
6. Review the seeded copy. It was written to sound like the business and is accurate to the
   services described, but figures such as "340 boreholes delivered" are placeholders.
