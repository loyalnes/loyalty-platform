import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getMerchant, type Merchant } from './api';

interface AuthState {
  merchant: Merchant | null;
  loading: boolean;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = localStorage.getItem('merchantApiKey');
    if (key) {
      getMerchant(key)
        .then(setMerchant)
        .catch(() => localStorage.removeItem('merchantApiKey'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(apiKey: string) {
    localStorage.setItem('merchantApiKey', apiKey);
    const m = await getMerchant(apiKey);
    setMerchant(m);
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
