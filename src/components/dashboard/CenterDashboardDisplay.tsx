
"use client";
import type { CenterDashboardData } from '@/lib/types';
import MetricCard from './MetricCard';

interface CenterDashboardDisplayProps {
  data: CenterDashboardData;
}

export default function CenterDashboardDisplay({ data }: CenterDashboardDisplayProps) {
  if (!data) {
    return <p>No dashboard data available for this center.</p>;
  }

  const metrics = [
    data.dailySales,
    data.chargebackPercentage,
    data.flowThroughRate,
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
