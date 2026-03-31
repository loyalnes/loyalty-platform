import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCards, updateCardStatus, type LoyaltyCard } from '../api';

export default function CardsPage() {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  function load() {
    setLoading(true);
    listCards(page, limit, statusFilter || undefined)
      .then((res) => {
        setCards(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [page, statusFilter]);

  async function handleStatusChange(cardId: string, newStatus: string) {
    try {
      await updateCardStatus(cardId, newStatus);
      load();
    } catch {
      // ignore
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <h1>Loyalty Cards</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : cards.length === 0 ? (
        <div className="empty-state">No loyalty cards found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Card Number</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Earned</th>
                <th>Redeemed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id}>
                  <td>
                    <Link to={`/cards/${card.id}`}>{card.cardNumber}</Link>
                  </td>
                  <td>{card.customer.firstName} {card.customer.lastName}</td>
                  <td>
                    <span className={`badge badge-${card.status.toLowerCase()}`}>
                      {card.status}
                    </span>
                  </td>
                  <td>{card.pointsBalance.toLocaleString()}</td>
                  <td>{card.totalEarned.toLocaleString()}</td>
                  <td>{card.totalRedeemed.toLocaleString()}</td>
                  <td>
                    {card.status === 'ACTIVE' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleStatusChange(card.id, 'SUSPENDED')}
                      >
                        Suspend
                      </button>
                    )}
                    {card.status === 'SUSPENDED' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleStatusChange(card.id, 'ACTIVE')}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
