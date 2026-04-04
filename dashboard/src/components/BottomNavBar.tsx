import { NavLink } from 'react-router-dom';
import { Home, BarChart3, Users, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BottomNavBar() {
  const { t } = useTranslation();

  const tabs = [
    { to: '/', icon: Home, label: t('nav.today'), end: true },
    { to: '/insights', icon: BarChart3, label: t('nav.insights') },
    { to: '/customers', icon: Users, label: t('nav.customers') },
    { to: '/menu', icon: Menu, label: t('nav.menu') },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-tab${isActive ? ' active' : ''}`}
        >
          <Icon size={22} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
