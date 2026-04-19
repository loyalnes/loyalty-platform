import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listCustomers, getCustomerCard, type MerchantCustomer, type CustomerCardDetail } from '../api';
import { formatDate, formatNumber } from '../i18n';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import CustomerProfileModal from '../components/CustomerProfileModal';

const PAGE_SIZE = 20;

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export default function CustomersPage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<MerchantCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCardDetail | null>(null);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadCustomers = useCallback(async (targetPage: number, currentQuery: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await listCustomers(targetPage, PAGE_SIZE, currentQuery);

      if (append) {
        setCustomers(prev => [...prev, ...res.data]);
      } else {
        setCustomers(res.data);
      }

      setTotal(res.total);
      // Calculate hasMore based on total
      setHasMore(targetPage * PAGE_SIZE < res.total);
    } catch {
      if (!append) {
        setCustomers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setCustomers([]);
    void loadCustomers(1, debouncedQuery, false);
  }, [debouncedQuery, loadCustomers]);

  const summary = useMemo(() => {
    const active = customers.filter((item) => item.status === 'ACTIVE').length;
    return { total: customers.length, active };
  }, [customers]);

  const handleRefresh = async () => {
    setPage(1);
    await loadCustomers(1, debouncedQuery, false);
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      void loadCustomers(nextPage, debouncedQuery, true);
    }
  }, [loadingMore, hasMore, page, debouncedQuery, loadCustomers]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;

    if (bottom && hasMore && !loadingMore) {
      handleLoadMore();
    }
  }, [hasMore, loadingMore, handleLoadMore]);

  const handleCustomerClick = async (customerId: string) => {
    setLoadingCustomerDetail(true);
    try {
      const detail = await getCustomerCard(customerId);
      setSelectedCustomer(detail);
    } catch (error) {
      console.error('Failed to load customer details:', error);
    } finally {
      setLoadingCustomerDetail(false);
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div
        className="app-page stack-lg"
        onScroll={handleScroll}
        style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}
      >
        <header className="app-page-header">
          <div className="app-page-header-row">
            <div>
              <span className="app-page-kicker">{t('customers.title')}</span>
              <h1 className="app-page-title">{t('customers.title')}</h1>
            </div>
            <button type="button" className="app-action-icon" onClick={handleRefresh}>
              <RefreshCw size={16} />
            </button>
          </div>
          <p className="app-page-subtitle">{t('customers.searchPlaceholder')}</p>
        </header>

      <section className="app-surface-card app-surface-card-muted">
        <div className="app-surface-body app-form-stack">
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

          <div className="app-stat-grid">
            <div className="app-stat-card card-technical">
              <div className="app-stat-label kpi-label">{t('customers.total')}</div>
              <div className="app-stat-value kpi-value text-data">{formatNumber(total, i18n.language)}</div>
            </div>
            <div className="app-stat-card card-technical">
              <div className="app-stat-label kpi-label">{t('customers.active')}</div>
              <div className="app-stat-value kpi-value text-data">{formatNumber(summary.active, i18n.language)}</div>
            </div>
          </div>
        </div>
      </section>

        {loading ? (
          <div className="customers-empty">{t('common.loading')}</div>
        ) : customers.length === 0 ? (
          <div className="customers-empty">{t('customers.empty')}</div>
        ) : (
          <>
            <div className="app-card-grid">
              {customers.map((customer) => (
                <article
                  key={customer.id}
                  className="app-surface-card card-technical"
                  onClick={() => handleCustomerClick(customer.customerId)}
                  style={{ cursor: 'pointer', minHeight: '80px' }}
                >
                  <div className="app-surface-body customer-row">
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
                      <p className="customer-points-value text-data">{formatNumber(customer.pointsBalance, i18n.language)}</p>
                      <p className="customer-points-label kpi-label">{t('customers.points')}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <RefreshCw size={20} className="spin" />
                <p>{t('common.loading')}</p>
              </div>
            )}

            {!hasMore && customers.length > 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                {t('customers.endOfList') || 'End of list'}
              </div>
            )}
          </>
        )}

        {/* Bottom Sheet for Customer Details */}
        {selectedCustomer && !loadingCustomerDetail && (
          <CustomerProfileModal
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
