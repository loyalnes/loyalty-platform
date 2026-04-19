import { useTranslation } from 'react-i18next';
import type { InsightsPeriod } from '../api';

const PERIODS: InsightsPeriod[] = ['24h', '7d', '15d', '30d'];

interface TimeFilterProps {
  value: InsightsPeriod;
  onChange: (period: InsightsPeriod) => void;
}

export default function TimeFilter({ value, onChange }: TimeFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="insights-time-filter" role="tablist" aria-label={t('insights.periodLabel')}>
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="tab"
          aria-selected={value === period}
          className={`insights-period-btn${value === period ? ' active' : ''}`}
          onClick={() => onChange(period)}
        >
          {t(`insights.periods.${period}`)}
        </button>
      ))}
    </div>
  );
}
