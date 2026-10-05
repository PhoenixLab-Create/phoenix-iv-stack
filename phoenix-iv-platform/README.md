# Phoenix IV Therapy Documentation Platform — Backend (Sprints 1–6)

Documentation and workflow tool for Phoenix Medical Aesthetics (Ontario). This is a
**clinical documentation system, not a diagnostic or prescribing system.** It never
invents clinical rules, protocols, doses, or eligibility decisions — those come from
clinic-supplied configuration.

## Scope of this drop (Sprints 1–6 — full PRD workflow + hardening)

| Area | Status |
|---|---|
| Infra-as-code (Azure, Terraform) | Skeleton provided — needs clinic's subscription/tenant details |
| CI/CD (GitHub Actions) | Working pipeline: lint → test → build → (plan-only) terraform |
| Auth + MFA | Real argon2id + TOTP (otplib). **No code path issues a session without a verified TOTP code** — enrollment is mandatory, not optional, enforced in `AuthService` |
| RBAC | Real guard/decorator, `admin_clinical_visibility` flag, care-relationship check, audited break-glass |
| Audit framework | Insert-only, hash-chained audit log, applied globally via interceptor |
| Patient / Visit core | Visit state machine enforcing the exact PRD step order; immutable once signed |
| Patient sessions (no accounts) | `PatientSessionService` + `PatientSessionGuard` — single-visit, time-limited tokens issued only by staff |
| Intake questionnaire | Versioned `FormVersion` schema (EAV-style answers) — patient self-serve or staff-on-behalf, both distinctly recorded |
| Screening rule engine | Declarative JSON rule grammar, no `eval`, matched against intake; produces flags only, never an eligibility verdict |
| Clinician assessment | Baseline vitals + decision; blocks on unacknowledged screening flags |
| Order authorization | Directive or patient-specific order recording |
| Protocol selection | Clinic-approved catalog only; custom infusions require typed prescriber order details |
| Consent e-sign | Versioned template, placeholder-substitution rendering (no conditional logic), **patient-only** signing (no staff-on-behalf path, by explicit decision), separate witness step |
| IV preparation | Base solution + ingredients with lot/expiry; **an expired lot hard-blocks the save unless an explicit override reason is given** — never silently allowed or silently blocked |
| IV insertion | Site/side/gauge/attempts/outcome; an unsuccessful attempt is still documented, not hidden |
| Infusion monitoring | Timed vitals + observation entries; **"not tolerating" automatically opens the adverse-event path** (the one PRD-specified auto-routing in the system) — this changes which screen comes next, nothing clinical |
| Adverse event | Pure documentation of what happened and what the clinician did; no emergency-protocol logic or suggested interventions live in this code at all |
| Treatment completion | Cross-checks the adverse-event flag against actual adverse-event records so the final record can't contradict itself; requires aftercare confirmation before completion |

Functionally, the PRD's full visit workflow — Registration → Intake → Screening → Assessment → Order → Protocol → Consent → Prep → Insertion → Monitoring → (Adverse Event) → Completion → Sign-Off → Final Record (with amendments) — is implemented end to end, backed by tests, with no clinical content invented anywhere in the code. Sprint 6 closes the hardening items flagged against that workflow (below) — it does not add new clinical screens.

### Sign-off, amendments, record rendering, dashboard (Sprint 5)

| Area | What it does |
|---|---|
| Sign-off completeness gate | Walks every prior step and reports *documentation* gaps only ("3 unacknowledged screening flags", "Consent not signed") — never a clinical judgment. `visit.status` can **only** reach `SIGNED` through this gate; a safety gap where the old generic transition endpoint could set `status=SIGNED` without ever setting `signedAt` was found and closed in this sprint (see `VisitsService.transition()` and the new test asserting it) |
| Record hashing | The canonical record is hashed (SHA-256, key-order-independent) at the exact moment of signing, before the Signoff row exists, so the hash reflects what was true at sign time |
| Amendments | Whitelisted target tables only; requires a reason and the amending clinician's own signature; approval is a **separate insert-only row** (`AmendmentApproval`), not a mutable field — so the correction mechanism itself can never be silently edited. An approved amendment creates a new numbered record snapshot; the original signed data is never touched |
| Record rendering | One `RecordService` aggregates the full record and overlays only *approved* amendments for display — pending amendments are shown as pending, never silently applied. Both the JSON view and the PDF render from the same aggregation |
| PDF export | Real `pdfkit` implementation (`GET /visits/:visitId/record/pdf`) matching the PRD §16 Final Clinical Record sections 1–14, plus an amendment appendix when relevant |
| Dashboard | Deliberately minimal per the PRD ("don't overload the first version") — incomplete visits, completed visits, nothing else |
| Audit log viewer | Per-patient access report and hash-chain integrity check, both built on the audit framework from Sprint 1 that had no endpoint exposing them until now |

### Sprint 6 — hardening

| Area | What changed |
|---|---|
| Amendment old-value verification | **Closed.** `AmendmentsService.create()` no longer trusts the caller's claim about a field's prior value. It now re-reads the actual stored value (`readStoredValue()`), or the most recent *approved* amendment's new value if one exists (`getEffectiveCurrentValue()`, so corrections chain correctly), and rejects the request with the real value named in the error if the claim doesn't match. Proven by new tests in `amendments.service.spec.ts`. |
| Staff session revocation | **Closed.** Staff sessions were previously validated by JWT signature + expiry alone, so `logout` had no real effect until the token's TTL elapsed. Staff auth now mirrors the session-row pattern patient sessions already used since Sprint 3: `AuthService.issueTokens()` creates a `Session` row and embeds its id in the token; `JwtStrategy.validate()` checks the row isn't revoked/expired on every request and extends the idle window; new `POST /auth/logout` revokes it immediately; new `POST /auth/refresh` reissues an access token only for a still-valid session. Proven by `jwt.strategy.spec.ts` (new) and the new "session-backed revocation" tests in `auth.service.spec.ts`. |
| Security headers | Tightened beyond Helmet's defaults for a JSON-only API: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, HSTS at 2 years with `includeSubDomains`/`preload`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`. See `src/main.ts`. |
| Dependency hygiene | `.github/dependabot.yml` added — weekly npm (grouped minor/patch, individual security PRs), github-actions, and terraform (`/infra`) update checks, on top of the `npm audit --audit-level=high` CI gate that already existed. |
| Backup-restore drill | `scripts/backup-restore-drill.sh` is a real script: dumps the current (synthetic) database, restores it into a throwaway database, and verifies row counts match across `users`, `patients`, `visits`, `audit_log`, failing loudly on any mismatch. Wired into CI as its own job (`.github/workflows/ci.yml` → `backup-restore-drill`) so it runs on every push. **This proves the dump/restore mechanics, not Azure's own managed backup/restore path** — a real drill against the deployed Azure Database for PostgreSQL Flexible Server still needs to be run by ops, on a schedule, with sign-off recorded. |
| PIA / TRA scaffolding | `docs/PIA-checklist.md` and `docs/TRA-checklist.md` — blank checklist templates, each item pointing at the specific code that answers it. These are not completed assessments and are not legal or security advice; they exist so the privacy officer and a security reviewer have a concrete starting point. |
| Accessibility | `docs/accessibility-note.md` states plainly that Sprints 1–6 are backend-only, so there is no frontend yet to audit, and documents the AODA (WCAG 2.1 AA) obligations that will apply once one exists. The earlier standalone prototype HTML was never accessibility-reviewed and should not be treated as a preview. |

### Still required before real patient data

This drop closes every gap that was flagged and in scope for Sprint 6. It does **not** by itself make the system ready to hold real patient data. Before that happens, the clinic still needs: the PIA and TRA checklists above actually completed (not just scaffolded) and signed off by the privacy officer / a qualified security reviewer; an independent penetration test; a real backup-restore drill run by ops against the deployed Azure resource itself; and frontend accessibility work once a real frontend is built (`docs/accessibility-note.md`).

## Why NestJS + Prisma + PostgreSQL

- NestJS gives first-class support for guards/interceptors, which is where RBAC and the
  audit trail live — both are non-negotiable for a health record system.
- Prisma gives typed migrations and makes the "signed records are immutable" rule
  enforceable both at the DB level (revoked UPDATE/DELETE grants) and the application level.
- PostgreSQL on Azure Database for PostgreSQL – Flexible Server, Canada Central region,
  per the clinic's hosting decision.

## Local development setup

```bash
cp .env.example .env          # fill in local secrets; NEVER use real patient data locally
docker compose up -d          # starts local Postgres only — no cloud dependency needed to develop
npm install
npx prisma migrate dev
npm run start:dev
```

No step here talks to Azure. Local dev and CI both run against the dockerized Postgres,
with synthetic data only, matching the "PHI never leaves the clinic's approved
environment" security rule.

## Key design decisions encoded in this code (from the architecture review)

1. **Signed visits are immutable.** `visits.signed_at` being non-null blocks further writes
   to clinical child tables at the Prisma middleware layer (stubbed — see `TODO` in
   `src/visits`) and, in the real DB, via a `REVOKE UPDATE, DELETE` on the app role
   (`infra/sql/immutability.sql`, applied post-migration).
2. **`admin_clinical_visibility` is a config flag, not a role hard-code.** See
   `src/system-settings` and `RolesGuard`'s use of it.
3. **Every state transition and every read of patient data is audited**, including reads —
   see `AuditInterceptor`.
4. **No dosing or clinical-rule logic exists in code.** Protocols, doses, and screening
   rules are rows in config tables owned by the Medical Director role, not constants in
   source.

## Still needed from Phoenix Medical Aesthetics before this can hold real data

Same Phase 0 list as the architecture review: approved protocol doses/units, screening
rule wording, consent + aftercare final text, emergency protocol text, retention policy,
privacy officer contact, Azure tenant/subscription details for `infra/`.

All of the above are seeded in `prisma/seed.ts` as **inactive, clearly-marked placeholder
rows** (sample screening rule, sample protocol names with no doses, sample consent text)
so CI and local dev have something to exercise the engines against. None of them can
become live without a real admin flipping `active`/`approvedAt` — and the app never does
that automatically.
