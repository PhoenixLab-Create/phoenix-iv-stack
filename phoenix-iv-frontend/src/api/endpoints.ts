import { apiFetch, patientSessionFetch } from './client';
import type {
  Assessment,
  AdverseEvent,
  ConsentTemplate,
  Consent,
  DashboardSummary,
  IntakeFormRecord,
  IntakeFormVersion,
  IVInsertion,
  LoginResult,
  MonitoringEntry,
  Order,
  Patient,
  Product,
  Protocol,
  RecordAdverseEventInput,
  RecordAssessmentInput,
  RecordCompletionInput,
  RecordInsertionInput,
  RecordOrderInput,
  RecordPrepInput,
  RecordView,
  RegisterPatientInput,
  AddMonitoringEntryInput,
  ScreeningFlag,
  SelectProtocolInput,
  SignConsentInput,
  SignInput,
  Signoff,
  SignoffSummary,
  SubmitIntakeInput,
  TreatmentCompletion,
  Visit,
  VisitPreparation,
  VisitProtocolSelection,
} from './types';

// ---- Auth ----
export const AuthApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResult>('/auth/login', { method: 'POST', anonymous: true, body: { email, password } }),
  verifyMfa: (mfaChallengeToken: string, totpCode: string) =>
    apiFetch<LoginResult>('/auth/mfa/verify', { method: 'POST', anonymous: true, body: { mfaChallengeToken, totpCode } }),
  confirmEnrollment: (enrollmentToken: string, totpCode: string) =>
    apiFetch<LoginResult>('/auth/mfa/enroll/confirm', {
      method: 'POST',
      anonymous: true,
      body: { enrollmentToken, totpCode },
    }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
};

// ---- Patients ----
export const PatientsApi = {
  register: (input: RegisterPatientInput) => apiFetch<Patient>('/patients', { method: 'POST', body: input }),
  search: (q: string) => apiFetch<Patient[]>(`/patients?q=${encodeURIComponent(q)}`),
};

// ---- Visits ----
export const VisitsApi = {
  start: (patientId: string) => apiFetch<Visit>('/visits', { method: 'POST', body: { patientId } }),
  get: (visitId: string) => apiFetch<Visit>(`/visits/${visitId}`),
  issuePatientSession: (visitId: string) =>
    apiFetch<{ token: string; expiresAt: string }>(`/visits/${visitId}/patient-session`, { method: 'POST' }),
  cancel: (visitId: string, reason?: string) =>
    apiFetch<Visit>(`/visits/${visitId}/transition`, { method: 'POST', body: { to: 'CANCELLED', reason } }),
};

// ---- Intake ----
export const IntakeApi = {
  getFormAsStaff: (visitId: string) => apiFetch<IntakeFormVersion>(`/visits/${visitId}/intake/form/staff`),
  getFormAsPatient: (visitId: string, sessionToken: string) =>
    patientSessionFetch<IntakeFormVersion>(`/visits/${visitId}/intake/form`, sessionToken),
  get: (visitId: string) => apiFetch<IntakeFormRecord>(`/visits/${visitId}/intake`),
  submitAsPatient: (visitId: string, sessionToken: string, input: SubmitIntakeInput) =>
    patientSessionFetch<IntakeFormRecord>(`/visits/${visitId}/intake`, sessionToken, { method: 'POST', body: input }),
  submitAsStaff: (visitId: string, input: SubmitIntakeInput) =>
    apiFetch<IntakeFormRecord>(`/visits/${visitId}/intake/staff-entry`, { method: 'POST', body: input }),
};

// ---- Screening ----
export const ScreeningApi = {
  run: (visitId: string) => apiFetch<ScreeningFlag[]>(`/visits/${visitId}/screening/run`, { method: 'POST' }),
  listFlags: (visitId: string) => apiFetch<ScreeningFlag[]>(`/visits/${visitId}/screening/flags`),
  acknowledge: (visitId: string, flagId: string, clinicianResponse: string) =>
    apiFetch<ScreeningFlag>(`/visits/${visitId}/screening/flags/${flagId}/acknowledge`, {
      method: 'POST',
      body: { clinicianResponse },
    }),
  complete: (visitId: string) => apiFetch<Visit>(`/visits/${visitId}/screening/complete`, { method: 'POST' }),
};

// ---- Assessment ----
export const AssessmentApi = {
  record: (visitId: string, input: RecordAssessmentInput) =>
    apiFetch<Assessment>(`/visits/${visitId}/assessment`, { method: 'POST', body: input }),
};

// ---- Orders ----
export const OrdersApi = {
  record: (visitId: string, input: RecordOrderInput) =>
    apiFetch<Order>(`/visits/${visitId}/order`, { method: 'POST', body: input }),
};

// ---- Protocols ----
export const ProtocolsApi = {
  list: () => apiFetch<Protocol[]>('/protocols'),
  select: (visitId: string, input: SelectProtocolInput) =>
    apiFetch<VisitProtocolSelection>(`/visits/${visitId}/protocol`, { method: 'POST', body: input }),
};

// ---- Consent ----
export const ConsentApi = {
  getTemplate: (visitId: string) => apiFetch<ConsentTemplate>(`/visits/${visitId}/consent/template`),
  getTemplateAsPatient: (visitId: string, sessionToken: string) =>
    patientSessionFetch<ConsentTemplate>(`/visits/${visitId}/consent/template/patient`, sessionToken),
  get: (visitId: string) => apiFetch<Consent>(`/visits/${visitId}/consent`),
  signAsPatient: (visitId: string, sessionToken: string, input: SignConsentInput) =>
    patientSessionFetch<Consent>(`/visits/${visitId}/consent`, sessionToken, { method: 'POST', body: input }),
  witness: (visitId: string) => apiFetch<Consent>(`/visits/${visitId}/consent/witness`, { method: 'POST' }),
};

// ---- Prep ----
export const PrepApi = {
  listProducts: () => apiFetch<Product[]>('/products'),
  record: (visitId: string, input: RecordPrepInput) =>
    apiFetch<VisitPreparation>(`/visits/${visitId}/prep`, { method: 'POST', body: input }),
  get: (visitId: string) => apiFetch<VisitPreparation>(`/visits/${visitId}/prep`),
};

// ---- Insertion ----
export const InsertionApi = {
  record: (visitId: string, input: RecordInsertionInput) =>
    apiFetch<IVInsertion>(`/visits/${visitId}/insertion`, { method: 'POST', body: input }),
  get: (visitId: string) => apiFetch<IVInsertion>(`/visits/${visitId}/insertion`),
};

// ---- Monitoring ----
export const MonitoringApi = {
  addEntry: (visitId: string, input: AddMonitoringEntryInput) =>
    apiFetch<MonitoringEntry>(`/visits/${visitId}/monitoring/entries`, { method: 'POST', body: input }),
  list: (visitId: string) => apiFetch<MonitoringEntry[]>(`/visits/${visitId}/monitoring/entries`),
  complete: (visitId: string) => apiFetch<Visit>(`/visits/${visitId}/monitoring/complete`, { method: 'POST' }),
};

// ---- Adverse events ----
export const AdverseEventApi = {
  record: (visitId: string, input: RecordAdverseEventInput) =>
    apiFetch<AdverseEvent>(`/visits/${visitId}/adverse-events`, { method: 'POST', body: input }),
  list: (visitId: string) => apiFetch<AdverseEvent[]>(`/visits/${visitId}/adverse-events`),
};

// ---- Completion ----
export const CompletionApi = {
  record: (visitId: string, input: RecordCompletionInput) =>
    apiFetch<TreatmentCompletion>(`/visits/${visitId}/completion`, { method: 'POST', body: input }),
  get: (visitId: string) => apiFetch<TreatmentCompletion>(`/visits/${visitId}/completion`),
};

// ---- Sign-off ----
export const SignoffApi = {
  summary: (visitId: string) => apiFetch<SignoffSummary>(`/visits/${visitId}/signoff/summary`),
  sign: (visitId: string, input: SignInput) =>
    apiFetch<Signoff>(`/visits/${visitId}/signoff`, { method: 'POST', body: input }),
};

// ---- Record ----
export const RecordApi = {
  get: (visitId: string) => apiFetch<RecordView>(`/visits/${visitId}/record`),
  pdfUrl: (visitId: string) => `/api/visits/${visitId}/record/pdf`,
};

// ---- Dashboard ----
export const DashboardApi = {
  get: () => apiFetch<DashboardSummary>('/dashboard'),
};
