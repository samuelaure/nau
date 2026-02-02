import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, trendColor, icon }) => (
  <div className="stat-card">
    <div className="stat-label flex items-center gap-2">
      {icon} {label}
    </div>
    <div className="stat-value">{value}</div>
    {trend && (
      <div className="stat-trend" style={{ color: trendColor }}>
        {trend}
      </div>
    )}
  </div>
);
