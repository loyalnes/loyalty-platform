import { useTranslation } from 'react-i18next';
import type { InsightsKpis } from '../api';
import { formatNumber } from '../i18n';

interface HomeQuickStatsProps {
  todayKpis: InsightsKpis;
  weekKpis: InsightsKpis;
  locale: string;
  onOpenInsights: () => void;
}

export default function HomeQuickStats({ todayKpis, weekKpis, locale, onOpenInsights }: HomeQuickStatsProps) {
  const { t } = useTranslation();

  return (
    <section className="home-quick-stats">
      <button type="button" className="home-quick-stat" onClick={onOpenInsights}>
        <p className="home-quick-stat-label">{t('hub.quickStats.newMembersToday')}</p>
        <p className="home-quick-stat-value">{formatNumber(todayKpis.newMembers, locale)}</p>
        <p className="home-quick-stat-trend">
          {weekKpis.trends.newMembers === null ? '→' : weekKpis.trends.newMembers > 0 ? '↗' : weekKpis.trends.newMembers < 0 ? '↘' : '→'}
          {' '}
          {weekKpis.trends.newMembers === null ? t('insights.trendUnavailable') : `${Math.abs(weekKpis.trends.newMembers).toFixed(1)}% ${t('hub.quickStats.thisWeek')}`}
        </p>
      </button>

      <button type="button" className="home-quick-stat with-badge" onClick={onOpenInsights}>
        <p className="home-quick-stat-label">{t('hub.quickStats.nearReward')}</p>
        <p className="home-quick-stat-value">{formatNumber(weekKpis.nearRewardCustomers, locale)}</p>
        {weekKpis.nearRewardCustomers > 0 && <span className="home-quick-stat-badge">{t('hub.quickStats.actionNeeded')}</span>}
      </button>

      <button type="button" className="home-quick-stat" onClick={onOpenInsights}>
        <p className="home-quick-stat-label">{t('hub.quickStats.avgRating')}</p>
        <p className="home-quick-stat-value">{weekKpis.avgRating === null ? t('insights.noData') : weekKpis.avgRating.toFixed(1)}</p>
        <p className="home-quick-stat-trend">{t('hub.quickStats.openInsights')}</p>
      </button>
    </section>
  );
}
