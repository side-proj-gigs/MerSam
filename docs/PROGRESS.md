# Build record

Written for: the project owner and any reviewer checking what was delivered and how it was
verified.

---

## Scope delivered

| Area | State |
|---|---|
| Public marketing site | Home, services index, 13 service detail pages, projects index and detail, about, FAQ, contact |
| Enquiry capture | Public quote form through to a lead in the dashboard, with rate limiting, honeypot and duplicate handling |
| Office dashboard | Enquiries, clients, jobs, invoices, work reports, services, content, media, settings, team |
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

### Unit tests: 62 passing

```
tests/unit/architecture.test.ts    5 tests
tests/unit/money.test.ts           8 tests
tests/unit/invoice.test.ts        16 tests
tests/unit/domain.test.ts         19 tests
tests/unit/db-resilience.test.ts   6 tests
tests/unit/db-connection.test.ts   8 tests
```

The architecture tests fail the build if the domain ever imports a framework, if a use case ever
imports infrastructure, or if a route reaches the database outside the dependency builders.

Two assert against the company's real paperwork:

- The 23 line items from the signed Mr. Ebo invoice total **GHC 19,830.00**, matching the paper
  document exactly.
- The Shola work report totals **GHC 2,800.00**, fully paid, zero outstanding, matching the signed
  report.

### End-to-end tests: 50 passing

Run against a production build on a desktop viewport and a Pixel 7.

Covered: every public page and its structured data, category filtering, the FAQ accordion, 404
handling, security headers, theme persistence, the enquiry form and its validation, enquiry
idempotency and deduplication, the honeypot, sign in and its failure modes, deep-link return after
sign in, every dashboard section, the seeded invoice, a full invoice lifecycle from creation
through issue, over-payment rejection, part payment and both document downloads, invoice creation
idempotency, the seeded work report, report generation from an invoice, debounced search, sign
out, the digital card and its flip, the vCard, all three QR themes, the wallpaper, and phone
layout including horizontal-overflow checks on seven pages.

### Documents

Generated against the live database and inspected as images, not just byte counts:

| Document | Result |
|---|---|
| Invoice PDF | 2 pages, Noto Sans embedded, logo present, total GHC 19,830.00, customer ID EB/161026 |
| Invoice DOCX | Valid zip, 20 parts, logo embedded, total GHC 19,830.00 |
| Report PDF | All 6 numbered sections, cost table, FULLY PAID status, GHC 2,800.00 |
| Report DOCX | Valid zip, 20 parts, matches the template structure |

### QR codes

All six generated artefacts (3 code themes, 3 wallpaper themes) decode successfully under **both**
jsQR and OpenCV. See `docs/ARCHITECTURE.md` section 7 for the three defects this testing exposed
and how each was fixed.

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
5. Review the seeded copy. It was written to sound like the business and is accurate to the
   services described, but figures such as "340 boreholes delivered" are placeholders.
