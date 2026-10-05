/**
 * Types mirrored directly from the backend DTOs and Prisma schema
 * (phoenix-iv-platform/src/**​/*.controller.ts, prisma/schema.prisma).
 * Kept in one file so a backend contract change is one obvious place to
 * update on this side too.
 */

export type VisitStatus =
  | 'REGISTERED'
  | 'INTAKE'
  | 'SAFETY_SCREENING'
  | 'CLINICIAN_ASSESSMENT'
  | 'ORDER_AUTHORIZATION'
  | 'PROTOCOL_SELECTED'
  | 'CONSENT'
  | 'IV_PREPARATION'
  | 'IV_INSERTION'
  | 'INFUSION_MONITORING'
  | 'ADVERSE_EVENT'
  | 'TREATMENT_COMPLETION'
  | 'PENDING_SIGNOFF'
  | 'SIGNED'
  | 'NOT_PROCEEDING'
  | 'CANCELLED';

export interface VisitStatusHistoryEntry {
  id: string;
  visitId: string;
  toStatus: VisitStatus;
  changedBy: string;
  changedAt: string;
}

export interface Visit {
  id: string;
  patientId: string;
  status: VisitStatus;
  assignedClinicianId?: string | null;
  startedAt: string;
  signedAt?: string | null;
  statusHistory: VisitStatusHistoryEntry[];
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO 8601 date
  address?: string;
  phone?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

// ---- Auth ----

export type LoginResult =
  | { status: 'MFA_REQUIRED'; mfaChallengeToken: string }
  | { status: 'MFA_ENROLLMENT_REQUIRED'; enrollmentToken: string; otpAuthUrl: string }
  | { status: 'OK'; accessToken: string; refreshToken: string };

export interface CurrentStaffUser {
  id: string;
  roles: string[];
  permissions: string[];
}

// ---- Intake ----

export interface MedicationInput {
  name: string;
  dose?: string;
  frequency?: string;
}

export interface AllergyInput {
  hasAllergy: boolean;
  description?: string;
}

export interface SubmitIntakeInput {
  answers: Record<string, unknown>;
  medications: MedicationInput[];
  allergy: AllergyInput;
}

export interface IntakeQuestion {
  key: string;
  label: string;
  type: 'boolean' | 'text' | 'number' | 'select';
  options?: string[];
}

export interface IntakeFormVersion {
  id: string;
  version: number;
  schema: IntakeQuestion[];
}

export interface IntakeAnswerRecord {
  id: string;
  questionKey: string;
  answerValue: unknown;
}

export interface IntakeMedicationRecord {
  id: string;
  name: string;
  dose?: string | null;
  frequency?: string | null;
}

export interface IntakeAllergyRecord {
  id: string;
  hasAllergy: boolean;
  description?: string | null;
}

export interface IntakeFormRecord {
  visitId: string;
  formVersionId: string;
  submittedAt?: string | null;
  submittedByKind: 'patient' | 'staff_on_behalf';
  answers: IntakeAnswerRecord[];
  medications: IntakeMedicationRecord[];
  allergies: IntakeAllergyRecord[];
  formVersion: IntakeFormVersion;
}

// ---- Screening ----
// A flag's clinic-authored message lives on its ScreeningRule, not on the
// flag row itself — ScreeningFlag just records that the rule fired for
// this visit, and whether/how a clinician has responded.

export interface ScreeningRule {
  id: string;
  version: number;
  message: string;
}

export interface ScreeningFlag {
  id: string;
  visitId: string;
  ruleId: string;
  ruleVersion: number;
  raisedAt: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  clinicianResponse?: string | null;
  rule: ScreeningRule;
}

// ---- Assessment ----

export interface VitalsInput {
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  respRate?: number;
  temperature?: number;
  spo2?: number;
}

export interface RecordAssessmentInput {
  reasonForVisit: string;
  notes?: string;
  decision: 'Proceed' | 'Do not proceed';
  vitals: VitalsInput;
}

export interface Assessment {
  visitId: string;
  reasonForVisit: string;
  notes?: string | null;
  decision?: 'Proceed' | 'Do not proceed' | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
}

// ---- Orders ----

export interface RecordOrderInput {
  orderType: 'directive' | 'patient_specific';
  directiveRefId?: string;
  prescriberName?: string;
  prescriberCollegeNo?: string;
  orderDetails?: string;
}

export interface Order extends RecordOrderInput {
  visitId: string;
  orderedAt: string;
}

// ---- Protocols ----

export interface Protocol {
  id: string;
  version: number;
  name: string;
  description?: string | null;
  isCustom: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  active: boolean;
}

export interface SelectProtocolInput {
  protocolId: string;
  customDetails?: string;
}

export interface VisitProtocolSelection {
  visitId: string;
  protocolId: string;
  customDetails?: string | null;
  selectedBy: string;
  selectedAt: string;
  protocol: Protocol;
}

// ---- Consent ----

export interface ConsentTemplate {
  id: string;
  version: number;
  body: string;
  approvedBy: string;
  effectiveFrom: string;
}

export interface SignConsentInput {
  patientName: string;
  signatureBlobRef: string;
  questionsAnsweredConfirmed: boolean;
}

export interface Consent {
  visitId: string;
  templateVersionId: string;
  renderedTextSnapshot: string;
  patientName: string;
  signatureBlobRef?: string | null;
  signedAt?: string | null;
  witnessUserId?: string | null;
  questionsAnsweredConfirmed: boolean;
}

// ---- Prep ----

export interface PrepItemInput {
  productId: string;
  doseValue: number;
  doseUnit: string;
  lotId: string;
  isAdditional?: boolean;
  addedReason?: string;
  expiredLotOverrideReason?: string;
}

export interface RecordPrepInput {
  baseProductId: string;
  baseVolumeMl: number;
  items: PrepItemInput[];
}

export interface VisitPrepItemRecord extends PrepItemInput {
  id: string;
  prepId: string;
}

export interface VisitPreparation {
  visitId: string;
  baseProductId: string;
  baseVolumeMl: number;
  preparedBy: string;
  preparedAt: string;
  items: VisitPrepItemRecord[];
}

export interface ProductLot {
  id: string;
  productId: string;
  lotNumber: string;
  expiryDate: string;
  receivedAt: string;
}

export interface Product {
  id: string;
  kind: 'BASE_SOLUTION' | 'INGREDIENT';
  name: string;
  active: boolean;
  lots: ProductLot[];
}

// ---- Insertion ----

export interface RecordInsertionInput {
  eventTime?: string;
  site: string;
  side: string;
  gauge: string;
  attempts: number;
  successful: boolean;
  siteCondition?: string;
  note?: string;
}

export interface IVInsertion extends RecordInsertionInput {
  visitId: string;
  insertedBy: string;
}

// ---- Monitoring ----

export interface AddMonitoringEntryInput {
  eventTime?: string;
  vitals?: VitalsInput;
  symptomsObservation?: string;
  tolerating: boolean;
}

export interface VitalSet {
  id: string;
  visitId: string;
  phase: 'BASELINE' | 'MONITORING' | 'FINAL';
  eventTime: string;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  heartRate?: number | null;
  respRate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  recordedBy: string;
}

export interface MonitoringEntry {
  id: string;
  visitId: string;
  eventTime: string;
  vitalSetId?: string | null;
  vitalSet?: VitalSet | null;
  symptomsObservation?: string | null;
  tolerating: boolean;
  recordedBy: string;
}

// ---- Adverse event ----

export interface RecordAdverseEventInput {
  onsetTime: string;
  signsSymptoms: string;
  infusionAction: 'stopped' | 'modified' | 'continued';
  vitals?: VitalsInput;
  interventions?: string;
  medicationGiven?: string;
  prescriberContacted?: string;
  prescriberContactedAt?: string;
  emsContacted: boolean;
  emsContactedAt?: string;
  patientResponse?: string;
  outcome: string;
  hospitalTransfer: boolean;
  resolution: 'resume_monitoring' | 'move_to_completion';
}

export interface AdverseEvent {
  id: string;
  visitId: string;
  onsetTime: string;
  signsSymptoms: string;
  infusionAction: 'stopped' | 'modified' | 'continued';
  vitalSetId?: string | null;
  interventions?: string | null;
  medicationGiven?: string | null;
  prescriberContacted?: string | null;
  prescriberContactedAt?: string | null;
  emsContacted: boolean;
  emsContactedAt?: string | null;
  patientResponse?: string | null;
  outcome?: string | null;
  hospitalTransfer: boolean;
  recordedBy: string;
  recordedAt: string;
}

// ---- Completion ----

export interface RecordCompletionInput {
  totalInfusedMl?: number;
  patientCondition?: string;
  catheterRemoved?: boolean;
  catheterIntact?: boolean;
  siteCondition?: string;
  dressingApplied?: boolean;
  adverseEventOccurred: boolean;
  aftercareProvided: boolean;
}

export interface TreatmentCompletion extends RecordCompletionInput {
  visitId: string;
  endTime: string;
  aftercareTemplateVersion?: string | null;
  recordedBy: string;
}

// ---- Sign-off ----
// Mirrors SignoffService.getSummary(): { canSign, blocks } where `blocks`
// is a list of plain-language documentation gaps (e.g. "3 unacknowledged
// screening flags"), never a clinical judgment.

export interface SignoffSummary {
  canSign: boolean;
  blocks: string[];
}

export interface SignInput {
  designation: string;
  signatureBlobRef: string;
}

export interface Signoff extends SignInput {
  visitId: string;
  signerId: string;
  signedAt: string;
  recordHash: string;
}

// ---- Record (final clinical record view) ----
// RecordService.getCurrentView() aggregates everything into one object for
// display; it's intentionally loosely typed here since its exact shape is
// an internal aggregation detail, not a stable contract to hard-code
// against. Consumers should treat it as read-only display data.
export type RecordView = Record<string, unknown>;

// ---- Dashboard ----
// Mirrors DashboardService.getSummary(): { incompleteVisits, completedVisits }.

export interface DashboardVisitSummary {
  visitId: string;
  patientName: string;
  status: VisitStatus;
  startedAt: string;
  signedAt?: string | null;
}

export interface DashboardSummary {
  incompleteVisits: DashboardVisitSummary[];
  completedVisits: DashboardVisitSummary[];
}
