# Privacy Impact Assessment — Checklist Template

**This is a BLANK TEMPLATE. It is not a completed PIA, and completing it is
not legal advice.** A PIA for a system holding PHI under Ontario's *Personal
Health Information Protection Act* (PHIPA) should be conducted or reviewed
by the clinic's privacy officer, and for anything borderline, by counsel
familiar with PHIPA and the Information and Privacy Commissioner of
Ontario's (IPC) guidance. This document exists to make that process
concrete by pointing each question at the specific code that answers it
today — not to answer the questions itself.

Each item below should be answered, dated, and signed off by the privacy
officer before this system handles real patient data.

---

## 1. Project description

- [ ] What personal health information does this system collect, and why?
      (See `prisma/schema.prisma` — `Patient`, `Intake*`, `Screening*`,
      `Assessment`, `Order`, `Consent*`, `IvInsertion`,
      `InfusionMonitoringEntry`, `AdverseEvent`, `TreatmentCompletion`
      models.)
- [ ] Who is the data controller (the clinic) and who, if anyone, is a
      data processor (e.g. the hosting provider)?
- [ ] Is this a new system, or does it replace an existing paper/other
      electronic process? What happens to records from the prior process?

## 2. Legal authority

- [ ] Under what PHIPA authority is each category of information
      collected, used, and disclosed (e.g. s.29 consent, s.36-38 permitted
      collection/use/disclosure)?
- [ ] Has the minimum-necessary-collection principle been applied to every
      field in the intake/screening forms (`prisma/seed.ts` —
      `FormVersion` schema)? Is any field collected that isn't needed for
      clinical or operational purposes?
- [ ] Is the consent captured by `src/consent` sufficient, under PHIPA, for
      each use this system actually makes of the data (treatment,
      scheduling, audit, aftercare)? (Clinic/legal to confirm — this system
      does not interpret consent scope.)

## 3. Data flows

- [ ] Map every point data enters the system (staff entry, patient portal
      session — see `src/auth/patient-session.guard.ts`), leaves it (PDF
      export — `src/record` — email/print by staff), or is processed by a
      third party (none currently integrated; confirm before adding any).
- [ ] Confirm no PHI is sent to an external AI service. (At present, no
      such integration exists in this codebase — search for any future
      addition before relying on this answer continuing to hold.)
- [ ] Where is data physically hosted, and does that meet the clinic's
      residency requirements? (`infra/main.tf` targets Azure Canada
      Central — confirm the actual deployed region matches.)

## 4. Access controls

- [ ] Does the role/permission model (`prisma/schema.prisma` — `Role`,
      `Permission`, `RolePermission`, `UserRole`; enforced by
      `src/auth/permissions.guard.ts`) match the clinic's actual staff
      roles and the minimum access each role needs?
- [ ] Is the `admin_clinical_visibility` system setting (see
      `src/settings`) configured the way the clinic intends — and who is
      authorized to change it?
- [ ] Is the care-relationship check (clinician can only act on visits
      assigned to them) and its audited break-glass override
      (`src/auth/permissions.guard.ts`) reviewed and are overrides
      monitored?

## 5. Retention and disposal

- [ ] What is the clinic's retention period for clinical records under
      the applicable College of Nurses of Ontario (CNO) / College
      standards, and is it configured anywhere, or only a manual process?
      (This system currently has no automated retention/disposal — confirm
      whether one is required before go-live.)
- [ ] Soft-delete is used for clinical data (never hard delete) — confirm
      this matches the clinic's record-retention obligations rather than
      creating an unintended "keep forever" default.

## 6. Patient rights

- [ ] How does a patient request access to, or correction of, their own
      record under PHIPA s.52-55? Does the amendment workflow
      (`src/amendments`) map to this, and does staff know the process?
- [ ] How is a patient's withdrawal of consent, or a request to stop
      future collection, handled operationally? (Not currently an
      automated workflow in this system — confirm if one is needed.)

## 7. Breach response

- [ ] Is there a documented breach-notification procedure matching PHIPA's
      mandatory notification requirements (to the patient and, where
      required, the IPC)?
- [ ] Does the audit log (`src/audit`, hash-chained `AuditEntry` model)
      give the clinic enough information to investigate a suspected
      breach (who accessed what, when)? Walk through a tabletop breach
      scenario against the actual audit-log viewer.

## 8. Vendor / processor agreements

- [ ] If hosting is Azure, is there an executed agreement with Microsoft
      addressing PHIPA-compliant handling of personal health information
      (e.g. a Business Associate-equivalent commitment, data residency,
      breach notification obligations)?
- [ ] Are there any other third-party services in the dependency tree
      that process PHI, even transiently? (Review `package.json` and any
      future integrations.)

## 9. Sign-off

- [ ] Privacy officer name, date, and signature.
- [ ] Any outstanding items, with an owner and a target date.
- [ ] Date this PIA is scheduled for review/renewal (e.g. annually or on
      material system change).
