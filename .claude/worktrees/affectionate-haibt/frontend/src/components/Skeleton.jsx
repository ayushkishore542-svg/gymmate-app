import React from 'react';
import './Skeleton.css';

/* Generic shimmer block */
export const Skeleton = ({ width = '100%', height = 16, radius = 8, className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius: radius }}
  />
);

/* Stat card skeleton */
export const SkeletonStatCard = () => (
  <div className="skeleton-stat-card">
    <Skeleton width={52} height={52} radius={14} />
    <div className="skeleton-stat-body">
      <Skeleton width="60%" height={14} radius={6} />
      <Skeleton width="80%" height={28} radius={6} />
      <Skeleton width="50%" height={12} radius={6} />
    </div>
  </div>
);

/* List item skeleton */
export const SkeletonListItem = () => (
  <div className="skeleton-list-item">
    <Skeleton width={44} height={44} radius={12} />
    <div className="skeleton-list-body">
      <Skeleton width="55%" height={14} radius={6} />
      <Skeleton width="80%" height={12} radius={6} />
    </div>
    <div className="skeleton-list-meta">
      <Skeleton width={64} height={20} radius={10} />
      <Skeleton width={80} height={12} radius={6} />
    </div>
  </div>
);

/* Chart area skeleton */
export const SkeletonChart = ({ height = 220 }) => (
  <div className="skeleton-chart" style={{ height }}>
    <div className="skeleton-chart-bars">
      {[60, 85, 45, 90, 70, 55, 80].map((h, i) => (
        <div key={i} className="skeleton-bar-wrap">
          <Skeleton width="100%" height={`${h}%`} radius={6} />
        </div>
      ))}
    </div>
    <div className="skeleton-chart-axis">
      {[...Array(7)].map((_, i) => (
        <Skeleton key={i} width={28} height={10} radius={4} />
      ))}
    </div>
  </div>
);

/* Full dashboard skeleton for OwnerDashboard */
export const OwnerDashboardSkeleton = () => (
  <div className="skeleton-dashboard">
    <div className="skeleton-header">
      <div>
        <Skeleton width={240} height={24} radius={8} />
        <Skeleton width={180} height={14} radius={6} style={{ marginTop: 8 }} />
      </div>
      <div className="skeleton-header-right">
        <Skeleton width={100} height={30} radius={15} />
        <Skeleton width={38} height={38} radius={19} />
      </div>
    </div>
    <div className="skeleton-stats-row">
      {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
    <div className="skeleton-charts-row">
      <div className="skeleton-chart-card"><SkeletonChart height={220} /></div>
      <div className="skeleton-chart-card"><SkeletonChart height={220} /></div>
    </div>
    <div className="skeleton-list-section">
      {[...Array(4)].map((_, i) => <SkeletonListItem key={i} />)}
    </div>
  </div>
);

/* Full dashboard skeleton for MemberDashboard */
export const MemberDashboardSkeleton = () => (
  <div className="skeleton-dashboard">
    <div className="skeleton-hero">
      <div className="skeleton-hero-left">
        <Skeleton width="45%" height={14} radius={6} />
        <Skeleton width="70%" height={28} radius={8} style={{ marginTop: 8 }} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} width="90%" height={36} radius={10} />
          ))}
        </div>
      </div>
      <Skeleton width={136} height={136} radius={68} />
    </div>
    <div className="skeleton-stats-row skeleton-stats-3">
      {[...Array(3)].map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
    <div className="skeleton-charts-row">
      <div className="skeleton-chart-card"><SkeletonChart height={180} /></div>
      <div className="skeleton-chart-card"><SkeletonChart height={180} /></div>
    </div>
  </div>
);

export default Skeleton;
