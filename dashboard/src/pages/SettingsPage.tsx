import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { updateMerchantMe } from '../api';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { merchant } = useAuth();
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (merchant) {
      try {
        const settings = JSON.parse(merchant.settings || '{}');
        setGoogleMapsUrl(settings.googleMapsUrl || '');
      } catch {
        setGoogleMapsUrl('');
      }
    }
  }, [merchant]);

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  async function handleSave() {
    if (!isValidUrl(googleMapsUrl)) {
      setError(t('settings.invalidUrl', 'Please enter a valid URL'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const currentSettings = JSON.parse(merchant?.settings || '{}');
      const newSettings = { ...currentSettings, googleMapsUrl: googleMapsUrl.trim() || null };

      await updateMerchantMe({ settings: JSON.stringify(newSettings) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.saveFailed', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page stack-lg">
      <header className="app-page-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="app-page-title">{t('settings.title', 'Settings')}</h1>
          <p className="app-page-subtitle">{t('settings.subtitle', 'Configure your account')}</p>
        </div>
      </header>

      <section className="app-surface-card stack-md">
        <h2 className="text-label-large">{t('settings.reviewFlow', 'Review Flow')}</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>
          {t('settings.reviewFlowDesc', 'When customers give 5 stars, they\'ll be redirected to leave a Google Maps review.')}
        </p>

        <div className="form-group">
          <label>{t('settings.googleMapsUrl', 'Google Maps Review URL')}</label>
          <input
            type="url"
            value={googleMapsUrl}
            onChange={(e) => { setGoogleMapsUrl(e.target.value); setSaved(false); }}
            placeholder="https://maps.google.com/..."
          />
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {t('settings.googleMapsHint', 'Find your business on Google Maps, click "Write a review", and copy the URL.')}
          </p>
        </div>

        {error && <div className="error" style={{ background: '#fee', color: '#c33', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>{error}</div>}

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !isValidUrl(googleMapsUrl)}
        >
          {saved ? <><Check size={16} /> {t('settings.saved', 'Saved!')}</> : saving ? t('settings.saving', 'Saving...') : <><Save size={16} /> {t('settings.save', 'Save Settings')}</>}
        </button>
      </section>
    </div>
  );
}
