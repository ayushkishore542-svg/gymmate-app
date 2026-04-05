import React, { useState } from 'react';
import { calorieAPI } from '../utils/api';
import './CalorieTracker.css';

const FEATURES = [
  { icon: '🍽️', name: 'Meal Logging',    desc: 'Up to 7 meals/day' },
  { icon: '📊', name: 'Macro Tracking',  desc: 'P / C / F goals' },
  { icon: '💧', name: 'Water Tracker',   desc: '8-glass goal' },
  { icon: '🔥', name: 'Weekly Stats',    desc: 'Streak & averages' },
  { icon: '🍕', name: 'Cheat Day Mode',  desc: 'No guilt tracking' },
  { icon: '⚡', name: 'Quick Log',       desc: 'Saved meal presets' },
];

export default function StartTrialModal({ onClose, onTrialStarted }) {
  const [loading, setLoading] = useState(false);

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      await calorieAPI.startTrial();
      onTrialStarted?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not start trial. Please try again.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ct-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-modal" role="dialog" aria-modal="true" aria-labelledby="trial-modal-title">
        <button className="ct-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="ct-modal-emoji">🥗</div>

        <h2 className="ct-modal-title" id="trial-modal-title">Calorie Tracker Pro</h2>
        <p className="ct-modal-sub">Track nutrition, hit your macros, and reach your fitness goals.</p>

        <div className="ct-trial-badge">
          🎉 7-Day Free Trial — No card required
        </div>

        <div className="ct-feature-grid">
          {FEATURES.map(f => (
            <div key={f.name} className="ct-feature-item">
              <div className="ct-feature-icon">{f.icon}</div>
              <p className="ct-feature-name">{f.name}</p>
              <p className="ct-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="ct-price-row">
          <div>
            <div className="ct-price-label">After trial ends</div>
            <div className="ct-price-note">Cancel anytime</div>
          </div>
          <div className="ct-price-val">₹99 / month</div>
        </div>

        <div className="ct-modal-cta">
          <button
            className="ct-cta-btn start"
            onClick={handleStartTrial}
            disabled={loading}
          >
            {loading ? 'Starting Trial…' : '🚀 Start Free Trial'}
          </button>
          <button className="ct-cta-btn ghost" onClick={onClose}>
            Maybe later
          </button>
        </div>

        <p className="ct-terms">
          By starting the trial you agree to the terms of service.
          You will not be charged during the 7-day trial period.
        </p>
      </div>
    </div>
  );
}
