import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gift, Star, Settings, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

export default function MenuPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout, program } = useAuth();

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
      <PWAInstallPrompt mode="menu" />

      {/* Active Program Card — moved from LoyaltyHubPage so it's reachable from
          any tab via the always-visible Menu in the bottom nav. */}
      {program ? (
        <div className="program-card-minimal aviator-shadow">
          <button className="btn-edit" onClick={() => navigate('/setup')}>
            {t('hub.edit')}
          </button>
          <div className="program-card-info">
            <h2 className="program-card-name">{t('hub.activeProgram')}</h2>
            <p className="program-card-type">
              {program.type === 'STAMPS' ? t('hub.stampCard') : t('hub.pointsProgram')}
            </p>
            <div className="program-card-stats">
              {program.type === 'STAMPS' && (
                <>
                  <div className="program-stat">
                    <p className="program-stat-label">{t('hub.welcomeBonus')}</p>
                    <p className="program-stat-value">{program.welcomeStamps || 0} {t('hub.stampsUnit')}</p>
                  </div>
                  <div className="program-stat">
                    <p className="program-stat-label">{t('hub.goal')}</p>
                    <p className="program-stat-value">{program.goalStamps} {t('hub.stampsUnit')}</p>
                  </div>
                </>
              )}
              {program.type === 'POINTS' && (
                <>
                  <div className="program-stat">
                    <p className="program-stat-label">{t('hub.pointsPerEuro')}</p>
                    <p className="program-stat-value">{program.pointsPerCurrency}</p>
                  </div>
                  <div className="program-stat">
                    <p className="program-stat-label">{t('hub.tiers')}</p>
                    <p className="program-stat-value">{program.rewardTiers.length}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="program-card-minimal program-card-empty aviator-shadow">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">{t('hub.noProgramTitle')}</div>
          <div className="empty-state-desc">{t('hub.noProgramDesc')}</div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/setup')}>
            {t('hub.setupProgram')}
          </button>
        </div>
      )}

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
