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
  threshold: number;
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
  const [goalStamps, setGoalStamps] = useState(10);
  const [welcomeStamps, setWelcomeStamps] = useState(0);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(1);
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
        goalStamps: type === 'STAMPS' ? goalStamps : undefined,
        welcomeStamps: type === 'STAMPS' ? welcomeStamps : undefined,
        pointsPerCurrency: type === 'POINTS' ? pointsPerCurrency : undefined,
        rewardTiers: tiers.map((tier) => ({
          name: tier.name,
          threshold: tier.threshold,
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
    <div className="setup-page">
      <div className="setup-header">
        <button
          className="setup-back"
          onClick={() => (step > 1 ? setStep(step - 1) : navigate('/'))}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="setup-title">{t('setup.title')}</h1>
      </div>

      {/* Step 1: Choose system */}
      {step === 1 && (
        <div className="setup-step">
          <h2 className="setup-step-title">{t('setup.chooseSystem')}</h2>

          <button
            className={`selectable-card${type === 'POINTS' ? ' selected' : ''}`}
            onClick={() => setType('POINTS')}
          >
            <div className="selectable-card-icon points-icon">
              <PlusCircle size={24} />
            </div>
            <div>
              <div className="selectable-card-title">{t('setup.pointsSystem')}</div>
              <div className="selectable-card-desc">{t('setup.pointsDesc')}</div>
            </div>
          </button>

          <button
            className={`selectable-card${type === 'STAMPS' ? ' selected' : ''}`}
            onClick={() => setType('STAMPS')}
          >
            <div className="selectable-card-icon stamps-icon">
              <Grid3X3 size={24} />
            </div>
            <div>
              <div className="selectable-card-title">{t('setup.stampCard')}</div>
              <div className="selectable-card-desc">{t('setup.stampDesc')}</div>
            </div>
          </button>

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
        <div className="setup-step">
          <h2 className="setup-step-title">
            {type === 'STAMPS' ? t('setup.configureStamps') : t('setup.configurePoints')}
          </h2>

          {type === 'STAMPS' ? (
            <>
              <div className="config-field">
                <label>{t('setup.stampsForReward')}</label>
                <div className="config-input-row">
                  <input
                    type="number"
                    min={1}
                    value={goalStamps}
                    onChange={(e) => setGoalStamps(parseInt(e.target.value) || 1)}
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
                    min={0}
                    value={welcomeStamps}
                    onChange={(e) => setWelcomeStamps(parseInt(e.target.value) || 0)}
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
                  min={1}
                  value={pointsPerCurrency}
                  onChange={(e) => setPointsPerCurrency(parseInt(e.target.value) || 1)}
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
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              {t('setup.nextStep')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Define Rewards */}
      {step === 3 && (
        <div className="setup-step">
          <h2 className="setup-step-title">{t('setup.defineRewards')}</h2>

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
                  min={1}
                  value={tier.threshold}
                  onChange={(e) =>
                    updateTier(tier.id, 'threshold', parseInt(e.target.value) || 1)
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
              disabled={submitting || tiers.some((tier) => !tier.name || !tier.rewardName)}
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
