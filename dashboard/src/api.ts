const API_BASE = '/api';

function getApiKey(): string {
  return localStorage.getItem('merchantApiKey') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': getApiKey(),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ---------- Merchants ----------

export interface Merchant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  plan: string;
  preferredLocale: 'en' | 'it' | 'es';
  active: boolean;
  createdAt: string;
  cardTemplates?: CardTemplate[];
}

export function getMerchant(id: string) {
  return request<Merchant>(`/merchants/${id}`);
}

// ---------- Cards ----------

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export interface CardTemplate {
  id: string;
  name: string;
  tier: string;
  pointsPerCurrency: string;
  redemptionRate: string;
  minRedeemPoints: number;
}

export interface LoyaltyCard {
  id: string;
  cardNumber: string;
  merchantId: string;
  customerId: string;
  status: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  issuedAt: string;
  expiresAt: string | null;
  customer: Customer;
  cardTemplate: CardTemplate | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function listCards(page = 1, limit = 20, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return request<PaginatedResponse<LoyaltyCard>>(`/cards?${params}`);
}

export function getCard(id: string) {
  return request<LoyaltyCard>(`/cards/${id}`);
}

export function updateCardStatus(id: string, status: string) {
  return request<LoyaltyCard>(`/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ---------- Points ----------

export interface PointsTransaction {
  id: string;
  loyaltyCardId: string;
  type: string;
  points: number;
  balanceAfter: number;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface BalanceInfo {
  id: string;
  cardNumber: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  status: string;
}

export function getCardBalance(cardId: string) {
  return request<BalanceInfo>(`/points/balance/${cardId}`);
}

export function getTransactionHistory(cardId: string, page = 1, limit = 20, type?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set('type', type);
  return request<PaginatedResponse<PointsTransaction>>(`/points/history/${cardId}?${params}`);
}

export function earnPoints(loyaltyCardId: string, points: number, description?: string) {
  return request<{ transaction: PointsTransaction; balance: number }>('/points/earn', {
    method: 'POST',
    body: JSON.stringify({ loyaltyCardId, points, description }),
  });
}

export function redeemPoints(loyaltyCardId: string, points: number, description?: string) {
  return request<{ transaction: PointsTransaction; balance: number }>('/points/redeem', {
    method: 'POST',
    body: JSON.stringify({ loyaltyCardId, points, description }),
  });
}
