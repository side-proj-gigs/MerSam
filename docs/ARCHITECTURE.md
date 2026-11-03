# Architecture

Written for: the engineers who will maintain and review this codebase.

This document covers the shape of the system and, more usefully, the decisions that are not
obvious from reading the code. Where a choice looks strange, the reason is here.

---

## 1. Layers

```
core  <-  application  <-  presentation  <-  app / components
                 ^
                 |
          infrastructure
```

**`src/core`** holds entities, value objects and the rules that are true regardless of how the
system is delivered: what a valid invoice line is, how a total is computed, when an invoice
becomes overdue. It imports nothing outside itself. You can run it in a script, a test or a
different framework without changing a line.

**`src/application`** holds use cases. Each one is a plain function taking a dependency bundle and
an input. It declares what it needs as an interface in `application/ports`, never as a concrete
class. This is where authorisation lives, because "may this person do this" is an application
rule rather than a transport one.

**`src/infrastructure`** implements those ports with Drizzle, bcrypt, jose, react-pdf, docx and
the QR renderer. `infrastructure/container.ts` is the only place where an interface meets its
implementation. `infrastructure/deps.ts` assembles the exact bundle each use case asks for, so a
route handler never has to know which repositories a use case happens to touch.

**`src/presentation`** holds HTTP concerns that are not business rules: the response envelope,
error mapping, session cookies, the idempotency wrapper and the Zod schemas.

**`src/app`** is deliberately thin. A route parses its input, calls a use case and returns. Where
a resource needs nothing but storage, `presentation/http/crud.ts` generates the handlers from a
declaration so the same twenty lines are not written five times.

### Why the dependency rule is worth the ceremony

The invoice total is computed by `calculateTotals` in `core/entities/invoice.ts`. That same
function runs in three places: the server when saving, the browser while the person is typing, and
the unit tests. There is exactly one definition of what an invoice costs. The figure on screen
cannot drift from the figure in the database, because they come from the same code.

---

## 2. Money

Every monetary amount is an integer count of minor units (pesewas), wrapped in a `Money` value
object. Floating point never touches a price.

```ts
Money.fromMajor(0.1).plus(Money.fromMajor(0.2)).minorUnits  // 30, not 30.000000000000004
```

`Money` refuses to add two different currencies, rejects fractional minor units, and rounds half
up on multiplication because that is what someone reading an invoice expects.

The database stores integers in `*_minor` columns. Quantities are `numeric(12,2)` so metres and
hours work. Discounts are stored as minor units when fixed and as a plain percentage when
proportional, which the `discountKind` column disambiguates.

Totals are **always derived** and never trusted from the client. The stored `subtotal_minor`,
`vat_minor`, `total_minor` and `balance_minor` columns exist only so the admin list can sort and
sum without rehydrating every aggregate; they are rewritten from the lines on every save.

Payment totals are re-summed from the `payments` table in a single statement rather than
incremented, so deleting or correcting a payment can never leave an invoice out of step with its
own ledger.

---

## 3. Idempotency

Three different mechanisms, because they solve three different problems.

**`Idempotency-Key` header** (`presentation/http/idempotency.ts`). Backed by a unique index on
`(key, scope)`. The first request reserves the key, stores its response and returns it. A replay
with the same key returns the stored response and an `Idempotency-Replayed: true` header. A
request arriving while the first is still running gets a `409` rather than racing it. A failed
attempt releases the key, so a corrected retry is not blocked by the mistake.

This matters most on invoice creation, which allocates a number from a shared sequence, and on
payments, where a double click would otherwise record the money twice.

**Content-hash deduplication** on the public enquiry form. A visitor who double-taps Send has no
idempotency key, so the lead repository hashes phone plus message and returns the existing lead if
an identical one arrived in the last ten minutes.

**Naturally idempotent operations.** Issuing an already-issued invoice returns it unchanged.
Converting an already-converted lead returns the same client. These need no machinery.

---

## 4. Caching

| Layer | Mechanism | Invalidation |
|---|---|---|
| Public page HTML | Next ISR, `revalidate = 300` | Time |
| Public content queries | In-process read-through cache, 5 minute TTL | Explicit, on every admin write |
| Admin lists | React Query, 60s stale time, `keepPreviousData` | On mutation |
| Uploaded media | `Cache-Control: public, max-age=31536000, immutable` | Never; a replacement gets a new id |
| QR and wallpaper | `max-age=3600, stale-while-revalidate=86400` | Time |

The in-process cache is per instance and bounded at 500 entries with recency eviction. That is the
right trade for content which changes a few times a day and is read constantly. Anything that must
be consistent across instances is not cached: money, leads and jobs are read from Postgres.

The home page needs six collections. `getHomepageBundle` fetches them in one `Promise.all` rather
than a waterfall, and each part is individually cached so a later page reuses the same data.

---

## 5. Authentication

Sessions are stateless JWTs in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie,
signed with `AUTH_SECRET` via `jose`.

Two gates, deliberately:

1. **`src/proxy.ts`** (the Next 16 proxy convention, formerly middleware) checks only that the
   cookie carries a signature we issued. It runs on the edge and cannot reach the database, so it
   is a cheap filter, not an authority. It also remembers the requested path so sign in can return
   there, validating that the path is local so it cannot be used as an open redirect.
2. **The admin layout** resolves the principal properly: it looks the account up and confirms it
   still exists and is active. A suspension or demotion therefore takes effect on the next request
   rather than when the token expires.

Roles are ordered (`viewer < staff < admin < owner`) and `roleAtLeast` is used everywhere, so a
new capability does not require touching every check.

Login is rate limited twice: per account, so one target cannot be ground down, and per client, so
a spray across many accounts is also capped. A sign in attempt against an address that does not
exist still pays the password-hashing cost, so response timing does not reveal which accounts are
real.

---

## 6. Documents

Invoices and work reports generate as both PDF and Word from the same stored record.

**PDF** uses `@react-pdf/renderer`. Two things are worth knowing:

- The default Helvetica has no cedi sign, so every amount would render as a gap. Noto Sans is
  bundled under the Open Font License and registered at render time.
- Large headings carry an explicit `lineHeight`. Without it react-pdf under-allocates their height
  and the following line draws over them. This was found by rendering the output and looking at
  it, not by reading the code.

**Word** uses the `docx` package, building real tables rather than a text approximation, so the
office can edit the result.

Both reproduce the layout of the paper documents the company already uses, including the numbered
sections of the completion report and the `GHC` column headings on the invoice.

---

## 7. QR codes and wallpapers

This is the part most likely to look over-engineered, so here is why it is not.

A styled QR code is mostly an exercise in not breaking it. The first version used circular modules
and heavily rounded finder patterns. It looked excellent and **did not scan**. Testing against two
independent decoders, jsQR and OpenCV, produced three separate findings:

1. **Modules must stay contiguous.** Drawing them as separated dots leaves gaps along the timing
   patterns, which is how a decoder measures the module pitch. A module is now a full-width
   rounded rectangle that meets its neighbours.
2. **Finder corner radius is capped at one module.** Rounder than that and OpenCV's run-length
   detector stops recognising the 1:1:3:1:1 signature. The cap was measured with a sweep, not
   guessed.
3. **Both the outer ring and the 3x3 core of a finder pattern must be dark.** A bright gold core
   looked better on screen and inverted the middle run of that signature, so the code could not be
   located at all. The brand appears there only in its deepest steps.

Every theme is therefore dark modules on a white ground. The "dark" theme means a code that sits
well on a dark page, not a code made of light, because a meaningful share of scanners refuse to
read an inverted one.

The wallpaper composes the code onto a phone-sized canvas with the brand above the optical centre,
clear of where a lock screen puts its clock, and the contact details below. The code sits on an
opaque tile rather than the glass panel behind it, because a translucent panel costs exactly the
contrast a camera needs in poor light.

`tests/e2e/card.spec.ts` decodes a generated code with a real decoder on every run.

---

## 8. Storage

`FileStorage` is a port with two implementations: Neon's S3-compatible object storage, and
Postgres `bytea` as a fallback when no bucket is configured.

Uploads are served through `/api/media/<id>/raw` rather than straight from the bucket. That costs
a hop and buys three things: the storage driver can change without rewriting a single stored URL,
nothing needs to be made publicly readable at the bucket level, and the response can carry an
immutable cache header so the work happens once per edge location.

---

## 9. Front end

**Design tokens.** Colour is defined once as semantic tokens on `:root` and redefined for dark
mode. Dark mode is a selected set of values, not an automatic inversion.

**Chart colours were computed, not chosen.** The dashboard uses `#ab8420` and `#1e9cb3`. Both were
run through a palette validator against the light and dark chart surfaces and pass every check in
both modes, including protan and tritan separation. Series identity never rests on colour alone:
there is always a legend, and the chart offers a table view.

**Motion is one vocabulary.** Everything enters the same distance over the same duration.
`prefers-reduced-motion` is respected throughout.

One bug worth recording: a reveal that slides in horizontally starts the element offset sideways,
which widens the document. Below the fold on a phone that showed up as the whole page scrolling
sideways. Narrow screens now get the vertical reveal instead, swapped in CSS via a data attribute
so there is nothing to hydrate.

**The splash screen cannot trap anyone.** It is `pointer-events: none`, shows once per session,
respects reduced motion, and leaves after a hard ceiling regardless of whether a third-party image
has finished loading.

---

## 10. Known limits

- The in-process content cache is per instance. On several instances a write invalidates only the
  one that served it; the rest catch up within the five minute TTL. Acceptable for content that
  changes a few times a day. Move it to Redis if that stops being true.
- Hero slides and headline figures are stored as structured JSON and are not yet editable through
  a form. Everything else on the public site is.
- The notifier writes to the log. The port exists so an email or SMS adapter can be added without
  touching the use case.
- Invoice line reordering is by sort order, set on save. There is no drag handle yet.
