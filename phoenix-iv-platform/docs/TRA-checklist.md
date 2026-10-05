# Threat Risk Assessment — Checklist Template

**This is a BLANK TEMPLATE. It is not a completed TRA, a penetration test,
or a security audit, and nothing in it is legal advice.** A system handling
PHI should have an independent security review before going live with real
patient data. This document points each question at the specific code that
answers it today, so a reviewer has a starting point — it does not
substitute for that reviewer's own judgment.

Each item should be answered, dated, and signed off before go-live, and
re-reviewed on material changes to auth, data handling, or infrastructure.

---

## 1. Assets in scope

- [ ] Enumerate what's actually at risk: patient PHI (all clinical
      models in `prisma/schema.prisma`), staff credentials, the signed
      clinical record and its hash chain (`src/audit`, `src/record`),
      the infrastructure itself (`infra/main.tf`).
- [ ] Confirm no production secrets (DB credentials, JWT signing keys)
      exist in source control — check `.env.example` only contains
      placeholders, and Key Vault (`infra/main.tf`) is actually wired to
      the deployed app, not just planned.

## 2. Authentication

- [ ] Review `src/auth/auth.service.ts` — password hashing (argon2id),
      MFA enrollment/challenge flow (`src/auth/mfa.service.ts`), and the
      fix proven by `auth.service.spec.ts` ("MFA gap is closed" describe
      block) that no path returns tokens without a verified TOTP code for
      an enrolled user.
- [ ] Review patient-session authentication (`src/auth/patient-session.guard.ts`)
      — sessions, not accounts, per the architecture decision; confirm the
      session-issuance flow can't be abused to impersonate a patient.
- [ ] Confirm rate limiting / throttling on login, refresh, and MFA
      endpoints (`@nestjs/throttler` usage in `src/auth/auth.controller.ts`)
      is tuned appropriately for production, not just CI defaults.

## 3. Authorization

- [ ] Review `src/auth/permissions.guard.ts` — does every sensitive
      endpoint declare the correct `@Permission` requirements? Spot-check
      a sample of controllers against the permission matrix in the
      architecture review.
- [ ] Review the care-relationship check and its break-glass override —
      is the override sufficiently rare, loud (audited), and reviewable?
- [ ] Review the `admin_clinical_visibility` setting
      (`src/settings`) — confirm it can't be changed by a role that
      shouldn't be able to, and that the default matches clinic policy.

## 4. Session management

- [ ] Review `src/auth/jwt.strategy.ts` and `src/auth/auth.service.ts` —
      session-row-backed revocation (Sprint 6): confirm `logout()` and
      admin-initiated revocation take effect immediately (proven by
      `jwt.strategy.spec.ts` and the "session-backed revocation" describe
      block in `auth.service.spec.ts`), and that idle timeouts
      (`STAFF_IDLE_TIMEOUT_SECONDS`) match the architecture review's
      15-minute staff / 5-minute patient figures in production
      configuration.
- [ ] Confirm refresh tokens can't be replayed after logout (same
      session-row check applies to `refresh()`).

## 5. Data integrity

- [ ] Review `infra/sql/immutability.sql` — confirm the DB triggers
      actually reject UPDATE/DELETE on signed-visit child rows and on
      `audit_log`/`amendments`/`amendment_approvals`/`record_snapshots`,
      by testing directly against the database, not just through the
      application layer.
- [ ] Review the visit state machine (`src/visits/visit-state-machine.ts`)
      — confirm `SIGNED` is reachable only via `SignoffService.sign()`,
      and that the generic `transition()` rejection of `to: 'SIGNED'` is
      still in place (regression-test this specifically after any future
      change to `src/visits`).
- [ ] Review `src/audit` — hash-chain verification
      (`AuditService.verifyChainIntegrity()`); run it against a production
      snapshot periodically, not only in tests.
- [ ] Review `src/amendments/amendments.service.ts` — confirm the
      old-value verification (`getEffectiveCurrentValue`/`readStoredValue`)
      closes the gap it was built for: an amendment cannot be recorded
      against a claimed "old value" that doesn't match what's actually
      stored.

## 6. Input handling / injection

- [ ] Confirm every endpoint uses a DTO with `class-validator` decorators
      and that `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
      true })` in `src/main.ts` is not bypassed anywhere.
- [ ] Review the screening-rule evaluator (`src/screening/rule-evaluator.ts`
      or equivalent) — confirm it is genuinely `eval`-free and that the
      JSON rule grammar cannot be abused to reach arbitrary code
      execution, however a rule is authored.
- [ ] Confirm Prisma's parameterized queries are used throughout — flag
      any raw SQL (`$queryRaw`/`$executeRaw`) for extra review.

## 7. Infrastructure

- [ ] Review `infra/main.tf` — Postgres Flexible Server network rules
      (is it reachable from the public internet, or only from the
      Container App's subnet?), Key Vault access policies, Log Analytics
      retention.
- [ ] Confirm TLS is enforced everywhere (DB connections, the app's own
      HTTPS termination) — not just assumed.
- [ ] Review `src/main.ts` helmet configuration (CSP `default-src 'none'`,
      HSTS, referrer policy, CORP) — confirm it matches what's actually
      deployed and that CORS (`CORS_ORIGIN`) is locked to real origins in
      production, never `*` or unset.

## 8. Dependencies

- [ ] Review `.github/dependabot.yml` and CI's `npm audit --audit-level=high`
      step (`.github/workflows/ci.yml`) — confirm they're actually
      catching things (check recent Dependabot PRs have been reviewed,
      not just opened and ignored).
- [ ] Run a full `npm audit` (not just `--audit-level=high`) and triage
      every finding, including moderate/low, before go-live.

## 9. Sign-off

- [ ] Reviewer name, date, and signature.
- [ ] Any outstanding findings, with severity, owner, and target date.
- [ ] Recommendation: has an independent penetration test been scheduled
      or completed? (This checklist is not one.)
