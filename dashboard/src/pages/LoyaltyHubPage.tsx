import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { getInsightsKpis, type InsightsKpis } from '../api';
import HomeQuickStats from '../components/HomeQuickStats';

export default function LoyaltyHubPage() {
  const navigate = useNavigate();
  const { program } = useAuth();
  const { t, i18n } = useTranslation();
  const [weekKpis, setWeekKpis] = useState<InsightsKpis>({
    activeMembers: 0,
    newMembers: 0,
    nearRewardCustomers: 0,
    avgRating: null,
    retention: null,
    trends: {
      activeMembers: null,
      newMembers: null,
      nearRewardCustomers: null,
      avgRating: null,
      retention: null,
    },
  });
  const [todayKpis, setTodayKpis] = useState<InsightsKpis>({
    activeMembers: 0,
    newMembers: 0,
    nearRewardCustomers: 0,
    avgRating: null,
    retention: null,
    trends: {
      activeMembers: null,
      newMembers: null,
      nearRewardCustomers: null,
      avgRating: null,
      retention: null,
    },
  });

  useEffect(() => {
    Promise.all([getInsightsKpis('24h'), getInsightsKpis('7d')])
      .then(([today, week]) => {
        setTodayKpis(today);
        setWeekKpis(week);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="hub-page stack-lg">
      {/* Active Program Card */}
      {program ? (
        <div className="program-card-minimal aviator-shadow">
          <button className="btn-edit" onClick={() => window.location.href = '/dashboard/setup'}>
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
          <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/dashboard/setup'}>
            {t('hub.setupProgram')}
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="quick-action-wrapper">
          <button className="quick-action-fab add-points" onClick={() => navigate('/scan-qr')}>
            <span className="material-symbols-outlined">add</span>
          </button>
          <span className="quick-action-label">{t('hub.addPoints')}</span>
        </div>
        <div className="quick-action-wrapper">
          <button className="quick-action-fab redeem">
            <span className="material-symbols-outlined">redeem</span>
          </button>
          <span className="quick-action-label">{t('hub.redeem')}</span>
        </div>
        <div className="quick-action-wrapper">
          <button className="quick-action-fab show-qr" onClick={() => navigate('/show-qr')}>
            <span className="material-symbols-outlined">qr_code_2</span>
          </button>
          <span className="quick-action-label">{t('hub.showQR')}</span>
        </div>
        <div className="quick-action-wrapper">
          <button className="quick-action-fab contest" onClick={() => navigate('/show-review-qr')}>
            <span className="material-symbols-outlined">sports_esports</span>
          </button>
          <span className="quick-action-label">{t('hub.reviews')}</span>
        </div>
      </div>

      <HomeQuickStats
        todayKpis={todayKpis}
        weekKpis={weekKpis}
        locale={i18n.language}
        onOpenInsights={() => navigate('/insights')}
      />

    </div>
  );
}
