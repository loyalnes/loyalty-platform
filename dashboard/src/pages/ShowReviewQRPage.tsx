import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Share2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';

export default function ShowReviewQRPage() {
  const { t } = useTranslation();
  const { merchant } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Customer review flow URL
  // In development, Vite runs on different port than backend
  const apiOrigin = window.location.port === '5174' || window.location.port === '5173' || window.location.port === '5175'
    ? 'http://localhost:3000'
    : window.location.origin;
  const reviewUrl = `${apiOrigin}/app/review/${merchant?.id}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reviewUrl);
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
          title: t('showReviewQR.shareTitle', { name: merchant?.name }),
          text: t('showReviewQR.shareText', { name: merchant?.name }),
          url: reviewUrl,
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
            <span className="app-page-kicker">{t('showReviewQR.title')}</span>
            <h1 className="app-page-title">{merchant?.name}</h1>
          </div>
        </div>
        <p className="app-page-subtitle">{t('showReviewQR.subtitle')}</p>
      </header>

      <section className="app-surface-card app-surface-card-muted">
        <div className="app-surface-body" style={{ textAlign: 'center' }}>
          <div className="show-qr-merchant">
            <div className="show-qr-merchant-name">{merchant?.name}</div>
            <div className="show-qr-merchant-subtitle">{t('showReviewQR.subtitle')}</div>
          </div>

          <div className="show-qr-code">
            <QRCodeSVG
              value={reviewUrl}
              size={240}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          <div className="show-qr-instruction">{t('showReviewQR.instruction')}</div>
        </div>
      </section>

      <div className="show-qr-actions">
        <button className="btn btn-secondary" onClick={handleCopy}>
          {copied ? <Check size={20} /> : <Copy size={20} />}
          <span>{copied ? t('showReviewQR.copied') : t('showReviewQR.copyLink')}</span>
        </button>
        <button className="btn btn-primary" onClick={handleShare}>
          <Share2 size={20} />
          <span>{t('showReviewQR.share')}</span>
        </button>
      </div>
    </div>
  );
}
