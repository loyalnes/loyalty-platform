import { useState, useEffect } from 'react';
import { QrCode, PlusCircle, Gift, Share2, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { getStats, type Stats } from '../api';
import { formatNumber } from '../i18n';

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('hub.goodMorning');
  if (hour < 18) return t('hub.goodAfternoon');
  return t('hub.goodEvening');
}

export default function LoyaltyHubPage() {
  const { merchant, program } = useAuth();
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<'7d' | '15d' | '30d'>('7d');
  const [stats, setStats] = useState<Stats>({ activeCommunity: 0, newUsers: 0 });

  useEffect(() => {
    getStats(period).then(setStats).catch(() => {});
  }, [period]);

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
        <button className="quick-action scan">
          <QrCode size={24} />
          <span>{t('hub.scan')}</span>
        </button>
        <button className="quick-action points">
          <PlusCircle size={24} />
          <span>{t('hub.points')}</span>
        </button>
        <button className="quick-action redeem">
          <Gift size={24} />
          <span>{t('hub.redeem')}</span>
        </button>
        <button className="quick-action invite">
          <Share2 size={24} />
          <span>{t('hub.invite')}</span>
        </button>
      </div>

      {/* Active Program Card */}
      {program && (
        <div className="program-card">
          <div className="program-card-header">
            <div>
              <div className="program-card-title">{t('hub.activeProgram')}</div>
              <div className="program-card-type">
                {program.type === 'STAMPS' ? t('hub.stampCard') : t('hub.pointsProgram')}
              </div>
            </div>
            <div className="program-card-icon">
              {program.type === 'STAMPS' ? <QrCode size={24} /> : <PlusCircle size={24} />}
            </div>
          </div>
          {program.type === 'STAMPS' && (
            <div className="program-card-stats">
              <div>
                <div className="program-stat-label">{t('hub.welcomeBonus')}</div>
                <div className="program-stat-value">{program.welcomeStamps} {t('hub.stampsUnit')}</div>
              </div>
              <div>
                <div className="program-stat-label">{t('hub.goal')}</div>
                <div className="program-stat-value">{program.goalStamps} {t('hub.stampsUnit')}</div>
              </div>
            </div>
          )}
          {program.type === 'POINTS' && (
            <div className="program-card-stats">
              <div>
                <div className="program-stat-label">{t('hub.pointsPerEuro')}</div>
                <div className="program-stat-value">{program.pointsPerCurrency} {t('hub.pts')}</div>
              </div>
              <div>
                <div className="program-stat-label">{t('hub.tiers')}</div>
                <div className="program-stat-value">{program.rewardTiers.length}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Section */}
      <div className="progress-section">
        <div className="progress-header">
          <h2 className="progress-title">{t('hub.yourProgress')}</h2>
          <div className="period-toggle">
            {(['7d', '15d', '30d'] as const).map((p) => (
              <button
                key={p}
                className={`period-btn${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="progress-stats">
          <div className="progress-stat-card">
            <div className="progress-stat-label">{t('hub.activeCommunity')}</div>
            <div className="progress-stat-value">{formatNumber(stats.activeCommunity, i18n.language)}</div>
          </div>
          <div className="progress-stat-card">
            <div className="progress-stat-label">{t('hub.newUsers')}</div>
            <div className="progress-stat-value">{formatNumber(stats.newUsers, i18n.language)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
