# Testing the Phoenix IV Therapy Documentation Platform

This walks through running the full stack — Postgres, the NestJS backend (Sprints 1–7),
and the React frontend (Sprint 7) — and testing the complete 14-step workflow by hand.

**Why this wasn't run for you already:** the sandbox this was built in has no outbound
access to the npm package registry (confirmed by a direct TLS probe that bypassed the
dev proxy entirely — `registry.npmjs.org` itself returns 403 to this sandbox's network,
and there's no Docker daemon running here either), so nothing in this stack has been
installed, built, or executed by a tool. Every file has had a careful manual
read-through against the real backend contracts instead. Run this on your own machine,
or any CI runner / cloud dev box with normal internet access.

## Prerequisites

- Docker and Docker Compose (`docker compose version`).
- An authenticator app on your phone (Google Authenticator, Authy, 1Password, etc.) —
  MFA is mandatory for every staff account, with no bypass, so you'll need this to log
  in at all.

## 1. Start the stack

From the folder containing `phoenix-iv-platform/`, `phoenix-iv-frontend/`, and this
`docker-compose.yml`:

```bash
docker compose up --build
```

First run takes a few minutes (dependency install + Prisma generate + migrate + seed).
Watch the `backend` logs for `Seed complete` and `DEV-ONLY sample content activated`.

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## 2. Log in

Open http://localhost:5173. Three synthetic staff accounts are seeded
(`prisma/seed.ts`), all with password `Test-Password-Only-123`:

| Email | Role |
|---|---|
| `nurse.test@example.test` | Nurse / clinician |
| `admin.test@example.test` | Admin |
| `sysadmin.test@example.test` | System admin |

Log in as `nurse.test@example.test` — this role can carry a visit through the whole
workflow. None of these accounts have enrolled MFA yet, so the first login will show a
setup screen instead of signing you in:

1. Paste the shown `otpauth://` link into your authenticator app (most apps accept it
   pasted directly as a new account; if yours only accepts a typed secret, it's the
   `secret=` parameter in that URL).
2. Enter the 6-digit code it shows you.
3. You're in. Every later login just asks for a fresh code from the same entry.

## 3. Walk the full workflow

1. **Register a patient** → starts a visit, lands you on **Intake**.
2. **Intake**: click "Generate patient link", open it in another browser tab (or
   incognito window — it's a separate, unauthenticated session), fill in the intake
   form as the patient, submit. Back on the staff tab, the visit auto-advances to
   Screening once submitted (you can also use the "staff-entry" form on the same screen
   as a shortcut, skipping the separate tab).
3. **Screening**: click "Run screening". Because `DEV_APPROVE_SAMPLE_CONTENT=true` is
   set in `docker-compose.yml`, the seeded sample rule is active, so if you answered
   "yes" to "Heart disease" in intake you'll see a flag here to acknowledge; otherwise
   it'll show none. Either way, "Complete screening" advances you.
4. **Clinician assessment**: fill in a reason and vitals, choose "Proceed".
5. **Order authorization**: pick either order type.
6. **Protocol selection**: one of the seeded sample protocols is now selectable (again
   thanks to `DEV_APPROVE_SAMPLE_CONTENT`).
7. **Consent**: generate the patient link, open it in another tab, read the (sample)
   consent text, type a name, check the confirmation box, sign. Back on the staff tab,
   click "I witnessed this signature" — note the visit has already moved on to IV
   Preparation by this point; that's correct (see the frontend README for why).
8. **IV preparation**: pick the seeded base solution and ingredient, pick a lot. Try
   selecting the lot named `TEST-VITC-EXPIRED` to see the hard expired-lot block and its
   required override-reason field.
9. **IV insertion**: fill in site/side/gauge/attempts, mark successful.
10. **Infusion monitoring**: add an entry marked "tolerating". Try adding one marked
    "not tolerating" to see the automatic re-route to **Adverse event** — document it
    (any resolution works), which returns you to monitoring or jumps to completion
    depending on what you picked. Add at least one more "tolerating" entry before
    completing monitoring.
11. **Treatment completion**: fill in the form, confirm aftercare provided.
12. **Clinician sign-off**: the completeness summary should show "Ready to sign" if
    every prior step is genuinely done — if it lists blockers instead, that's the
    real backend completeness check working, not a bug. Type a designation and a
    signature, sign.
13. **Final record**: view the aggregated record, or open it as a PDF.

## 4. Things that are supposed to block you

- Protocol/consent/screening content is seeded **inactive** by default — without
  `DEV_APPROVE_SAMPLE_CONTENT=true` you'd legitimately get stuck at those steps with a
  `[CLINIC TO SUPPLY ...]` error. That's the safety design working as intended: this
  software never invents clinical content. The dev-only unblock script is
  `prisma/dev-approve-sample-content.ts` — read its header comment before ever running
  it anywhere but a local throwaway database.
- An expired product lot refuses to save without an explicit override reason.
- Sign-off refuses to let you sign until every documentation gap is resolved.
- There is no way to reach a signed state except through the sign-off screen — not
  even a direct API call can set `status: SIGNED` any other way.

## 5. Resetting

```bash
docker compose down -v   # drops the Postgres volume too — next `up` reseeds from scratch
```

## Known rough edges in this stack

See each repo's own README (`phoenix-iv-platform/README.md`,
`phoenix-iv-frontend/README.md`) for the fuller list — in short: no QR-code image for
MFA enrollment (paste the link/secret instead), typed-name signatures rather than a
signature pad, the final record view is raw formatted JSON rather than a typeset
document, and none of this has had an automated test run or a real `npm run build`
performed against it yet.
