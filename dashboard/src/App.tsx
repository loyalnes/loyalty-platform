import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import CardsPage from './pages/CardsPage';
import CardDetailPage from './pages/CardDetailPage';

function Layout() {
  const { merchant, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Loyalty Dashboard</div>
        <nav>
          <ul className="sidebar-nav">
            <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Overview</NavLink></li>
            <li><NavLink to="/cards" className={({ isActive }) => isActive ? 'active' : ''}>Loyalty Cards</NavLink></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: '0.5rem' }}>{merchant?.name}</div>
          <button onClick={logout}>Sign Out</button>
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

  if (loading) return <div className="empty-state">Loading...</div>;
  if (!merchant) return <Navigate to="/login" replace />;

  return <Layout />;
}

function AppRoutes() {
  const { merchant, loading } = useAuth();

  if (loading) return <div className="empty-state">Loading...</div>;

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
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
