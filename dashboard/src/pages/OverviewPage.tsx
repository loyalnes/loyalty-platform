import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { listCards, type LoyaltyCard } from '../api';

export default function OverviewPage() {
  const { merchant } = useAuth();
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCards(1, 100)
      .then((res) => {
        setCards(res.data);
        setTotalCards(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCards = cards.filter((c) => c.status === 'ACTIVE').length;
  const totalPointsIssued = cards.reduce((sum, c) => sum + c.totalEarned, 0);
  const totalPointsRedeemed = cards.reduce((sum, c) => sum + c.totalRedeemed, 0);
  const uniqueCustomers = new Set(cards.map((c) => c.customerId)).size;

  if (loading) return <div className="empty-state">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Customers</h3>
          <div className="value">{uniqueCustomers}</div>
        </div>
        <div className="stat-card">
          <h3>Active Cards</h3>
          <div className="value">{activeCards}</div>
        </div>
        <div className="stat-card">
          <h3>Total Cards</h3>
          <div className="value">{totalCards}</div>
        </div>
        <div className="stat-card">
          <h3>Points Issued</h3>
          <div className="value">{totalPointsIssued.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Points Redeemed</h3>
          <div className="value">{totalPointsRedeemed.toLocaleString()}</div>
        </div>
      </div>

      {merchant && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Merchant Info</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Name</td><td>{merchant.name}</td></tr>
              <tr><td>Email</td><td>{merchant.email}</td></tr>
              <tr><td>Plan</td><td>{merchant.plan}</td></tr>
              <tr><td>Location</td><td>{[merchant.city, merchant.country].filter(Boolean).join(', ') || '-'}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
