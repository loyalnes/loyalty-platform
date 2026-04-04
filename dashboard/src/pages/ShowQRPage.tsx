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

  // TODO: Replace with actual customer signup URL when implemented
  const signupUrl = `${window.location.origin}/app/join/${merchant?.id}`;

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
    <div className="show-qr-page">
      <div className="show-qr-header">
        <button className="show-qr-close" onClick={() => navigate('/')}>
          <X size={24} />
        </button>
        <h1 className="show-qr-title">{t('showQR.title')}</h1>
      </div>

      <div className="show-qr-content">
        <div className="show-qr-card">
          <div className="show-qr-merchant">
            <div className="show-qr-merchant-name">{merchant?.name}</div>
            <div className="show-qr-merchant-subtitle">{t('showQR.subtitle')}</div>
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

          <div className="show-qr-instruction">{t('showQR.instruction')}</div>
        </div>

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
    </div>
  );
}
