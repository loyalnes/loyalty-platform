import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gift, Star, Settings, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function MenuPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { merchant, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuSections = [
    {
      title: t('menu.acquisition', 'Acquisition'),
      items: [
        {
          icon: Gift,
          label: t('menu.campaigns', 'Gamification Campaigns'),
          description: t('menu.campaignsDesc', 'Scratch cards, spin wheels & prizes'),
          path: '/campaigns',
          color: '#667eea',
        },
        {
          icon: Star,
          label: t('menu.reviews', 'Customer Reviews'),
          description: t('menu.reviewsDesc', 'QR code & review settings'),
          path: '/show-review-qr',
          color: '#667eea',
        },
      ],
    },
    {
      title: t('menu.settings', 'Settings'),
      items: [
        {
          icon: Settings,
          label: t('menu.account', 'Account Settings'),
          description: t('menu.accountDesc', 'Profile, plan & preferences'),
          path: '/settings',
          color: '#666',
        },
      ],
    },
    {
      title: t('menu.support', 'Support'),
      items: [
        {
          icon: HelpCircle,
          label: t('menu.help', 'Help & Documentation'),
          description: t('menu.helpDesc', 'Guides, FAQs & support'),
          path: '/help',
          color: '#666',
        },
      ],
    },
  ];

  return (
    <div className="app-page stack-lg">
      <header className="app-page-header">
        <span className="app-page-kicker">{t('menu.title', 'Menu')}</span>
        <div>
          <h1 className="app-page-title">{merchant?.name || 'Merchant Dashboard'}</h1>
          <p className="app-page-subtitle">{t('menu.accountDesc', 'Profile, plan & preferences')}</p>
        </div>
      </header>

      {menuSections.map((section, idx) => (
        <section key={idx} className="app-menu-section">
          <div>
            <span className="section-kicker">{section.title}</span>
          </div>
          <div className="app-menu-list">
            {section.items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                className="app-menu-item"
                onClick={() => navigate(item.path)}
              >
                <div className="app-menu-item-body">
                  <div className={item.color === '#667eea' ? 'app-icon-chip app-icon-chip-primary' : 'app-icon-chip app-icon-chip-neutral'}>
                      <item.icon size={24} color={item.color} />
                  </div>
                  <div className="app-menu-item-text">
                    <div className="app-menu-item-title">{item.label}</div>
                    <div className="app-menu-item-description">{item.description}</div>
                  </div>
                    <ChevronRight size={20} color="#999" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div>
        <button onClick={handleLogout} className="app-danger-button">
          <LogOut size={20} />
          {t('menu.logout', 'Logout')}
        </button>
      </div>
    </div>
  );
}
