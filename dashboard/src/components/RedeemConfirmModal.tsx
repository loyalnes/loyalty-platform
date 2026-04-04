import { Gift, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RewardTier } from '../api';

interface RedeemConfirmModalProps {
  reward: RewardTier;
  currentBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function RedeemConfirmModal({
  reward,
  currentBalance,
  onConfirm,
  onCancel,
  loading,
}: RedeemConfirmModalProps) {
  const { t } = useTranslation();
  const newBalance = currentBalance - reward.threshold;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content redeem-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="redeem-confirm-header">
          <div className="redeem-confirm-icon">
            <Gift size={32} />
          </div>
          <h2>{t('scanQR.redeemConfirm.title')}</h2>
        </div>

        <div className="redeem-confirm-details">
          <div className="redeem-confirm-row">
            <span className="redeem-confirm-label">{t('scanQR.redeemConfirm.reward')}</span>
            <span className="redeem-confirm-value reward-name">{reward.rewardName}</span>
          </div>

          <div className="redeem-confirm-row">
            <span className="redeem-confirm-label">{t('scanQR.redeemConfirm.pointsToDeduct')}</span>
            <span className="redeem-confirm-value points-deduct">
              <TrendingDown size={16} />
              {reward.threshold}
            </span>
          </div>

          <div className="redeem-confirm-divider" />

          <div className="redeem-confirm-row">
            <span className="redeem-confirm-label">{t('scanQR.redeemConfirm.currentBalance')}</span>
            <span className="redeem-confirm-value">{currentBalance}</span>
          </div>

          <div className="redeem-confirm-row">
            <span className="redeem-confirm-label">{t('scanQR.redeemConfirm.newBalance')}</span>
            <span className="redeem-confirm-value new-balance">{newBalance}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            {t('scanQR.redeemConfirm.cancel')}
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? t('scanQR.redeemConfirm.processing') : t('scanQR.redeemConfirm.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
