import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    // Fire confetti burst from top
    const duration = 2000;
    const end = Date.now() + duration;

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.1 },
        colors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.1 },
        colors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }
    frame();
  }, []);

  return (
    <div className="welcome-page">
      <div className="welcome-content">
        <div className="welcome-illustration">
          <div className="welcome-circle" />
        </div>
        <h1 className="welcome-title">{t('welcome.title')}</h1>
        <p className="welcome-subtitle">{t('welcome.subtitle')}</p>
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() => navigate('/setup')}
        >
          {t('welcome.cta')}
        </button>
      </div>
    </div>
  );
}
