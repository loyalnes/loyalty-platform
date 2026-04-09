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
    <div className="app-page" style={{ textAlign: 'center' }}>
      <header className="app-page-header">
        <button className="app-page-back" onClick={() => navigate(-1)}>
          <X size={20} />
        </button>
        <div>
          <h1 className="app-page-title">{t('showReviewQR.title', 'Customer Reviews')}</h1>
          <p className="app-page-subtitle">{t('showReviewQR.subtitle', 'Scan to leave a review')}</p>
        </div>
      </header>

      <div className="app-surface-card" style={{ padding: '32px', display: 'inline-block', margin: '24px auto' }}>
        <QRCodeSVG
          value={reviewUrl}
          size={240}
          level="H"
          includeMargin
        />
      </div>

      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', padding: '0 24px' }}>
        {t('showReviewQR.instruction', 'Let customers scan this QR code to leave a review')}
      </p>

      <div style={{ display: 'flex', gap: '12px', padding: '0 24px', marginBottom: '24px' }}>
        <button className="btn btn-secondary" onClick={handleCopy} style={{ flex: 1 }}>
          {copied ? <><Check size={16} /> {t('showQR.copied')}</> : <><Copy size={16} /> {t('showQR.copyLink')}</>}
        </button>
        <button className="btn btn-primary" onClick={handleShare} style={{ flex: 1 }}>
          <Share2 size={16} /> {t('showQR.share')}
        </button>
      </div>
    </div>
  );
}
