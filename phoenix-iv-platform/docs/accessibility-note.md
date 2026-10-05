# Accessibility status (honest note)

**Sprints 1–6 of this engagement are backend-only.** There is no production
frontend in this repository — `src/` is a NestJS API. There is nothing here
for an accessibility audit to test yet, and this note should not be read as
one.

## What exists today

- The backend API (`src/`) has no UI, so WCAG/AODA success criteria that
  apply to rendered interfaces (focus order, color contrast, screen-reader
  labeling, keyboard operability, etc.) don't yet have anything to measure.
- The original standalone prototype
  (`phoenix_iv_prototype.html`, delivered earlier in this engagement as a
  clickable mockup with synthetic data) was built to validate workflow and
  screen sequencing, **not** for accessibility. It has never been reviewed
  against WCAG or AODA and should not be treated as a preview of the real
  frontend's accessibility posture, or reused as production code.

## Obligations that will apply once a real frontend exists

Ontario's *Accessibility for Ontarians with Disabilities Act* (AODA), under
the Information and Communications Standard, requires designated
organizations' public-facing and (depending on size) internal web content
to conform to **WCAG 2.1 Level AA**. For a clinic-facing and
patient-facing clinical system, this should be treated as a hard
requirement, not best-effort:

- Patient-facing screens (intake, consent, any patient-session flows) are
  used by people who may have visual, motor, cognitive, or situational
  impairments, including in a clinical setting where a patient may be
  unwell — accessibility here is also a patient-safety concern, not only a
  compliance one.
- Staff-facing screens (clinician/nurse workflow, admin dashboards) still
  fall under AODA obligations for organizations of the clinic's size, and
  good accessibility (clear focus states, operable by keyboard, readable
  under glove/low-light clinical conditions) also reduces documentation
  errors.

## What should happen before a real frontend ships

1. Build the frontend against WCAG 2.1 AA from the start — retrofitting
   accessibility after screens are built is far more expensive than
   designing for it from the first component.
2. Include automated accessibility testing (e.g. axe-core) in CI alongside
   the existing lint/test/build pipeline (`.github/workflows/ci.yml`), the
   same way `npm audit` is already gated there for dependency security.
3. Commission a manual accessibility review (keyboard-only pass,
   screen-reader pass with at least one real screen reader, color-contrast
   check) before go-live — automated tools catch a minority of real issues.
4. Revisit this note and replace it with an actual conformance report once
   there is a frontend to report on.
