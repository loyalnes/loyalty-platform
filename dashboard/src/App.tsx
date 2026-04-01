import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './AuthContext';
import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import CardsPage from './pages/CardsPage';
import CardDetailPage from './pages/CardDetailPage';

function LocaleSwitcher() {
  const { i18n, t } = useTranslation();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value as SupportedLocale;
    i18n.changeLanguage(locale);
    localStorage.setItem('preferredLocale', locale);
  }

  return (
    <div className="locale-switcher">
      <select value={i18n.language} onChange={handleChange}>
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>{t(`locale.${loc}`)}</option>
        ))}
      </select>
    </div>
  );
}

function Layout() {
  const { merchant, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">{t('nav.brand')}</div>
        <nav>
          <ul className="sidebar-nav">
            <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.overview')}</NavLink></li>
            <li><NavLink to="/cards" className={({ isActive }) => isActive ? 'active' : ''}>{t('nav.loyaltyCards')}</NavLink></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: '0.5rem' }}>{merchant?.name}</div>
          <LocaleSwitcher />
          <button onClick={logout}>{t('common.signOut')}</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function RequireAuth() {
  const { merchant, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;
  if (!merchant) return <Navigate to="/login" replace />;

  return <Layout />;
}

function AppRoutes() {
  const { merchant, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  return (
    <Routes>
      <Route path="/login" element={merchant ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/cards/:id" element={<CardDetailPage />} />
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
