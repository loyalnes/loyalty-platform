import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Save, MapPin, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { merchant } = useAuth();
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load current settings
    if (merchant?.settings) {
      try {
        const settings = JSON.parse(merchant.settings);
        setGoogleMapsUrl(settings.googleMapsUrl || '');
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [merchant]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const apiKey = localStorage.getItem('merchantApiKey');
      const res = await fetch('/api/merchants/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || '',
        },
        body: JSON.stringify({
          settings: JSON.stringify({
            googleMapsUrl: googleMapsUrl.trim() || null,
            reviewFlowEnabled: true,
          }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return true; // Empty is valid (optional)
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const urlValid = isValidUrl(googleMapsUrl);

  return (
    <div className="app-page stack-lg">
      <header className="app-page-header">
        <div className="app-page-header-row">
          <button className="app-page-back" onClick={() => navigate('/menu')}>
            <X size={24} />
          </button>
          <div style={{ flex: 1 }}>
            <span className="app-page-kicker">{t('settings.title', 'Settings')}</span>
            <h1 className="app-page-title">{merchant?.name}</h1>
          </div>
        </div>
        <p className="app-page-subtitle">{t('settings.subtitle', 'Configure your business settings')}</p>
      </header>

      <section className="app-surface-card">
        <div className="app-surface-header">
          <div className="app-surface-header-icon">
            <MapPin size={20} />
          </div>
          <div className="app-surface-header-text">
            <h2 className="app-surface-title">{t('settings.googleMapsTitle', 'Google Maps Reviews')}</h2>
            <p className="app-surface-subtitle">
              {t('settings.googleMapsSubtitle', 'Redirect 5-star reviews to your Google Maps listing')}
            </p>
          </div>
        </div>

        <div className="app-surface-body stack-md">
          <div className="form-group">
            <label htmlFor="googleMapsUrl" className="form-label">
              {t('settings.googleMapsUrlLabel', 'Google Maps URL')}
              <span className="form-label-optional">{t('common.optional', 'Optional')}</span>
            </label>
            <input
              type="url"
              id="googleMapsUrl"
              className="form-input"
              placeholder="https://maps.app.goo.gl/..."
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
            />
            {!urlValid && googleMapsUrl.trim() && (
              <div className="form-hint form-hint-error">
                <AlertCircle size={14} />
                {t('settings.invalidUrl', 'Please enter a valid URL')}
              </div>
            )}
            <div className="form-hint">
              {t(
                'settings.googleMapsHint',
                'Find your business on Google Maps, click "Share", and paste the URL here'
              )}
            </div>
          </div>

          <div className="settings-info-box">
            <div className="settings-info-icon">💡</div>
            <div className="settings-info-text">
              <strong>{t('settings.howItWorks', 'How it works')}:</strong>
              <ul>
                <li>{t('settings.step1', 'Customers scan your review QR code')}</li>
                <li>{t('settings.step2', 'If they rate 5 stars, they are redirected to Google Maps')}</li>
                <li>{t('settings.step3', 'If they rate 1-4 stars, they leave internal feedback')}</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {saved && (
            <div className="alert alert-success">
              <Save size={16} />
              {t('settings.saved', 'Settings saved successfully!')}
            </div>
          )}
        </div>

        <div className="app-surface-footer">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !urlValid}
          >
            <Save size={20} />
            {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Settings')}
          </button>
        </div>
      </section>

      <section className="app-surface-card app-surface-card-muted">
        <div className="app-surface-header">
          <div className="app-surface-header-text">
            <h2 className="app-surface-title">{t('settings.exampleTitle', 'Example Google Maps URLs')}</h2>
          </div>
        </div>
        <div className="app-surface-body">
          <div className="settings-examples">
            <div className="settings-example-item">
              <code>https://maps.app.goo.gl/MgG2uraXdsnNkjao7</code>
              <span className="settings-example-label">{t('settings.shortUrl', 'Short URL (recommended)')}</span>
            </div>
            <div className="settings-example-item">
              <code>https://maps.google.com/?cid=1234567890</code>
              <span className="settings-example-label">{t('settings.cidUrl', 'CID URL')}</span>
            </div>
            <div className="settings-example-item">
              <code>https://g.page/your-business</code>
              <span className="settings-example-label">{t('settings.gPageUrl', 'G.page URL')}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
