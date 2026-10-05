import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import RegisterPatientPage from '../features/patients/RegisterPatientPage';
import VisitLayout from '../features/visits/VisitLayout';
import IntakeStaffPage from '../features/visits/steps/IntakeStaffPage';
import ScreeningPage from '../features/visits/steps/ScreeningPage';
import AssessmentPage from '../features/visits/steps/AssessmentPage';
import OrderPage from '../features/visits/steps/OrderPage';
import ProtocolPage from '../features/visits/steps/ProtocolPage';
import ConsentPage from '../features/visits/steps/ConsentPage';
import PrepPage from '../features/visits/steps/PrepPage';
import InsertionPage from '../features/visits/steps/InsertionPage';
import MonitoringPage from '../features/visits/steps/MonitoringPage';
import AdverseEventPage from '../features/visits/steps/AdverseEventPage';
import CompletionPage from '../features/visits/steps/CompletionPage';
import SignoffPage from '../features/visits/steps/SignoffPage';
import RecordPage from '../features/visits/steps/RecordPage';
import PatientIntakePage from '../features/patient/PatientIntakePage';
import PatientConsentPage from '../features/patient/PatientConsentPage';

export default function App() {
  return (
    <Routes>
      {/* Patient-facing: no staff login, authenticated by a single-visit session token in the URL. */}
      <Route path="/patient/:visitId/intake" element={<PatientIntakePage />} />
      <Route path="/patient/:visitId/consent" element={<PatientConsentPage />} />

      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/patients/new" element={<RegisterPatientPage />} />

          <Route path="/visits/:visitId" element={<VisitLayout />}>
            <Route path="intake" element={<IntakeStaffPage />} />
            <Route path="screening" element={<ScreeningPage />} />
            <Route path="assessment" element={<AssessmentPage />} />
            <Route path="order" element={<OrderPage />} />
            <Route path="protocol" element={<ProtocolPage />} />
            <Route path="consent" element={<ConsentPage />} />
            <Route path="prep" element={<PrepPage />} />
            <Route path="insertion" element={<InsertionPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="adverse-event" element={<AdverseEventPage />} />
            <Route path="completion" element={<CompletionPage />} />
            <Route path="signoff" element={<SignoffPage />} />
            <Route path="record" element={<RecordPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
