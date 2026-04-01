import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getMerchant, getMerchantByEmail, type Merchant } from './api';
import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n';

interface AuthState {
  merchant: Merchant | null;
  loading: boolean;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem('merchantApiKey'));
  const { i18n } = useTranslation();

  function applyMerchantLocale(m: Merchant) {
    if (m.preferredLocale && SUPPORTED_LOCALES.includes(m.preferredLocale as SupportedLocale)) {
      i18n.changeLanguage(m.preferredLocale);
      localStorage.setItem('preferredLocale', m.preferredLocale);
    }
  }

  useEffect(() => {
    const key = localStorage.getItem('merchantApiKey');
    if (!key) return;
    let cancelled = false;
    getMerchant(key)
      .then((m) => {
        if (!cancelled) {
          setMerchant(m);
          applyMerchantLocale(m);
        }
      })
      .catch(() => localStorage.removeItem('merchantApiKey'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string) {
    const m = await getMerchantByEmail(email);
    localStorage.setItem('merchantApiKey', m.id);
    setMerchant(m);
    applyMerchantLocale(m);
  }

  function logout() {
    localStorage.removeItem('merchantApiKey');
    setMerchant(null);
  }

  return (
    <AuthContext.Provider value={{ merchant, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
