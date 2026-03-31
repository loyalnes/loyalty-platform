import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listCards, updateCardStatus, type LoyaltyCard } from '../api';
import { formatNumber } from '../i18n';

export default function CardsPage() {
  const { t, i18n } = useTranslation();
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
        <h1>{t('cards.title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }}
            >
              <option value="">{t('cards.allStatuses')}</option>
              <option value="ACTIVE">{t('cards.active')}</option>
              <option value="SUSPENDED">{t('cards.suspended')}</option>
              <option value="EXPIRED">{t('cards.expired')}</option>
              <option value="CANCELLED">{t('cards.cancelled')}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">{t('common.loading')}</div>
      ) : cards.length === 0 ? (
        <div className="empty-state">{t('cards.noCards')}</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('cards.cardNumber')}</th>
                <th>{t('cards.customer')}</th>
                <th>{t('cards.status')}</th>
                <th>{t('cards.balance')}</th>
                <th>{t('cards.earned')}</th>
                <th>{t('cards.redeemed')}</th>
                <th>{t('cards.actions')}</th>
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
                  <td>{formatNumber(card.pointsBalance, i18n.language)}</td>
                  <td>{formatNumber(card.totalEarned, i18n.language)}</td>
                  <td>{formatNumber(card.totalRedeemed, i18n.language)}</td>
                  <td>
                    {card.status === 'ACTIVE' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleStatusChange(card.id, 'SUSPENDED')}
                      >
                        {t('cards.suspend')}
                      </button>
                    )}
                    {card.status === 'SUSPENDED' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleStatusChange(card.id, 'ACTIVE')}
                      >
                        {t('cards.activate')}
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
                {t('common.previous')}
              </button>
              <span>{t('common.page', { page, totalPages })}</span>
              <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t('common.next')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
