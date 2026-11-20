import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute, { GuestRoute } from "./components/layout/ProtectedRoute";
import { pensionerNav, adminNav } from "./config/navigation";
import { homeFor, useAuth } from "./context/AuthContext";
import { useI18n } from "./context/PreferencesContext";
import { Spinner } from "./components/ui";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import NotFoundPage from "./pages/NotFoundPage";

import DashboardPage from "./pages/pensioner/DashboardPage";
import PaymentsPage from "./pages/pensioner/PaymentsPage";
import WithdrawalsPage from "./pages/pensioner/WithdrawalsPage";
import WithdrawalDetailPage from "./pages/pensioner/WithdrawalDetailPage";
import BankAccountsPage from "./pages/pensioner/BankAccountsPage";
import NomineesPage from "./pages/pensioner/NomineesPage";
import LifeVerificationPage from "./pages/pensioner/LifeVerificationPage";
import StatementsPage from "./pages/pensioner/StatementsPage";
import AssistantPage from "./pages/pensioner/AssistantPage";
import SupportPage from "./pages/pensioner/SupportPage";
import NotificationsPage from "./pages/shared/NotificationsPage";
import ProfilePage from "./pages/shared/ProfilePage";

import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import PensionersPage from "./pages/admin/PensionersPage";
import PensionerDetailPage from "./pages/admin/PensionerDetailPage";
import RegistryPage from "./pages/admin/RegistryPage";
import BankVerificationsPage from "./pages/admin/BankVerificationsPage";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import LifeVerificationsPage from "./pages/admin/LifeVerificationsPage";
import AdminNomineesPage from "./pages/admin/AdminNomineesPage";
import ComplaintsPage from "./pages/admin/ComplaintsPage";
import ReportsPage from "./pages/admin/ReportsPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

function RootRedirect() {
  const { user, initializing } = useAuth();
  if (initializing) return <div style={{ paddingTop: "30vh" }}><Spinner /></div>;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}

export default function App() {
  const { t } = useI18n();
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      {/* Pensioner portal */}
      <Route
        path="/app"
        element={
          <ProtectedRoute roles={["Pensioner"]}>
            <AppShell sections={pensionerNav} basePath="/app" portalLabel={t("role.Pensioner")} showAssistant />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="withdrawals/:id" element={<WithdrawalDetailPage />} />
        <Route path="bank-accounts" element={<BankAccountsPage />} />
        <Route path="nominees" element={<NomineesPage />} />
        <Route path="life-verification" element={<LifeVerificationPage />} />
        <Route path="statements" element={<StatementsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin portal */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["Admin", "SuperAdmin"]}>
            <AppShell sections={adminNav} basePath="/admin" portalLabel={t("role.Admin")} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="pensioners" element={<PensionersPage />} />
        <Route path="pensioners/:id" element={<PensionerDetailPage />} />
        <Route path="registry" element={<RegistryPage />} />
        <Route path="registrations" element={<Navigate to="/admin/registry" replace />} />
        <Route path="bank-verifications" element={<BankVerificationsPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="life-verifications" element={<LifeVerificationsPage />} />
        <Route path="nominees" element={<AdminNomineesPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<ProtectedRoute roles={["SuperAdmin"]}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
