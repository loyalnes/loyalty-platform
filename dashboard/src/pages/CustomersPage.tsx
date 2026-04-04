import { useEffect, useMemo, useRef, useState, type TouchEventHandler } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listCustomers, type MerchantCustomer } from '../api';
import { formatDate, formatNumber } from '../i18n';

const PAGE_SIZE = 20;

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<MerchantCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadCustomers = async (targetPage: number, currentQuery: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await listCustomers(targetPage, PAGE_SIZE, currentQuery);
      setCustomers(res.data);
      setTotal(res.total);
    } catch {
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadCustomers(page, debouncedQuery);
  }, [page, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = useMemo(() => {
    const active = customers.filter((item) => item.status === 'ACTIVE').length;
    return { total: customers.length, active };
  }, [customers]);

  const handleRefresh = () => {
    void loadCustomers(page, debouncedQuery, true);
  };

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    const appMain = document.querySelector('.app-main');
    if (appMain instanceof HTMLElement && appMain.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
    if (pullStartY.current === null) return;

    const appMain = document.querySelector('.app-main');
    if (!(appMain instanceof HTMLElement) || appMain.scrollTop > 0) {
      pullStartY.current = null;
      setPullDistance(0);
      return;
    }

    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(90, delta));
    }
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = () => {
    if (pullDistance > 60) handleRefresh();
    pullStartY.current = null;
    setPullDistance(0);
  };

  return (
    <div
      className="customers-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="customers-header">
        <h1 className="customers-title">{t('customers.title')}</h1>
        <button type="button" className="customers-refresh" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      <div className="customers-pull-indicator" style={{ height: pullDistance }}>
        {pullDistance > 40 && <span>{t('customers.pullToRefresh')}</span>}
      </div>

      <div className="customers-search-wrap">
        <Search size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('customers.searchPlaceholder')}
          aria-label={t('customers.searchPlaceholder')}
        />
      </div>

      <div className="customers-summary">
        <span>{t('customers.total')}: {formatNumber(total, i18n.language)}</span>
        <span>{t('customers.active')}: {formatNumber(summary.active, i18n.language)}</span>
      </div>

      {loading ? (
        <div className="customers-empty">{t('common.loading')}</div>
      ) : customers.length === 0 ? (
        <div className="customers-empty">{t('customers.empty')}</div>
      ) : (
        <div className="customers-list">
          {customers.map((customer) => (
            <article
              key={customer.id}
              className="customer-row"
              onClick={() => navigate(`/customers/${customer.customerId}`)}
            >
              <div className="customer-avatar">
                {customer.avatarUrl ? (
                  <img src={customer.avatarUrl} alt={`${customer.firstName} ${customer.lastName}`} />
                ) : (
                  <span>{getInitials(customer.firstName, customer.lastName)}</span>
                )}
              </div>

              <div className="customer-main">
                <p className="customer-name">{customer.firstName} {customer.lastName}</p>
                <p className="customer-contact">{customer.phone || customer.email}</p>
                <p className="customer-last-visit">
                  {t('customers.lastVisit')}: {formatDate(customer.lastVisitAt, i18n.language)}
                </p>
              </div>

              <div className="customer-points">
                <p className="customer-points-value">{formatNumber(customer.pointsBalance, i18n.language)}</p>
                <p className="customer-points-label">{t('customers.points')}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="customers-pagination">
          <button type="button" className="btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
            {t('common.previous')}
          </button>
          <span>{t('common.page', { page, totalPages })}</span>
          <button type="button" className="btn" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
