import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getCard,
  getTransactionHistory,
  earnPoints,
  redeemPoints,
  type LoyaltyCard,
  type PointsTransaction,
} from '../api';
import { formatNumber, formatDate, formatDateTime } from '../i18n';

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
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
  const lng = i18n.language;

  function loadCard() {
    if (!id) return;
    getCard(id).then(setCard).catch(() => setError(t('cardDetail.notFound')));
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
      .catch(() => setError(t('cardDetail.notFound')))
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
      setError(err instanceof Error ? err.message : t('cardDetail.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="empty-state">{t('common.loading')}</div>;
  if (!card) return <div className="empty-state">{error || t('cardDetail.notFound')}</div>;

  const txTotalPages = Math.ceil(txTotal / txLimit);

  return (
    <div>
      <div className="page-header">
        <h1>{t('cardDetail.cardTitle', { cardNumber: card.cardNumber })}</h1>
        <Link to="/cards" className="btn">{t('cardDetail.backToCards')}</Link>
      </div>

      <div className="detail-grid">
        <div className="detail-item">
          <label>{t('cardDetail.customer')}</label>
          <div className="value">{card.customer.firstName} {card.customer.lastName}</div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.email')}</label>
          <div className="value">{card.customer.email}</div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.status')}</label>
          <div className="value">
            <span className={`badge badge-${card.status.toLowerCase()}`}>{card.status}</span>
          </div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.pointsBalance')}</label>
          <div className="value">{formatNumber(card.pointsBalance, lng)}</div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.totalEarned')}</label>
          <div className="value">{formatNumber(card.totalEarned, lng)}</div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.totalRedeemed')}</label>
          <div className="value">{formatNumber(card.totalRedeemed, lng)}</div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.template')}</label>
          <div className="value">{card.cardTemplate?.name || t('common.na')} {card.cardTemplate ? `(${card.cardTemplate.tier})` : ''}</div>
        </div>
        <div className="detail-item">
          <label>{t('cardDetail.issued')}</label>
          <div className="value">{formatDate(card.issuedAt, lng)}</div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {card.status === 'ACTIVE' && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">{t('cardDetail.issueRedeemPoints')}</h2>
          <form onSubmit={handlePointsSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>{t('cardDetail.action')}</label>
              <select value={action} onChange={(e) => setAction(e.target.value as 'earn' | 'redeem')}>
                <option value="earn">{t('cardDetail.earnPoints')}</option>
                <option value="redeem">{t('cardDetail.redeemPoints')}</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>{t('cardDetail.points')}</label>
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
              <label>{t('cardDetail.descriptionOptional')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('cardDetail.descriptionPlaceholder')}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('cardDetail.processing') : action === 'earn' ? t('cardDetail.addPoints') : t('cardDetail.redeemPoints')}
            </button>
          </form>
        </div>
      )}

      <h2 className="section-title">{t('cardDetail.transactionHistory')}</h2>
      {transactions.length === 0 ? (
        <div className="empty-state">{t('cardDetail.noTransactions')}</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('cardDetail.date')}</th>
                <th>{t('cardDetail.type')}</th>
                <th>{t('cardDetail.points')}</th>
                <th>{t('cardDetail.balanceAfter')}</th>
                <th>{t('cardDetail.description')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{formatDateTime(tx.createdAt, lng)}</td>
                  <td>
                    <span className={`badge badge-${tx.type.toLowerCase()}`}>{tx.type}</span>
                  </td>
                  <td style={{ color: tx.points >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.points > 0 ? '+' : ''}{formatNumber(tx.points, lng)}
                  </td>
                  <td>{formatNumber(tx.balanceAfter, lng)}</td>
                  <td>{tx.description || t('common.na')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {txTotalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={txPage <= 1} onClick={() => setTxPage(txPage - 1)}>
                {t('common.previous')}
              </button>
              <span>{t('common.page', { page: txPage, totalPages: txTotalPages })}</span>
              <button className="btn btn-sm" disabled={txPage >= txTotalPages} onClick={() => setTxPage(txPage + 1)}>
                {t('common.next')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
