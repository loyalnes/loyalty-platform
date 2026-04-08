import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Share2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';

export default function ShowQRPage() {
  const { t } = useTranslation();
  const { merchant } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Customer acquisition through gamification
  // In development, Vite runs on different port than backend
  const apiOrigin = window.location.port === '5174' || window.location.port === '5173' || window.location.port === '5175'
    ? 'http://localhost:3000'
    : window.location.origin;
  const signupUrl = `${apiOrigin}/app/play/${merchant?.id}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('showQR.shareTitle', { name: merchant?.name }),
          text: t('showQR.shareText', { name: merchant?.name }),
          url: signupUrl,
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  }

  return (
    <div className="app-page stack-lg">
      <header className="app-page-header">
        <div className="app-page-header-row">
          <button className="app-page-back" onClick={() => navigate('/')}>
          <X size={24} />
        </button>
          <div style={{ flex: 1 }}>
            <span className="app-page-kicker">{t('showQR.title')}</span>
            <h1 className="app-page-title">{merchant?.name}</h1>
          </div>
        </div>
        <p className="app-page-subtitle">{t('showQR.subtitle', 'Scan to play & win prizes!')}</p>
      </header>

      <section className="app-surface-card app-surface-card-muted">
        <div className="app-surface-body" style={{ textAlign: 'center' }}>
          <div className="show-qr-merchant">
            <div className="show-qr-merchant-name">{merchant?.name}</div>
            <div className="show-qr-merchant-subtitle">{t('showQR.subtitle', 'Scan to play & win prizes!')}</div>
          </div>

          <div className="show-qr-code">
            <QRCodeSVG
              value={signupUrl}
              size={240}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          <div className="show-qr-instruction">{t('showQR.instruction', 'Let customers scan this QR code to play the game and join your loyalty program')}</div>
        </div>
      </section>

        <div className="show-qr-actions">
          <button className="btn btn-secondary" onClick={handleCopy}>
            {copied ? <Check size={20} /> : <Copy size={20} />}
            <span>{copied ? t('showQR.copied') : t('showQR.copyLink')}</span>
          </button>
          <button className="btn btn-primary" onClick={handleShare}>
            <Share2 size={20} />
            <span>{t('showQR.share')}</span>
          </button>
        </div>
    </div>
  );
}
