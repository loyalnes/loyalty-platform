import { useState } from 'react';
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

let tierId = 0;
function newTier(): TierDraft {
  tierId++;
  return { id: `t${tierId}`, name: '', threshold: 10, rewardName: '' };
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

  async function handleFinish() {
    setError('');
    setSubmitting(true);
    try {
      await createLoyaltyProgram({
        type: type!,
        goalStamps: type === 'STAMPS' ? Number(goalStamps) : undefined,
        welcomeStamps: type === 'STAMPS' ? Number(welcomeStamps) : undefined,
        pointsPerCurrency: type === 'POINTS' ? Number(pointsPerCurrency) : undefined,
        rewardTiers: tiers.map((tier) => ({
          name: tier.name,
          threshold: Number(tier.threshold),
          rewardName: tier.rewardName,
        })),
      });
      await refreshProgram();
      // Celebration confetti
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.3 } });
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('setup.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-page stack-lg" style={{ paddingBottom: step === 1 ? '100px' : undefined }}>
      {step > 1 && (
        <header className="app-page-header">
          <div className="app-page-header-row">
            <button
              className="app-page-back"
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <span className="app-page-kicker">{t('setup.title')}</span>
              <h1 className="app-page-title">{t('setup.title')}</h1>
            </div>
          </div>
          <p className="app-page-subtitle">
            {step === 2
              ? (type === 'STAMPS' ? t('setup.configureStamps') : t('setup.configurePoints'))
              : t('setup.defineRewards')}
          </p>
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

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="app-form-card app-form-stack">
          <div>
            <span className="section-kicker">{t('setup.title')}</span>
            <h2 className="app-section-title">
            {type === 'STAMPS' ? t('setup.configureStamps') : t('setup.configurePoints')}
            </h2>
          </div>

          {type === 'STAMPS' ? (
            <>
              <div className="config-field">
                <label>{t('setup.stampsForReward')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    value={goalStamps}
                    onChange={(e) => setGoalStamps(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                    className="config-number"
                  />
                  <span className="config-unit">{t('setup.stamps')}</span>
                </div>
              </div>
              <div className="config-field">
                <label>{t('setup.welcomeStamps')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    value={welcomeStamps}
                    onChange={(e) => setWelcomeStamps(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    className="config-number"
                  />
                  <span className="config-unit">{t('setup.stamps')}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="config-field">
              <label>{t('setup.pointsPerEuro')}</label>
              <div className="config-input-row">
                <input
                  type="number"
                  value={pointsPerCurrency}
                  onChange={(e) => setPointsPerCurrency(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                  className="config-number"
                />
                <span className="config-unit">{t('setup.points')}</span>
              </div>
            </div>
          )}

          <div className="setup-buttons">
            <button className="btn" onClick={() => setStep(1)}>
              {t('setup.back')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(3)}
              disabled={
                type === 'STAMPS'
                  ? !goalStamps || goalStamps === 0
                  : !pointsPerCurrency || pointsPerCurrency === 0
              }
            >
              {t('setup.nextStep')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Define Rewards */}
      {step === 3 && (
        <div className="app-form-card app-form-stack">
          <div>
            <span className="section-kicker">{t('setup.defineRewards')}</span>
            <h2 className="app-section-title">{t('setup.defineRewards')}</h2>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {tiers.map((tier, index) => (
            <div key={tier.id} className="tier-card">
              <div className="tier-header">
                <span className="tier-label">
                  {t('setup.tier')} {index + 1}
                </span>
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
                  onChange={(e) =>
                    updateTier(tier.id, 'threshold', e.target.value === '' ? '' : parseInt(e.target.value) || '')
                  }
                  className="tier-threshold"
                />
                <input
                  type="text"
                  placeholder={t('setup.rewardNamePlaceholder')}
                  value={tier.rewardName}
                  onChange={(e) => updateTier(tier.id, 'rewardName', e.target.value)}
                  className="tier-reward-name"
                />
              </div>
            </div>
          ))}

          <button
            className="add-tier-btn"
            onClick={() => setTiers([...tiers, newTier()])}
          >
            + {t('setup.addTier')}
          </button>

          <div className="setup-buttons">
            <button className="btn" onClick={() => setStep(2)}>
              {t('setup.back')}
            </button>
            <button
              className="btn btn-primary"
              disabled={submitting || tiers.some((tier) => !tier.name || !tier.rewardName || !tier.threshold || tier.threshold === 0)}
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
