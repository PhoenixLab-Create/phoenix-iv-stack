# Phoenix IV Therapy — Frontend (Sprint 7)

A React + Vite single-page app for the Phoenix IV Therapy Documentation Platform backend
(`phoenix-iv-platform`, Sprints 1–6). This is **Sprint 7 — Frontend Sprint 1**: staff auth
and a full, clickable workflow skeleton wired to the real API, built accessibly from the
start.

## What this is

- **Staff-facing app**: login → mandatory MFA (enrollment or verification) → dashboard →
  register a patient / open a visit → all 14 workflow steps, each a real screen making real
  API calls against the backend contracts (verified directly from the backend's
  controllers/DTOs/Prisma schema, not guessed from the PRD prose).
- **Patient-facing pages** (`/patient/:visitId/intake`, `/patient/:visitId/consent`): no
  login, authenticated by the single-visit session token staff generates and hands over —
  matching the architecture decision that patients never get accounts.

## What this is not (yet)

- Not visually polished — this sprint prioritized correct wiring to the real backend over
  final design treatment. The design tokens and base styles (`src/styles/`) establish the
  visual direction (calm, clinical, IBM Plex type, color reserved for safety-critical
  states); screens are functional and accessible but plain.
- No QR code rendering for MFA enrollment — `MfaEnrollPage` shows the `otpauth://` URL as
  text/link rather than a scannable image, to avoid adding an unverified dependency in a
  sandbox with no package-registry access (see below). A real deployment should add a QR
  library once it can install and verify one against a live build.
- No signature-pad/image capture — consent and sign-off currently take a typed name as the
  signature reference (`signatureBlobRef: "typed:<name>"`). Real signature capture (drawn
  or uploaded) is a follow-up.
- The final record view (`RecordPage`) renders the backend's aggregated record as
  formatted JSON rather than a typeset document. `RecordService.getCurrentView()`'s exact
  shape is treated as an internal aggregation detail in `api/types.ts` (`RecordView`) rather
  than hard-typed field-by-field, so this is the one screen most likely to need backend
  coordination before it's a presentable view.
- No automated tests yet (`vitest` is wired into `package.json` but no test files exist).

## Backend changes made alongside this frontend

Building this surfaced three real gaps in the Sprint 1–6 backend that had no way to be
fixed from the frontend side — all three are additive, non-clinical, structural fixes:

1. **`GET /visits/:visitId/intake/form` and `/form/staff`** — there was no endpoint at all
   exposing the active intake question set to a client. Added two routes (patient-session
   and staff-authenticated) mirroring the pattern `ConsentController` already used for its
   template route. (`src/intake/intake.controller.ts`, `intake.service.ts`)
2. **`GET /visits/:visitId/consent/template/patient`** — the only existing template route
   was staff-only (`AuthGuard('jwt')`), so a patient session had no way to read the consent
   text they're about to sign. Added a patient-session-guarded twin.
   (`src/consent/consent.controller.ts`)
3. **Monitoring entries didn't expose their vitals** — `MonitoringService.list()` returned
   `vitalSetId` with no relation to actually read the vitals it points to; the Prisma schema
   had no relation declared at all between `InfusionMonitoringEntry`/`VitalSet`. Added the
   relation (`prisma/schema.prisma`) and an `include` in `list()`
   (`src/monitoring/monitoring.service.ts`). **This needs a migration**
   (`npx prisma migrate dev --name add_monitoring_vitalset_relation`) before it's live —
   not run here since this sandbox has no package-registry access to run Prisma CLI.

A fourth thing was *discovered but deliberately left alone*: consent witnessing is not part
of the sign-off completeness check (`SignoffService.getCompletenessBlocks()` only checks
`consent.signedAt`, never `witnessUserId`), and `ConsentService.sign()` advances the visit
to `IV_PREPARATION` immediately on signing — before witnessing happens. `ConsentPage.tsx`
is written to match that reality (witnessing stays reachable after the visit has moved on),
rather than the frontend inventing a gate the backend doesn't actually enforce.

## Step-to-status mapping

Each workflow screen is active while the visit is in a specific `VisitStatus`, and the
mapping was verified against every `VisitsService.transition()` call in the backend (one
grep across `src/**/*.service.ts`), not assumed from the PRD. See the header comment in
`src/features/visits/steps.ts` for the full chain — one entry (`PROTOCOL_SELECTED`) is
counter-intuitively named: that status means "ready to select a protocol *now*", not
"already selected", because `OrdersService.record()` transitions *to* it.

## Local development

This sandbox has no npm registry access, so none of this has been installed, built, or
run here — the code has had a careful manual read-through against the backend's actual
routes/DTOs/Prisma models instead of a tool-verified build. On a machine with registry
access:

```bash
npm install
npm run dev      # Vite dev server on :5173, proxying /api to the backend (default http://localhost:3000)
npm run lint
npm run build
```

Set `VITE_API_PROXY_TARGET` if the backend isn't on `localhost:3000`.

## Still required before this is production-ready

- Run the Prisma migration for the new `VitalSet` relation (above) against the backend.
- Visual design pass against the token system in `src/styles/tokens.css`.
- Real signature capture and MFA QR rendering.
- A frontend accessibility review per `docs/accessibility-note.md` in the backend repo —
  this sprint followed WCAG 2.1 AA practice (semantic HTML, labeled inputs, visible focus,
  `prefers-reduced-motion` respected, skip link) but has not been through a manual
  keyboard-only or screen-reader pass.
- Automated tests.
- A real build run (`npm run build`) and `tsc` type-check, once registry access exists —
  this code has not been compiled.
