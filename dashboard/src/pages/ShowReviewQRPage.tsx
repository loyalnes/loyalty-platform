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

  const reviewUrl = `${window.location.origin}/app/review/${merchant?.id}`;

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
          title: t('showReviewQR.shareTitle', { name: merchant?.name, defaultValue: 'Review {{name}}' }),
          text: t('showReviewQR.shareText', 'Tell us about your experience!'),
          url: reviewUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  }

  return (
    <div className="app-page stack-lg show-review-qr-page">
      <header className="app-page-header">
        <div className="app-page-header-row">
          <button className="app-page-back" onClick={() => navigate(-1)}>
            <X size={20} />
          </button>
          <div className="app-page-header-copy">
            <span className="app-page-kicker">{t('showReviewQR.title', 'Customer Reviews')}</span>
            <h1 className="app-page-title">{t('showReviewQR.title', 'Customer Reviews')}</h1>
          </div>
        </div>
        <p className="app-page-subtitle">{t('showReviewQR.subtitle', 'Scan to leave a review')}</p>
      </header>

      <section className="app-surface-card app-surface-card-muted">
        <div className="app-surface-body show-review-qr-card">
          <div className="show-review-qr-code">
            <QRCodeSVG
              value={reviewUrl}
              size={240}
              level="H"
              includeMargin
            />
          </div>
        </div>
      </section>

      <p className="show-review-qr-instruction">
        {t('showReviewQR.instruction', 'Let customers scan this QR code to leave a review')}
      </p>

      <div className="show-review-qr-actions">
        <button className="btn btn-secondary" onClick={handleCopy}>
          {copied ? <><Check size={16} /> {t('showQR.copied')}</> : <><Copy size={16} /> {t('showQR.copyLink')}</>}
        </button>
        <button className="btn btn-primary" onClick={handleShare}>
          <Share2 size={16} /> {t('showQR.share')}
        </button>
      </div>
    </div>
  );
}
