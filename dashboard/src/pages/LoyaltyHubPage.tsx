import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, QrCode, Gamepad2, Bell, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { getInsightsKpis, type InsightsKpis } from '../api';
import HomeQuickStats from '../components/HomeQuickStats';

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('hub.goodMorning');
  if (hour < 18) return t('hub.goodAfternoon');
  return t('hub.goodEvening');
}

export default function LoyaltyHubPage() {
  const navigate = useNavigate();
  const { merchant, program } = useAuth();
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

  const greeting = getGreeting(t);

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div>
          <div className="hub-greeting">{greeting},</div>
          <h1 className="hub-title">{merchant?.name || 'BARELIO2'}</h1>
        </div>
        <button className="hub-bell">
          <Bell size={22} />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action add-points" onClick={() => navigate('/scan-qr')}>
          <PlusCircle size={28} strokeWidth={2} />
          <span>{t('hub.addPoints')}</span>
        </button>
        <button className="quick-action redeem">
          <Gift size={28} strokeWidth={2} />
          <span>{t('hub.redeem')}</span>
        </button>
        <button className="quick-action show-qr" onClick={() => navigate('/show-qr')}>
          <QrCode size={28} strokeWidth={2} />
          <span>{t('hub.showQR')}</span>
        </button>
        <button className="quick-action contest">
          <Gamepad2 size={28} strokeWidth={2} />
          <span>{t('hub.contest')}</span>
        </button>
      </div>

      {/* Active Program Card */}
      {program ? (
        <div className="program-card-minimal">
          <div className="program-card-info">
            <div className="program-card-header">
              <div className="program-card-name">
                {merchant?.name} {program.type === 'STAMPS' ? t('hub.stampCard') : t('hub.pointsProgram')}
              </div>
              {weekKpis.activeMembers === 0 && (
                <button className="btn-edit" onClick={() => window.location.href = '/dashboard/setup'}>
                  {t('hub.edit')}
                </button>
              )}
            </div>
            <div className="program-card-detail">
              {program.type === 'STAMPS'
                ? `${program.goalStamps} ${t('hub.stampsUnit')} → ${t('hub.reward')}`
                : `${program.pointsPerCurrency} ${t('hub.pts')}/${t('hub.euro')} · ${program.rewardTiers.length} ${t('hub.tiers')}`
              }
            </div>
            <div className="program-card-members">
              {t('hub.manageFromInsights')}
            </div>
          </div>
        </div>
      ) : (
        <div className="program-card-minimal program-card-empty">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">{t('hub.noProgramTitle')}</div>
          <div className="empty-state-desc">{t('hub.noProgramDesc')}</div>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/dashboard/setup'}>
            {t('hub.setupProgram')}
          </button>
        </div>
      )}

      <HomeQuickStats
        todayKpis={todayKpis}
        weekKpis={weekKpis}
        locale={i18n.language}
        onOpenInsights={() => navigate('/insights')}
      />

    </div>
  );
}
