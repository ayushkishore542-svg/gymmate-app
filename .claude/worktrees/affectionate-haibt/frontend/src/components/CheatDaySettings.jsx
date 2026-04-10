import React, { useState, useEffect } from 'react';
import { calorieAPI } from '../utils/api';
import './CalorieTracker.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_EMOJIS = {
  Monday: '😤', Tuesday: '💪', Wednesday: '🏋️', Thursday: '🔥',
  Friday: '🎉', Saturday: '😎', Sunday: '😴',
};

export default function CheatDaySettings({ onClose }) {
  const [cheatDay, setCheatDay] = useState('Sunday');
  const [enabled,  setEnabled]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    calorieAPI.getCheatDay()
      .then(({ data }) => {
        setCheatDay(data.cheat_day || 'Sunday');
        setEnabled(!!data.enabled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await calorieAPI.saveCheatDay({ cheat_day: cheatDay, enabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const isToday   = enabled && cheatDay === todayName;

  return (
    <div className="ct-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ct-modal cds-modal" role="dialog" aria-modal="true" aria-labelledby="cds-title">
        <button className="ct-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="ct-modal-emoji">🍕</div>
        <h2 className="ct-modal-title" id="cds-title">Cheat Day Settings</h2>
        <p className="ct-modal-sub">
          Pick one day per week to eat freely — it won't count toward your weekly averages.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>Loading…</div>
        ) : (
          <>
            {/* Enable toggle */}
            <div className="cds-toggle-row">
              <div>
                <div className="cds-toggle-label">Enable Cheat Day</div>
                <div className="cds-toggle-sub">Excluded from weekly calorie averages</div>
              </div>
              <button
                className={`cds-toggle${enabled ? ' on' : ''}`}
                onClick={() => setEnabled(v => !v)}
                role="switch"
                aria-checked={enabled}
                aria-label="Enable cheat day"
              >
                <span className="cds-toggle-knob" />
              </button>
            </div>

            {/* Day picker */}
            <div className={`cds-days-section${!enabled ? ' cds-disabled' : ''}`}>
              <div className="cds-days-label">Which day?</div>
              <div className="cds-days-grid">
                {DAYS.map(day => (
                  <button
                    key={day}
                    className={`cds-day-btn${cheatDay === day ? ' selected' : ''}`}
                    onClick={() => enabled && setCheatDay(day)}
                    disabled={!enabled}
                    aria-pressed={cheatDay === day}
                  >
                    <span className="cds-day-emoji">{DAY_EMOJIS[day]}</span>
                    <span className="cds-day-name">{day.slice(0, 3)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview pill */}
            {enabled && (
              <div className={`cds-preview${isToday ? ' today' : ''}`}>
                {isToday
                  ? `🎉 Today (${todayName}) is your cheat day!`
                  : `🍕 Cheat day: every ${cheatDay}`}
              </div>
            )}

            <button
              className="ct-cta-btn start"
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: 'var(--sp-3)' }}
            >
              {saving ? 'Saving…' : saved ? '✅ Saved!' : 'Save Settings'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
