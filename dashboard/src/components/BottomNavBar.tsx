import { NavLink } from 'react-router-dom';
import { Home, Users, QrCode, MessageCircle, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BottomNavBar() {
  const { t } = useTranslation();

  const tabs = [
    { to: '/', icon: Home, label: t('nav.today'), end: true },
    { to: '/customers', icon: Users, label: t('nav.customers') },
    { to: '/qr', icon: QrCode, label: t('nav.qr') },
    { to: '/chat', icon: MessageCircle, label: t('nav.chat') },
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
