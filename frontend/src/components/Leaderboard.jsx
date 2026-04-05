import React, { useState, useEffect, useCallback } from 'react';
import { calorieAPI } from '../utils/api';
import './CalorieTracker.css';

const MEDALS = ['🥇', '🥈', '🥉'];

function ScoreTooltip() {
  const [show, setShow] = useState(false);
  return (
    <span className="lb-score-info">
      <button
        className="lb-info-btn"
        onClick={() => setShow(v => !v)}
        aria-label="How scores are calculated"
      >
        ℹ️
      </button>
      {show && (
        <div className="lb-tooltip" role="tooltip">
          <strong>Score formula:</strong><br />
          (Days logged × 10) + (Avg protein ÷ 10)<br />
          <span style={{ opacity: 0.75, fontSize: 11 }}>Cheat days excluded from protein avg</span>
        </div>
      )}
    </span>
  );
}

function PodiumCard({ entry, isUser }) {
  const medal = MEDALS[entry.rank - 1];
  return (
    <div className={`lb-podium-card rank-${entry.rank}${isUser ? ' lb-you' : ''}`}>
      <div className="lb-medal">{medal}</div>
      <div className="lb-podium-name">{isUser ? 'You' : entry.name.split(' ')[0]}</div>
      <div className="lb-podium-score">{entry.score}</div>
      <div className="lb-podium-sub">{entry.streak_days}d · {entry.avg_protein}g P</div>
      {isUser && <span className="lb-you-tag">YOU</span>}
    </div>
  );
}

function ListRow({ entry, isUser }) {
  return (
    <div className={`lb-row${isUser ? ' lb-you' : ''}`}>
      <span className="lb-rank">#{entry.rank}</span>
      <span className="lb-name">{isUser ? `${entry.name} (You)` : entry.name}</span>
      <div className="lb-stats">
        <span className="lb-stat" title="Days logged">{entry.streak_days}d</span>
        <span className="lb-stat" title="Avg protein">{entry.avg_protein}g</span>
        <span className="lb-score-val">{entry.score}</span>
      </div>
    </div>
  );
}

export default function Leaderboard({ onClose }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const { data: res } = await calorieAPI.getLeaderboard();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await calorieAPI.calcLeaderboard();
      await fetch();
    } catch {
      // silent — stale data is fine
    } finally {
      setRefreshing(false);
    }
  };

  const rankings     = data?.rankings     || [];
  const userRank     = data?.user_rank    || null;
  const top3         = rankings.filter(r => r.rank <= 3);
  const rest         = rankings.filter(r => r.rank > 3);
  const userId       = userRank?.user_id;
  const userInTop3   = top3.some(r => r.user_id === userId);
  const userInRest   = rest.some(r => r.user_id === userId);
  // user is ranked but outside top 20 display
  const userBelow20  = userRank && !userInTop3 && !userInRest;

  const weekLabel = data?.week_start
    ? new Date(data.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  return (
    <div className="ct-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ct-modal lb-modal" role="dialog" aria-modal="true" aria-labelledby="lb-title">
        <button className="ct-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Header */}
        <div className="lb-header">
          <h2 className="ct-modal-title" id="lb-title" style={{ margin: 0 }}>🏆 Weekly Leaderboard</h2>
          <div className="lb-meta">
            {weekLabel && <span className="lb-week">Week of {weekLabel}</span>}
            <ScoreTooltip />
            <button
              className="lb-refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Recalculate now"
            >
              {refreshing ? '⏳' : '🔄'}
            </button>
          </div>
        </div>

        {data && (
          <div className="lb-participants">
            {data.total_participants} participant{data.total_participants !== 1 ? 's' : ''} this week
          </div>
        )}

        {loading ? (
          <div className="lb-loading">Calculating rankings…</div>
        ) : rankings.length === 0 ? (
          <div className="lb-empty">
            <div style={{ fontSize: 40 }}>🏋️</div>
            <p>No rankings yet — log meals to appear on the leaderboard!</p>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            {top3.length > 0 && (
              <div className="lb-podium">
                {/* Reorder: 2nd | 1st | 3rd for visual podium */}
                {[top3[1], top3[0], top3[2]].filter(Boolean).map(entry => (
                  <PodiumCard
                    key={entry.user_id}
                    entry={entry}
                    isUser={entry.user_id === userId}
                  />
                ))}
              </div>
            )}

            {/* Rest of the list */}
            {rest.length > 0 && (
              <div className="lb-list">
                <div className="lb-list-header">
                  <span>Player</span>
                  <span>Days · Protein · Score</span>
                </div>
                {rest.map(entry => (
                  <ListRow
                    key={entry.user_id}
                    entry={entry}
                    isUser={entry.user_id === userId}
                  />
                ))}
              </div>
            )}

            {/* User rank if they're outside the displayed top 20 */}
            {userBelow20 && (
              <div className="lb-user-rank-footer">
                <span>Your rank</span>
                <ListRow entry={userRank} isUser />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
