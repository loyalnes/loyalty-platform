import { useTranslation } from 'react-i18next';

interface KPICardProps {
  title: string;
  value: string;
  trend: number | null;
}

function getTrendClass(trend: number | null): string {
  if (trend === null) return 'neutral';
  if (trend > 0) return 'up';
  if (trend < 0) return 'down';
  return 'neutral';
}

function getTrendArrow(trend: number | null): string {
  if (trend === null || trend === 0) return '→';
  return trend > 0 ? '↗' : '↘';
}

export default function KPICard({ title, value, trend }: KPICardProps) {
  const { t } = useTranslation();

  return (
    <article className="kpi-card">
      <p className="kpi-title">{title}</p>
      <p className="kpi-value">{value}</p>
      <p className={`kpi-trend ${getTrendClass(trend)}`}>
        <span className="kpi-trend-arrow">{getTrendArrow(trend)}</span>
        {trend === null ? t('insights.trendUnavailable') : `${Math.abs(trend).toFixed(1)}% ${t('insights.vsPrevious')}`}
      </p>
    </article>
  );
}
