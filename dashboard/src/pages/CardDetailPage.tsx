import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getCard,
  getTransactionHistory,
  earnPoints,
  redeemPoints,
  type LoyaltyCard,
  type PointsTransaction,
} from '../api';

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Points form
  const [action, setAction] = useState<'earn' | 'redeem'>('earn');
  const [points, setPoints] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const txLimit = 20;

  function loadCard() {
    if (!id) return;
    getCard(id).then(setCard).catch(() => setError('Card not found'));
  }

  function loadTransactions() {
    if (!id) return;
    getTransactionHistory(id, txPage, txLimit)
      .then((res) => {
        setTransactions(res.data);
        setTxTotal(res.total);
      })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      id ? getCard(id) : Promise.reject(),
      id ? getTransactionHistory(id, 1, txLimit) : Promise.reject(),
    ])
      .then(([c, tx]) => {
        setCard(c);
        setTransactions(tx.data);
        setTxTotal(tx.total);
      })
      .catch(() => setError('Card not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading) loadTransactions();
  }, [txPage]);

  async function handlePointsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !points) return;
    setSubmitting(true);
    setError('');
    try {
      const pts = parseInt(points, 10);
      if (action === 'earn') {
        await earnPoints(id, pts, description || undefined);
      } else {
        await redeemPoints(id, pts, description || undefined);
      }
      setPoints('');
      setDescription('');
      loadCard();
      loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="empty-state">Loading...</div>;
  if (!card) return <div className="empty-state">{error || 'Card not found'}</div>;

  const txTotalPages = Math.ceil(txTotal / txLimit);

  return (
    <div>
      <div className="page-header">
        <h1>Card: {card.cardNumber}</h1>
        <Link to="/cards" className="btn">Back to Cards</Link>
      </div>

      <div className="detail-grid">
        <div className="detail-item">
          <label>Customer</label>
          <div className="value">{card.customer.firstName} {card.customer.lastName}</div>
        </div>
        <div className="detail-item">
          <label>Email</label>
          <div className="value">{card.customer.email}</div>
        </div>
        <div className="detail-item">
          <label>Status</label>
          <div className="value">
            <span className={`badge badge-${card.status.toLowerCase()}`}>{card.status}</span>
          </div>
        </div>
        <div className="detail-item">
          <label>Points Balance</label>
          <div className="value">{card.pointsBalance.toLocaleString()}</div>
        </div>
        <div className="detail-item">
          <label>Total Earned</label>
          <div className="value">{card.totalEarned.toLocaleString()}</div>
        </div>
        <div className="detail-item">
          <label>Total Redeemed</label>
          <div className="value">{card.totalRedeemed.toLocaleString()}</div>
        </div>
        <div className="detail-item">
          <label>Template</label>
          <div className="value">{card.cardTemplate?.name || '-'} {card.cardTemplate ? `(${card.cardTemplate.tier})` : ''}</div>
        </div>
        <div className="detail-item">
          <label>Issued</label>
          <div className="value">{new Date(card.issuedAt).toLocaleDateString()}</div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {card.status === 'ACTIVE' && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Issue / Redeem Points</h2>
          <form onSubmit={handlePointsSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Action</label>
              <select value={action} onChange={(e) => setAction(e.target.value as 'earn' | 'redeem')}>
                <option value="earn">Earn Points</option>
                <option value="redeem">Redeem Points</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Points</label>
              <input
                type="number"
                min="1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="100"
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
              <label>Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Purchase, reward, etc."
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Processing...' : action === 'earn' ? 'Add Points' : 'Redeem Points'}
            </button>
          </form>
        </div>
      )}

      <h2 className="section-title">Transaction History</h2>
      {transactions.length === 0 ? (
        <div className="empty-state">No transactions yet.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Points</th>
                <th>Balance After</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${tx.type.toLowerCase()}`}>{tx.type}</span>
                  </td>
                  <td style={{ color: tx.points >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                  </td>
                  <td>{tx.balanceAfter.toLocaleString()}</td>
                  <td>{tx.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {txTotalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={txPage <= 1} onClick={() => setTxPage(txPage - 1)}>
                Previous
              </button>
              <span>Page {txPage} of {txTotalPages}</span>
              <button className="btn btn-sm" disabled={txPage >= txTotalPages} onClick={() => setTxPage(txPage + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
