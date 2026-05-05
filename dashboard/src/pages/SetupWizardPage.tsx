import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, PlusCircle, Grid3X3, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { createLoyaltyProgram } from '../api';

type ProgramType = 'POINTS' | 'STAMPS';

interface TierDraft {
  id: string;
  name: string;
  threshold: number | string;
  rewardName: string;
}

function newTier(): TierDraft {
  return { id: crypto.randomUUID(), name: '', threshold: '', rewardName: '' };
}

// Parse the input as int, preserving 0; empty string stays empty.
function parseIntInput(raw: string): number | string {
  if (raw === '') return '';
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? '' : n;
}

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { refreshProgram } = useAuth();

  const [step, setStep] = useState(1);
  const [type, setType] = useState<ProgramType | null>(null);
  const [goalStamps, setGoalStamps] = useState<number | string>(10);
  const [welcomeStamps, setWelcomeStamps] = useState<number | string>(0);
  const [pointsPerCurrency, setPointsPerCurrency] = useState<number | string>(1);
  const [welcomePoints, setWelcomePoints] = useState<number | string>(0);
  const [tiers, setTiers] = useState<TierDraft[]>([newTier()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateTier(id: string, field: keyof TierDraft, value: string | number) {
    setTiers((prev) =>
      prev.map((tier) => (tier.id === id ? { ...tier, [field]: value } : tier))
    );
  }

  function removeTier(id: string) {
    setTiers((prev) => prev.filter((tier) => tier.id !== id));
  }

  // ---- Validation ----
  const goalStampsNum = Number(goalStamps) || 0;
  const welcomeStampsNum = Number(welcomeStamps) || 0;
  const pointsPerCurrencyNum = Number(pointsPerCurrency) || 0;
  const welcomePointsNum = Number(welcomePoints) || 0;

  // Inline (visible under threshold input). Only threshold/order errors.
  const tierErrors = useMemo<Record<string, string>>(() => {
    const errs: Record<string, string> = {};
    tiers.forEach((tier, idx) => {
      const v = Number(tier.threshold);
      if (v > 0 && idx > 0) {
        const prev = Number(tiers[idx - 1].threshold);
        if (prev && v <= prev) errs[tier.id] = t('setup.errorAscending');
      }
      if (type === 'STAMPS' && v > 0) {
        if (v > goalStampsNum) errs[tier.id] = t('setup.errorMaxStamps', { goal: goalStampsNum });
        else if (tiers.length === 1 && v !== goalStampsNum) {
          errs[tier.id] = t('setup.errorSingleTierStamps', { goal: goalStampsNum });
        } else if (tiers.length > 1 && idx === tiers.length - 1 && v !== goalStampsNum) {
          errs[tier.id] = t('setup.errorLastTierStamps', { goal: goalStampsNum });
        }
      }
    });
    return errs;
  }, [tiers, type, goalStampsNum, t]);

  // Per-field invalid flags (drive red border on inputs, also block Finish)
  const rewardMissing = (tier: TierDraft) => !tier.rewardName.trim();
  const thresholdMissing = (tier: TierDraft) => {
    const v = Number(tier.threshold);
    return !v || v <= 0;
  };

  const baseRuleValid = type === 'STAMPS'
    ? goalStampsNum > 0
    : pointsPerCurrencyNum > 0;

  const allTiersValid = tiers.every(
    (tier) => !rewardMissing(tier) && !thresholdMissing(tier) && !tierErrors[tier.id],
  );

  const canFinish = baseRuleValid && tiers.length > 0 && allTiersValid;

  // ---- Per-tier live computation ----
  function tierComputation(threshold: number): string {
    if (!threshold || threshold <= 0) return '';
    if (type === 'POINTS') {
      const remaining = Math.max(0, threshold - welcomePointsNum);
      if (remaining === 0) return t('setup.tierUnlocked');
      const euros = pointsPerCurrencyNum > 0 ? Math.ceil(remaining / pointsPerCurrencyNum) : 0;
      return t('setup.tierSpend', { euros });
    } else {
      const remaining = Math.max(0, threshold - welcomeStampsNum);
      if (remaining === 0) return t('setup.tierUnlocked');
      return t('setup.tierVisits', { count: remaining });
    }
  }

  async function handleFinish() {
    if (!canFinish) return;
    setError('');
    setSubmitting(true);
    try {
      await createLoyaltyProgram({
        type: type!,
        goalStamps: type === 'STAMPS' ? goalStampsNum : undefined,
        welcomeStamps: type === 'STAMPS' ? welcomeStampsNum : undefined,
        pointsPerCurrency: type === 'POINTS' ? pointsPerCurrencyNum : undefined,
        welcomePoints: type === 'POINTS' ? welcomePointsNum : undefined,
        rewardTiers: tiers.map((tier) => ({
          name: tier.name,
          threshold: Number(tier.threshold),
          rewardName: tier.rewardName,
        })),
      });
      await refreshProgram();
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.3 } });
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('setup.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-page stack-lg">
      {step > 1 && (
        <header className="app-page-header">
          <div className="app-page-header-row">
            <button className="app-page-back" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Step 1: Choose system */}
      {step === 1 && (
        <div className="app-form-card app-form-stack">
          <div>
            <span className="section-kicker">{t('setup.chooseSystem')}</span>
            <h2 className="app-section-title">{t('setup.chooseSystem')}</h2>
          </div>

          <div className="app-choice-grid">
            <button
              className={`app-choice-card${type === 'POINTS' ? ' active' : ''}`}
              onClick={() => setType('POINTS')}
            >
              <div className="app-choice-card-body">
                <div className="app-icon-chip app-icon-chip-primary">
                  <PlusCircle size={24} />
                </div>
                <div className="app-choice-title">{t('setup.pointsSystem')}</div>
                <div className="app-choice-description">{t('setup.pointsDesc')}</div>
              </div>
            </button>

            <button
              className={`app-choice-card${type === 'STAMPS' ? ' active' : ''}`}
              onClick={() => setType('STAMPS')}
            >
              <div className="app-choice-card-body">
                <div className="app-icon-chip app-icon-chip-secondary">
                  <Grid3X3 size={24} />
                </div>
                <div className="app-choice-title">{t('setup.stampCard')}</div>
                <div className="app-choice-description">{t('setup.stampDesc')}</div>
              </div>
            </button>
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={!type}
            onClick={() => setStep(2)}
          >
            {t('setup.nextStep')}
          </button>
        </div>
      )}

      {/* Step 2: Configure + Rewards (merged) */}
      {step === 2 && (
        <div className="app-form-card app-form-stack">
          {/* SECTION: Base rule */}
          <div className="setup-section">
            <span className="setup-section-kicker">{t('setup.sectionRules')}</span>
            {type === 'STAMPS' ? (
              <div className="config-field">
                <label>{t('setup.stampsForReward')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    value={goalStamps}
                    onChange={(e) => setGoalStamps(parseIntInput(e.target.value))}
                    className="config-number"
                  />
                  <span className="config-unit">{t('setup.stamps')}</span>
                </div>
              </div>
            ) : (
              <div className="config-field">
                <label>{t('setup.pointsPerEuro')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    value={pointsPerCurrency}
                    onChange={(e) => setPointsPerCurrency(parseIntInput(e.target.value))}
                    className="config-number"
                  />
                  <span className="config-unit">{t('setup.points')}</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Welcome bonus */}
          <div className="setup-section">
            <span className="setup-section-kicker">{t('setup.sectionWelcome')}</span>
            {type === 'STAMPS' ? (
              <div className="config-field">
                <label>{t('setup.welcomeStamps')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    value={welcomeStamps}
                    onChange={(e) => setWelcomeStamps(parseIntInput(e.target.value))}
                    className="config-number"
                  />
                  <span className="config-unit">{t('setup.stamps')}</span>
                </div>
              </div>
            ) : (
              <div className="config-field">
                <label>{t('setup.welcomePoints')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    value={welcomePoints}
                    onChange={(e) => setWelcomePoints(parseIntInput(e.target.value))}
                    className="config-number"
                  />
                  <span className="config-unit">{t('setup.points')}</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Rewards / tiers */}
          <div className="setup-section">
            <span className="setup-section-kicker">{t('setup.sectionRewards')}</span>

            {tiers.map((tier, index) => {
              const tierErr = tierErrors[tier.id];
              const compHint = tierComputation(Number(tier.threshold));
              return (
                <div key={tier.id} className="tier-card">
                  <div className="tier-header">
                    <span className="tier-label">{t('setup.tier')} {index + 1}</span>
                    {tiers.length > 1 && (
                      <button className="tier-delete" onClick={() => removeTier(tier.id)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={t('setup.tierNamePlaceholder')}
                    value={tier.name}
                    onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                    className="tier-input"
                  />
                  <div className="tier-reward-row">
                    <input
                      type="number"
                      value={tier.threshold}
                      max={type === 'STAMPS' ? goalStampsNum : undefined}
                      onChange={(e) =>
                        updateTier(tier.id, 'threshold', parseIntInput(e.target.value))
                      }
                      className={`tier-threshold${thresholdMissing(tier) || tierErr ? ' is-invalid' : ''}`}
                    />
                    <input
                      type="text"
                      placeholder={t('setup.rewardNamePlaceholder')}
                      value={tier.rewardName}
                      onChange={(e) => updateTier(tier.id, 'rewardName', e.target.value)}
                      className={`tier-reward-name${rewardMissing(tier) ? ' is-invalid' : ''}`}
                    />
                  </div>
                  {tierErr ? (
                    <p className="tier-error">{tierErr}</p>
                  ) : compHint ? (
                    <p className="tier-hint">{compHint}</p>
                  ) : null}
                </div>
              );
            })}

            <button className="add-tier-btn" onClick={() => setTiers([...tiers, newTier()])}>
              + {t('setup.addTier')}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="setup-buttons">
            <button className="btn" onClick={() => setStep(1)}>
              {t('setup.back')}
            </button>
            <button
              className="btn btn-primary"
              disabled={submitting || !canFinish}
              onClick={handleFinish}
            >
              {submitting ? t('setup.finishing') : t('setup.finishSetup')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
