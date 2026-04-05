import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { calorieAPI } from '../utils/api';
import MealLogger from './MealLogger';
import SavedMeals from './SavedMeals';
import ProgressPhotos from './ProgressPhotos';
import CheatDaySettings from './CheatDaySettings';
import Leaderboard from './Leaderboard';
import MacroPieChart from './MacroPieChart';
import './CalorieTracker.css';

const CIRCUMFERENCE = 2 * Math.PI * 44;   // r=44 → 276.5

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Ring({ consumed, goal, isCheatDay }) {
  const pct     = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const offset  = CIRCUMFERENCE * (1 - pct);
  const isOver  = consumed > goal;

  return (
    <div className="ctd-ring-wrap">
      <svg className="ctd-ring-svg" viewBox="0 0 100 100">
        <circle className="ctd-ring-bg"   cx="50" cy="50" r="44" />
        <circle
          className={`ctd-ring-fill${isOver ? ' over-limit' : ''}${isCheatDay ? ' cheat-day' : ''}`}
          cx="50" cy="50" r="44"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ctd-ring-center">
        <span className="ctd-ring-cal">{consumed}</span>
        <span className="ctd-ring-label">kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, goal, color }) {
  const pct  = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const over = consumed > goal;
  return (
    <div className="ctd-macro-row">
      <span className="ctd-macro-label">{label}</span>
      <div className="ctd-macro-bar-wrap">
        <div
          className={`ctd-macro-bar-fill ${color}${over ? ' over' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="ctd-macro-val">
        <span>{Math.round(consumed)}</span> / {goal}g
      </span>
    </div>
  );
}

export default function CalorieTrackerDashboard() {
  const navigate = useNavigate();

  const [todayMeals,   setTodayMeals]   = useState(null);
  const [weeklyData,   setWeeklyData]   = useState(null);
  const [waterData,    setWaterData]    = useState(null);
  const [goals,        setGoals]        = useState({ calorie_goal: 2000, protein_goal: 80, carbs_goal: 250, fats_goal: 65 });
  const [isCheatDay,   setIsCheatDay]   = useState(false);
  const [showLogger,      setShowLogger]      = useState(false);
  const [showSavedMeals,   setShowSavedMeals]   = useState(false);
  const [showProgress,     setShowProgress]     = useState(false);
  const [showCheatDay,     setShowCheatDay]     = useState(false);
  const [showLeaderboard,  setShowLeaderboard]  = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(null);
  const [waterLoading, setWaterLoading] = useState(false);
  const [waterError,   setWaterError]   = useState(null);
  const [newGlassIdx,  setNewGlassIdx]  = useState(-1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);
  const [deleteError,  setDeleteError]  = useState(null);

  const loadAll = useCallback(async () => {
    setFetchError(null);
    try {
      const [mealsRes, weekRes, waterRes, goalsRes, cheatRes] = await Promise.all([
        calorieAPI.getTodayMeals(),
        calorieAPI.getWeeklySummary(),
        calorieAPI.getTodayWater(),
        calorieAPI.getGoals(),
        calorieAPI.isCheatDay(),
      ]);
      setTodayMeals(mealsRes.data);
      setWeeklyData(weekRes.data);
      setWaterData(waterRes.data);
      setGoals(goalsRes.data);
      setIsCheatDay(cheatRes.data.is_cheat_day);
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Could not load nutrition data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLogWater = async () => {
    setWaterLoading(true);
    try {
      const { data } = await calorieAPI.logWater(250);
      const justFilledIdx = data.glasses_count - 1;   // 0-based index of new glass
      setNewGlassIdx(justFilledIdx);
      setTimeout(() => setNewGlassIdx(-1), 600);       // remove class after pop

      const wasAchieved = waterData?.achieved;
      setWaterData(prev => ({
        ...prev,
        total_ml:      data.total_ml,
        goal_ml:       data.goal_ml,
        achieved:      data.achieved,
        glasses_count: data.glasses_count,
      }));

      // Confetti only on the exact moment the goal is first hit
      if (data.achieved && !wasAchieved) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2800);
      }
    } catch (err) {
      setWaterError(err.response?.data?.message || 'Failed to log water');
      setTimeout(() => setWaterError(null), 3000);
    } finally {
      setWaterLoading(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    setDeletingId(mealId);
    setDeleteError(null);
    try {
      await calorieAPI.deleteMeal(mealId);
      await loadAll();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete meal');
      setTimeout(() => setDeleteError(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const summary = todayMeals?.daily_summary || { total_calories: 0, protein: 0, carbs: 0, fats: 0, meal_count: 0 };
  const meals   = todayMeals?.meals || [];

  const remaining  = goals.calorie_goal - summary.total_calories;
  const glassCount = waterData?.glasses_count || 0;
  const goalGlasses = Math.round((waterData?.goal_ml || 2000) / 250);

  // Weekly bar chart
  const today = new Date().getDay();   // 0=Sun

  if (loading) {
    return (
      <div className="ctd-wrapper">
        <div className="ctd-skeleton-header" />
        <div className="ctd-skeleton-bar" />
        <div className="ctd-body">
          <div className="ctd-skeleton-card" />
          <div className="ctd-skeleton-card ctd-skeleton-card--short" />
          <div className="ctd-skeleton-card" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="ctd-wrapper ctd-error-screen">
        <div className="ctd-error-inner">
          <div className="ctd-error-icon">⚠️</div>
          <h2 className="ctd-error-title">Unable to Load</h2>
          <p className="ctd-error-msg">{fetchError}</p>
          <button className="ctd-error-retry" onClick={loadAll}>
            🔄 Try Again
          </button>
          <button className="ctd-error-back" onClick={() => navigate('/member-dashboard')}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ctd-wrapper">
      {/* Header */}
      <header className="ctd-header">
        <button className="ctd-back-btn" onClick={() => navigate('/member-dashboard')}>
          ← Back
        </button>
        <h1 className="ctd-header-title">Calorie Tracker</h1>
        <div className="ctd-header-date">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </header>

      {/* Quick actions bar */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <button className="ctd-progress-btn" style={{ marginBottom: 0 }} onClick={() => setShowProgress(true)}>
          📷 Progress
        </button>
        <button className="ctd-saved-btn" style={{ marginBottom: 0 }} onClick={() => setShowSavedMeals(true)}>
          ⚡ Templates
        </button>
        <button className="ctd-settings-btn" style={{ marginBottom: 0 }} onClick={() => setShowCheatDay(true)}>
          🍕 Cheat Day
        </button>
        <button className="ctd-lb-btn" style={{ marginBottom: 0 }} onClick={() => setShowLeaderboard(true)}>
          🏆 Ranks
        </button>
      </div>

      {/* Cheat day banner */}
      {isCheatDay && (
        <div className="ctd-cheat-banner">
          🍕 Cheat Day! Enjoy — this day won't count toward your weekly averages.
        </div>
      )}

      <main className="ctd-body">

        {/* ── Summary Card ─────────────────────────────────────────────── */}
        <section className="ctd-summary-card ctd-animate-in" aria-labelledby="ctd-summary-heading">
          <h2 id="ctd-summary-heading" className="ctd-weekly-title">Today's Summary</h2>

          {/* Calorie ring + breakdown */}
          <div className="ctd-calorie-row">
            <Ring
              consumed={summary.total_calories}
              goal={goals.calorie_goal}
              isCheatDay={isCheatDay}
            />
            <div className="ctd-calorie-details">
              <div className="ctd-cal-detail-row">
                <span className="ctd-cal-label">Goal</span>
                <span className="ctd-cal-val">{goals.calorie_goal} kcal</span>
              </div>
              <div className="ctd-cal-detail-row">
                <span className="ctd-cal-label">Consumed</span>
                <span className="ctd-cal-val">{summary.total_calories} kcal</span>
              </div>
              <div className="ctd-cal-detail-row">
                <span className="ctd-cal-label">{remaining >= 0 ? 'Remaining' : 'Over by'}</span>
                <span className={`ctd-cal-val${remaining < 0 ? ' over' : ''}`}>
                  {Math.abs(remaining)} kcal
                </span>
              </div>
              <div className="ctd-cal-detail-row">
                <span className="ctd-cal-label">Meals</span>
                <span className="ctd-cal-val">{summary.meal_count} / 7</span>
              </div>
            </div>
          </div>

          {/* Macro pie chart */}
          <MacroPieChart summary={summary} goals={goals} />
        </section>

        {/* ── Water Widget ──────────────────────────────────────────────── */}
        <section className="ctd-water-card ctd-animate-in" style={{ animationDelay: '0.08s' }} aria-labelledby="ctd-water-heading">
          <div className="ctd-water-header">
            <h2 id="ctd-water-heading" className="ctd-water-title">💧 Water</h2>
            <span className="ctd-water-ml">{waterData?.total_ml || 0} / {waterData?.goal_ml || 2000} ml</span>
          </div>

          <div className="ctd-water-glasses" role="list" aria-label="Water glasses">
            {Array.from({ length: goalGlasses }, (_, i) => (
              <span
                key={i}
                className={[
                  'ctd-glass',
                  i < glassCount   ? 'filled'   : '',
                  i === newGlassIdx ? 'new-fill' : '',
                ].filter(Boolean).join(' ')}
                role="listitem"
                aria-label={i < glassCount ? 'Glass drunk' : 'Glass remaining'}
              >
                🥤
              </span>
            ))}
          </div>

          {waterError && <div className="ctd-inline-error">⚠️ {waterError}</div>}
          {waterData?.achieved ? (
            <div className="ctd-water-achieved">🎉 Daily water goal achieved!</div>
          ) : (
            <button
              className="ctd-water-add-btn"
              onClick={handleLogWater}
              disabled={waterLoading}
            >
              {waterLoading ? 'Logging…' : '+ Add Glass (250ml)'}
            </button>
          )}
        </section>

        {/* ── Meals List ────────────────────────────────────────────────── */}
        <section className="ctd-meals-card ctd-animate-in" style={{ animationDelay: '0.16s' }} aria-labelledby="ctd-meals-heading">
          <div className="ctd-meals-header">
            <h2 id="ctd-meals-heading" className="ctd-meals-title">Today's Meals</h2>
            <button
              className="ctd-add-meal-btn"
              onClick={() => setShowLogger(true)}
              disabled={meals.length >= 7}
            >
              + Log Meal
            </button>
          </div>

          {deleteError && <div className="ctd-inline-error">⚠️ {deleteError}</div>}

          {meals.length === 0 ? (
            <div className="ctd-no-meals">
              <div className="ctd-no-meals-icon">🍽️</div>
              <p>No meals logged yet today.</p>
              <button className="ctd-quick-add-btn" onClick={() => setShowLogger(true)}>
                + Log First Meal
              </button>
            </div>
          ) : (
            meals.map(meal => (
              <div key={meal._id} className="ctd-meal-item">
                <div className="ctd-meal-top">
                  <span className="ctd-meal-type">{meal.meal_type}</span>
                  <span className="ctd-meal-time">{meal.time}</span>
                  <span className="ctd-meal-calories">{meal.total_calories} kcal</span>
                  <button
                    className="ctd-meal-delete"
                    onClick={() => handleDeleteMeal(meal._id)}
                    disabled={deletingId === meal._id}
                    aria-label="Delete meal"
                  >
                    {deletingId === meal._id ? '…' : '🗑️'}
                  </button>
                </div>
                <div className="ctd-meal-macros">
                  <span>P: {meal.macros?.protein?.toFixed(1)}g</span>
                  <span>C: {meal.macros?.carbs?.toFixed(1)}g</span>
                  <span>F: {meal.macros?.fats?.toFixed(1)}g</span>
                </div>
                <div className="ctd-meal-foods">
                  {meal.items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="ctd-food-row">
                      <span>{item.food_name}</span>
                      <span>×{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                  {meal.items?.length > 3 && (
                    <div className="ctd-food-row" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      +{meal.items.length - 3} more items
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* ── Weekly Chart ──────────────────────────────────────────────── */}
        {weeklyData && (
          <section className="ctd-weekly-card ctd-animate-in" style={{ animationDelay: '0.24s' }} aria-labelledby="ctd-weekly-heading">
            <h2 id="ctd-weekly-heading" className="ctd-weekly-title">Weekly Overview</h2>
            <div className="ctd-weekly-bars" role="img" aria-label="Weekly calorie bar chart">
              {weeklyData.days.map((day, idx) => {
                const maxCal = Math.max(...weeklyData.days.map(d => d.total_calories), goals.calorie_goal, 1);
                const heightPct = (day.total_calories / maxCal) * 100;
                const dayDate  = new Date(day.date + 'T00:00:00');
                const dayLabel = DAYS_SHORT[dayDate.getDay()];
                const isToday  = idx === weeklyData.days.length - 1;
                return (
                  <div key={day.date} className="ctd-bar-col">
                    <div
                      className="ctd-bar-wrap"
                      title={`${day.total_calories} kcal`}
                    >
                      <div
                        className={`ctd-bar-fill${isToday ? ' today' : ''}${day.is_cheat_day ? ' cheat' : ''}${!day.logged ? ' empty' : ''}`}
                        style={{ height: day.logged ? `${heightPct}%` : '0%' }}
                      />
                    </div>
                    <span className={`ctd-bar-label${isToday ? ' today' : ''}`}>{dayLabel}</span>
                  </div>
                );
              })}
            </div>

            <div className="ctd-weekly-summary">
              <div className="ctd-ws-item">
                <div className="ctd-ws-val">{weeklyData.average?.calories || 0}</div>
                <div className="ctd-ws-lbl">Avg kcal/day</div>
              </div>
              <div className="ctd-ws-item">
                <div className="ctd-ws-val">{weeklyData.streak || 0}</div>
                <div className="ctd-ws-lbl">Day streak 🔥</div>
              </div>
              <div className="ctd-ws-item">
                <div className="ctd-ws-val">{weeklyData.average?.protein || 0}g</div>
                <div className="ctd-ws-lbl">Avg protein</div>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Meal Logger Modal */}
      {showLogger && (
        <MealLogger
          onClose={() => setShowLogger(false)}
          onLogged={loadAll}
        />
      )}

      {/* Saved Meals Modal */}
      {showSavedMeals && (
        <SavedMeals
          onClose={() => setShowSavedMeals(false)}
          onQuickAdded={loadAll}
          onCreateNew={() => { setShowSavedMeals(false); setShowLogger(true); }}
        />
      )}

      {/* Progress Photos Modal */}
      {showProgress && (
        <ProgressPhotos onClose={() => setShowProgress(false)} />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <Leaderboard onClose={() => setShowLeaderboard(false)} />
      )}

      {/* Cheat Day Settings Modal */}
      {showCheatDay && (
        <CheatDaySettings
          onClose={() => { setShowCheatDay(false); loadAll(); }}
        />
      )}

      {/* Water goal confetti */}
      {showConfetti && (
        <div className="ctd-confetti-overlay" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="ctd-confetti-piece" style={{ '--i': i }} />
          ))}
          <div className="ctd-confetti-msg">💧 Water goal hit! 🎉</div>
        </div>
      )}
    </div>
  );
}
