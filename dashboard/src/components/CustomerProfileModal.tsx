import { useState, useEffect } from 'react';
import { X, User, TrendingUp, TrendingDown, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import {
  addPointsToCustomer,
  getAvailableRewards,
  redeemReward,
  type CustomerCardDetail,
  type RewardTier,
} from '../api';
import RedeemConfirmModal from './RedeemConfirmModal';

interface CustomerProfileModalProps {
  customer: CustomerCardDetail;
  onClose: () => void;
}

export default function CustomerProfileModal({ customer, onClose }: CustomerProfileModalProps) {
  const { t } = useTranslation();
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [showRedeemRewards, setShowRedeemRewards] = useState(false);
  const [customPoints, setCustomPoints] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentBalance, setCurrentBalance] = useState(customer.pointsBalance);
  const [currentTotalRedeemed, setCurrentTotalRedeemed] = useState(customer.totalRedeemed);
  const [availableRewards, setAvailableRewards] = useState<RewardTier[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [selectedReward, setSelectedReward] = useState<RewardTier | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  // Load available rewards when modal opens or balance changes
  useEffect(() => {
    loadRewards();
  }, [currentBalance]);

  const loadRewards = async () => {
    setLoadingRewards(true);
    try {
      const data = await getAvailableRewards(customer.customerId);
      setAvailableRewards(data.availableRewards);
    } catch (err) {
      console.error('Failed to load rewards:', err);
    } finally {
      setLoadingRewards(false);
    }
  };

  const handleQuickAdd = async (points: number) => {
    await addPoints(points);
  };

  const handleCustomAdd = async () => {
    const points = parseInt(customPoints, 10);
    if (isNaN(points) || points <= 0) return;
    await addPoints(points, note);
  };

  const addPoints = async (points: number, description?: string) => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await addPointsToCustomer(customer.customerId, points, description);
      setCurrentBalance(response.card.pointsBalance);
      setSuccessMessage(t('scanQR.customerProfile.success'));
      setShowAddPoints(false);
      setCustomPoints('');
      setNote('');

      // Trigger confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4F46E5', '#818CF8', '#C7D2FE'],
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      setErrorMessage(t('scanQR.customerProfile.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = (reward: RewardTier) => {
    setSelectedReward(reward);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    setRedeemLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await redeemReward(customer.customerId, selectedReward.id);
      setCurrentBalance(response.card.pointsBalance);
      setCurrentTotalRedeemed(response.card.totalRedeemed);
      setSuccessMessage(t('scanQR.customerProfile.redeemSuccess'));
      setSelectedReward(null);
      setShowRedeemRewards(false);

      // Trigger confetti celebration
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10B981', '#34D399', '#6EE7B7'],
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      setErrorMessage(t('scanQR.customerProfile.redeemError'));
      setSelectedReward(null);
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleCancelRedeem = () => {
    setSelectedReward(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content customer-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="customer-profile-header">
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="customer-profile-info">
          <div className="customer-avatar">
            {customer.avatarUrl ? (
              <img src={customer.avatarUrl} alt={`${customer.firstName} ${customer.lastName}`} />
            ) : (
              <div className="customer-avatar-initials">
                <User size={32} />
              </div>
            )}
          </div>
          <h2 className="customer-name">
            {customer.firstName} {customer.lastName}
          </h2>
          <p className="customer-email">{customer.email}</p>
        </div>

        {successMessage && <div className="success-message">{successMessage}</div>}
        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <div className="customer-stats">
          <div className="customer-stat">
            <div className="customer-stat-label">{t('scanQR.customerProfile.currentPoints')}</div>
            <div className="customer-stat-value">{currentBalance}</div>
          </div>
          <div className="customer-stat">
            <div className="customer-stat-label">{t('scanQR.customerProfile.totalEarned')}</div>
            <div className="customer-stat-value secondary">
              <TrendingUp size={16} />
              {customer.totalEarned}
            </div>
          </div>
          <div className="customer-stat">
            <div className="customer-stat-label">{t('scanQR.customerProfile.totalRedeemed')}</div>
            <div className="customer-stat-value secondary">
              <TrendingDown size={16} />
              {currentTotalRedeemed}
            </div>
          </div>
        </div>

        {!showAddPoints && !showRedeemRewards ? (
          <div className="customer-actions">
            <button className="btn-primary btn-large" onClick={() => setShowAddPoints(true)}>
              {t('scanQR.customerProfile.addPoints')}
            </button>
            <button
              className="btn-secondary btn-large"
              onClick={() => setShowRedeemRewards(true)}
              disabled={loadingRewards || availableRewards.length === 0}
            >
              <Gift size={20} />
              {t('scanQR.customerProfile.redeemReward')}
            </button>
          </div>
        ) : showAddPoints ? (
          <div className="add-points-form">
            <h3>{t('scanQR.customerProfile.addPoints')}</h3>

            <div className="quick-add-buttons">
              <p className="quick-add-label">{t('scanQR.customerProfile.quickAdd')}</p>
              <div className="quick-add-grid">
                <button className="quick-add-btn" onClick={() => handleQuickAdd(5)} disabled={loading}>
                  +5
                </button>
                <button className="quick-add-btn" onClick={() => handleQuickAdd(10)} disabled={loading}>
                  +10
                </button>
                <button className="quick-add-btn" onClick={() => handleQuickAdd(20)} disabled={loading}>
                  +20
                </button>
                <button className="quick-add-btn" onClick={() => handleQuickAdd(50)} disabled={loading}>
                  +50
                </button>
              </div>
            </div>

            <div className="custom-points-input">
              <p className="custom-points-label">{t('scanQR.customerProfile.customAmount')}</p>
              <input
                type="number"
                min="1"
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
                placeholder={t('scanQR.customerProfile.pointsToAdd')}
                disabled={loading}
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('scanQR.customerProfile.addNote')}
                disabled={loading}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddPoints(false)} disabled={loading}>
                {t('scanQR.customerProfile.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleCustomAdd}
                disabled={loading || !customPoints || parseInt(customPoints, 10) <= 0}
              >
                {loading ? t('common.loading') : t('scanQR.customerProfile.confirm')}
              </button>
            </div>
          </div>
        ) : (
          <div className="redeem-rewards-section">
            <h3>{t('scanQR.customerProfile.availableRewards')}</h3>

            {loadingRewards ? (
              <div className="rewards-loading">{t('common.loading')}</div>
            ) : availableRewards.length === 0 ? (
              <div className="rewards-empty">
                <Gift size={32} strokeWidth={1.5} />
                <p className="rewards-empty-title">{t('scanQR.customerProfile.noRewardsAvailable')}</p>
                <p className="rewards-empty-desc">{t('scanQR.customerProfile.noRewardsDesc')}</p>
              </div>
            ) : (
              <div className="rewards-list">
                {availableRewards.map((reward) => (
                  <button
                    key={reward.id}
                    className="reward-item"
                    onClick={() => handleRedeemClick(reward)}
                    disabled={redeemLoading}
                  >
                    <div className="reward-item-icon">
                      <Gift size={20} />
                    </div>
                    <div className="reward-item-info">
                      <div className="reward-item-name">{reward.rewardName}</div>
                      <div className="reward-item-tier">{reward.name}</div>
                    </div>
                    <div className="reward-item-cost">
                      {t('scanQR.customerProfile.pointsCost', { points: reward.threshold })}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowRedeemRewards(false)}>
                {t('scanQR.customerProfile.cancel')}
              </button>
            </div>
          </div>
        )}

        {selectedReward && (
          <RedeemConfirmModal
            reward={selectedReward}
            currentBalance={currentBalance}
            onConfirm={handleConfirmRedeem}
            onCancel={handleCancelRedeem}
            loading={redeemLoading}
          />
        )}
      </div>
    </div>
  );
}
