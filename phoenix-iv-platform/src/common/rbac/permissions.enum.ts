// Permission keys — these are rows in the `permissions` table, granted to
// roles via `role_permissions`. Keeping the enum here gives compile-time
// safety when referencing them in @RequirePermission(...) decorators; the
// source of truth for what a role actually has is still the database.
export enum Permission {
  PATIENT_REGISTER = 'patient.register',
  PATIENT_SEARCH = 'patient.search',
  VISIT_START = 'visit.start',
  VISIT_VIEW_STATUS = 'visit.view.status', // non-clinical: status/progress only
  VISIT_VIEW_CLINICAL = 'visit.view.clinical', // full clinical content
  ASSESSMENT_RECORD = 'assessment.record',
  ORDER_RECORD = 'order.record',
  PROTOCOL_SELECT = 'protocol.select',
  INTAKE_RECORD = 'intake.record', // staff-on-behalf-of-patient intake entry (fallback path)
  SCREENING_ACKNOWLEDGE = 'screening.acknowledge',
  CONSENT_WITNESS = 'consent.witness',
  PREP_RECORD = 'prep.record',
  INSERTION_RECORD = 'insertion.record',
  MONITORING_RECORD = 'monitoring.record',
  ADVERSE_EVENT_RECORD = 'adverse_event.record',
  COMPLETION_RECORD = 'completion.record',
  VISIT_SIGN = 'visit.sign',
  AMENDMENT_CREATE = 'amendment.create',
  AMENDMENT_APPROVE = 'amendment.approve',
  SETTINGS_MANAGE = 'settings.manage', // includes admin_clinical_visibility
  USER_MANAGE = 'user.manage',
  AUDIT_VIEW = 'audit.view',
  BREAK_GLASS = 'break_glass.use',
}
