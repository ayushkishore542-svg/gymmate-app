import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { calorieAPI } from '../utils/api';
import StartTrialModal from './StartTrialModal';
import './CalorieTracker.css';

/**
 * SubscriptionCard — 4 states:
 *   not_subscribed | trial | active | expired
 * Shown on MemberDashboard.
 */
export default function SubscriptionCard() {
  const navigate = useNavigate();
  const [status, setStatus]       = useState(null);   // subscription status object
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await calorieAPI.getStatus();
      setStatus(data);
    } catch {
      // 403 means not subscribed — the error response has an `action` field
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleTrialStarted = () => { fetchStatus(); };

  if (loading) {
    return (
      <div className="ct-sub-card" style={{ height: 80, opacity: 0.5 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading…</div>
      </div>
    );
  }

  // ── Not subscribed ────────────────────────────────────────────────────────
  if (!status || !status.status || status.status === 'not_subscribed' || status.status === 'cancelled') {
    return (
      <>
        <div className="ct-sub-card ct-unsubscribed">
          <span className="ct-sub-badge premium">✨ Premium Add-on</span>
          <h3 className="ct-sub-title">Calorie Tracker Pro</h3>
          <p className="ct-sub-desc">
            Log meals, track macros, hit your water goal — all in one place.
            Start your 7-day free trial today.
          </p>
          <ul className="ct-sub-features">
            <li>Meal logging with 100+ Indian foods</li>
            <li>Protein / Carbs / Fats tracking</li>
            <li>Water intake tracker</li>
            <li>Cheat day mode + weekly insights</li>
          </ul>
          <button className="ct-sub-btn primary" onClick={() => setShowModal(true)}>
            🚀 Start Free Trial
          </button>
        </div>
        {showModal && (
          <StartTrialModal
            onClose={() => setShowModal(false)}
            onTrialStarted={handleTrialStarted}
          />
        )}
      </>
    );
  }

  // ── Trial active ─────────────────────────────────────────────────────────
  if (status.status === 'trial') {
    const days = status.days_remaining ?? 0;
    const urgent = days <= 2;
    return (
      <div className="ct-sub-card">
        <div className="ct-sub-status-row">
          <span className="ct-sub-badge trial">🎉 Free Trial</span>
          <span className={`ct-days-pill${urgent ? ' urgent' : ''}`}>
            {days <= 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          {urgent
            ? 'Your trial is ending soon. Subscribe to keep your progress.'
            : 'You have full access to all premium features.'}
        </p>
        <button className="ct-go-btn" onClick={() => navigate('/calorie-tracker')}>
          Open Calorie Tracker →
        </button>
        {urgent && (
          <button
            className="ct-sub-btn secondary"
            style={{ marginTop: 8 }}
            onClick={() => alert('Razorpay integration coming soon!')}
          >
            Subscribe — ₹99/month
          </button>
        )}
      </div>
    );
  }

  // ── Active subscription ───────────────────────────────────────────────────
  if (status.status === 'active') {
    const days = status.days_remaining ?? 0;
    return (
      <div className="ct-sub-card">
        <div className="ct-sub-status-row">
          <span className="ct-sub-badge active">✅ Active</span>
          <span className="ct-days-pill">Renews in {days} day{days === 1 ? '' : 's'}</span>
        </div>
        <button className="ct-go-btn" onClick={() => navigate('/calorie-tracker')}>
          Open Calorie Tracker →
        </button>
      </div>
    );
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (status.status === 'expired') {
    return (
      <div className="ct-sub-card">
        <span className="ct-sub-badge expired">⏰ Expired</span>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 12px' }}>
          Your subscription has expired. Renew to continue tracking.
        </p>
        <button
          className="ct-sub-btn primary"
          onClick={() => alert('Razorpay integration coming soon!')}
        >
          Renew — ₹99/month
        </button>
      </div>
    );
  }

  return null;
}
