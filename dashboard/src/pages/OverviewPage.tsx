import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { listCards, type LoyaltyCard } from '../api';
import { formatNumber } from '../i18n';

export default function OverviewPage() {
  const { merchant } = useAuth();
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCards(1, 100)
      .then((res) => {
        setCards(res.data);
        setTotalCards(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCards = cards.filter((c) => c.status === 'ACTIVE').length;
  const totalPointsIssued = cards.reduce((sum, c) => sum + c.totalEarned, 0);
  const totalPointsRedeemed = cards.reduce((sum, c) => sum + c.totalRedeemed, 0);
  const uniqueCustomers = new Set(cards.map((c) => c.customerId)).size;

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>{t('overview.title')}</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>{t('overview.totalCustomers')}</h3>
          <div className="value">{formatNumber(uniqueCustomers, i18n.language)}</div>
        </div>
        <div className="stat-card">
          <h3>{t('overview.activeCards')}</h3>
          <div className="value">{formatNumber(activeCards, i18n.language)}</div>
        </div>
        <div className="stat-card">
          <h3>{t('overview.totalCards')}</h3>
          <div className="value">{formatNumber(totalCards, i18n.language)}</div>
        </div>
        <div className="stat-card">
          <h3>{t('overview.pointsIssued')}</h3>
          <div className="value">{formatNumber(totalPointsIssued, i18n.language)}</div>
        </div>
        <div className="stat-card">
          <h3>{t('overview.pointsRedeemed')}</h3>
          <div className="value">{formatNumber(totalPointsRedeemed, i18n.language)}</div>
        </div>
      </div>

      {merchant && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('overview.merchantInfo')}</th>
                <th>{t('overview.value')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{t('overview.name')}</td><td>{merchant.name}</td></tr>
              <tr><td>{t('overview.email')}</td><td>{merchant.email}</td></tr>
              <tr><td>{t('overview.plan')}</td><td>{merchant.plan}</td></tr>
              <tr><td>{t('overview.location')}</td><td>{[merchant.city, merchant.country].filter(Boolean).join(', ') || t('common.na')}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
