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

Invoices, work reports and proposals generate as both PDF and Word from the same stored record.

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

The proposal is a letter rather than a form, so it renders differently: letterhead, a prepared-for
block, a salutation, the opening, a scope table whose rows group under gold section headings, the
totals box, then the optional extras in a table of their own, the closing, and a dual signature
block. The two signature cells are fixed-height boxes, because without that the rules sit at
different heights whenever one party has a job title and the other does not.

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

## 8. Email

Email is a port, `EmailSender`, with one implementation, Resend. What matters about it is not the
provider but the stance: **sending is optional and may fail, and neither may ever take down the
work it accompanies.**

Three rules follow from that, all enforced in one function, `dispatch` in
`application/use-cases/email.ts`:

1. **A sender that cannot send says so instead of throwing.** No API key, no verified sender
   address, a malformed recipient: each returns a `skipped` outcome carrying a sentence a person
   can act on, and the dashboard shows that sentence before anyone composes a message rather than
   after they press send.
2. **A provider failure is an outcome, not an exception.** Raising an invoice and emailing it are
   two different things. If Resend is having a bad day, the invoice is still raised and the
   office is told the message did not go.
3. **Every attempt is logged, whatever happened.** `email_log` records sent, failed and skipped
   alike, with the entity it belonged to. That is what lets a detail page say when a document
   last reached someone, and what makes a complaint of "we never got it" answerable.

The office is blind copied on everything, so there is an internal record independent of the log.
Attachments are rendered through a second port, `DocumentRenderer`, so the use case that emails an
invoice knows nothing about how a PDF is made.

The contact form follows the same stance. The lead is saved first; the confirmation to the sender
and the alert to the office go out afterwards through `Promise.allSettled`, so a mail outage
cannot turn a successful submission into an error on a visitor's screen.

---

## 9. Proposals

A proposal is a letter with a priced scope attached: narrative fields carry the letter, items
carry the table. The money behaves exactly as it does on an invoice, so `calculateProposalTotals`
delegates to `calculateTotals` rather than growing a second copy of the arithmetic.

The one rule that is genuinely its own is the **optional extra**. An item marked optional is
quoted to the client but excluded from the headline figure, and therefore from the discount and
the VAT as well. It is returned separately as `totals.optional` so the editor, the detail page,
the PDF and the email can all show the same thing: one price, with extras named beside it. Unit
tests pin this down from both directions, including the case where every line is optional and the
total is correctly zero.

Status is partly derived rather than stored: a `sent` proposal whose validity has passed reads as
`expired` without anything needing to run on a schedule. A decided proposal, accepted or declined,
is never re-derived and can no longer be edited, because at that point it is a record of what was
agreed rather than a draft. Accepting one closes the enquiry it came from as won.

---

## 10. Storage

`FileStorage` is a port with two implementations: an S3-compatible object store, and Postgres
`bytea`, which is the default and the fallback.

Uploads are served through `/api/media/<id>/raw` rather than straight from the bucket. That costs
a hop and buys three things: the storage driver can change without rewriting a single stored URL,
nothing needs to be made publicly readable at the bucket level, and the response can carry an
immutable cache header so the work happens once per edge location.

### The fallback has to be real

The first version of `resolveStorage` wrapped the dynamic `import('./s3')` in a try and called
that a fallback. It was not one. Importing a module practically never throws; a missing bucket or
a rotated key fails much later, inside `save`, where nothing was catching it. So a configuration
that looked healthy produced "something went wrong on our side" on every upload and said nothing
about why.

That is not hypothetical. The Neon bucket the deployment pointed at had stopped existing, and the
only symptom anybody could see was that uploading media did not work.

The driver is now asked whether it can actually reach its bucket, once per process, before it is
handed out. If it cannot, the reason is logged as a sentence and Postgres takes over, so the
office can always upload something. `GET /api/health` reports the same thing, because a bucket
that has quietly stopped existing is invisible from outside until somebody tries to use it.

### A key names its own store

Falling back raises a second problem: an asset uploaded while S3 was healthy must stay readable
afterwards. Reads and deletes therefore route on the shape of the key rather than on whatever is
configured now. A Postgres key is a bare UUID; an object store key always carries a folder and an
extension. `isPostgresStorageKey` lives in the domain, next to the upload rules, because it is a
fact about the data rather than about any driver.

### The limit belongs to the platform, not to taste

Uploads are capped at 4MB. The number is not an opinion: a serverless request body on Vercel
cannot exceed 4.5MB, and the platform answers anything larger with a plain text 413 before the
function runs. The application had been advertising 8MB, so every photograph between the two was
accepted by the form and rejected by the platform, with the client unable even to parse the reply
to say why.

The cap now sits below the platform's, the client reads a 413 as the specific thing it is, and an
oversized image is downscaled in the browser rather than refused: the longest edge is capped at
2400px and an opaque PNG is re-encoded as JPEG, which is what lets a 12MB screenshot through. A
file that genuinely cannot be shrunk is refused with its size and the limit, not with a shrug.

---

## 11. Front end

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

## 12. Known limits

- The in-process content cache is per instance. On several instances a write invalidates only the
  one that served it; the rest catch up within the five minute TTL. Acceptable for content that
  changes a few times a day. Move it to Redis if that stops being true.
- Hero slides and headline figures are stored as structured JSON and are not yet editable through
  a form. Everything else on the public site is.
- Email is sent in the request that asks for it. A message with a large attachment therefore
  holds the request open for a second or two. A queue would be better under volume; at the volume
  this office works at, it would be machinery without a purpose.
- There is no inbound email. A client reply goes to the reply-to address and is read in a normal
  mailbox, not in the dashboard.
- Invoice line reordering is by sort order, set on save. There is no drag handle yet.
