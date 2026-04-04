import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './AuthContext';
import BottomNavBar from './components/BottomNavBar';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import WelcomePage from './pages/WelcomePage';
import LoyaltyHubPage from './pages/LoyaltyHubPage';
import SetupWizardPage from './pages/SetupWizardPage';
import InsightsPage from './pages/InsightsPage';
import ShowQRPage from './pages/ShowQRPage';
import ScanQRPage from './pages/ScanQRPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';

function MobileLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNavBar />
    </div>
  );
}

function FullPageLayout() {
  return (
    <div className="app-shell">
      <main className="app-main app-main-full">
        <Outlet />
      </main>
    </div>
  );
}

function HomePage() {
  const { program } = useAuth();
  return program ? <LoyaltyHubPage /> : <WelcomePage />;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <h2>{title}</h2>
      <p>Coming soon</p>
    </div>
  );
}

function RequireAuth() {
  const { merchant, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="loading-screen">{t('common.loading')}</div>;
  if (!merchant) return <Navigate to="/login" replace />;

  return <Outlet />;
}

function AppRoutes() {
  const { merchant, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="loading-screen">{t('common.loading')}</div>;

  return (
    <Routes>
      <Route path="/login" element={merchant ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={merchant ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<MobileLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup" element={<SetupWizardPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/menu" element={<PlaceholderPage title="Menu" />} />
        </Route>
        <Route element={<FullPageLayout />}>
          <Route path="/show-qr" element={<ShowQRPage />} />
          <Route path="/scan-qr" element={<ScanQRPage />} />
          <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
