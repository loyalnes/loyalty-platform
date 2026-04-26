import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getInsightsKpis, type InsightsKpis } from '../api';
import HomeQuickStats from '../components/HomeQuickStats';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { PullToRefresh } from '../components/ui/PullToRefresh';

export default function LoyaltyHubPage() {
  const navigate = useNavigate();
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

  const loadDashboardData = async () => {
    try {
      const [today, week] = await Promise.all([
        getInsightsKpis('24h'),
        getInsightsKpis('7d')
      ]);
      setTodayKpis(today);
      setWeekKpis(week);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <PullToRefresh onRefresh={loadDashboardData}>
      <div className="hub-page stack-lg">
        <PWAInstallPrompt mode="home" />

      {/* Quick Actions - Hybrid Design */}
      <div className="quick-actions">
        <div className="quick-action-wrapper">
          <button className="quick-action-fab add-points fab-primary expressive" onClick={() => navigate('/scan-qr')}>
            <span className="material-symbols-outlined">add</span>
          </button>
          <span className="quick-action-label">{t('hub.addPoints')}</span>
        </div>
        <div className="quick-action-wrapper">
          <button className="quick-action-fab redeem expressive accent-purple-bg">
            <span className="material-symbols-outlined">redeem</span>
          </button>
          <span className="quick-action-label">{t('hub.redeem')}</span>
        </div>
        <div className="quick-action-wrapper">
          <button className="quick-action-fab show-qr expressive accent-purple-bg" onClick={() => navigate('/show-qr')}>
            <span className="material-symbols-outlined">qr_code_2</span>
          </button>
          <span className="quick-action-label">{t('hub.showQR')}</span>
        </div>
        <div className="quick-action-wrapper">
          <button className="quick-action-fab contest expressive" onClick={() => navigate('/show-review-qr')}>
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
    </PullToRefresh>
  );
}
