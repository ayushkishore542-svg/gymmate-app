import React, { useState, useEffect, useCallback } from 'react';
import { calorieAPI } from '../utils/api';
import './CalorieTracker.css';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch',     label: 'Lunch',     icon: '🍱' },
  { id: 'dinner',    label: 'Dinner',    icon: '🌙' },
  { id: 'snack1',    label: 'Snack 1',   icon: '🥤' },
  { id: 'snack2',    label: 'Snack 2',   icon: '🍎' },
  { id: 'snack3',    label: 'Snack 3',   icon: '🥜' },
  { id: 'snack4',    label: 'Pre-WO',    icon: '💪' },
];

const MAX_SAVED = 3;

/** Inline meal-type picker shown inside each card when Quick Add is clicked */
function MealTypePicker({ onPick, onCancel, loading }) {
  return (
    <div className="sm-type-picker">
      <p className="sm-type-picker-label">Add to which meal?</p>
      <div className="sm-type-grid">
        {MEAL_TYPES.map(t => (
          <button
            key={t.id}
            className="sm-type-pill"
            onClick={() => onPick(t.id)}
            disabled={loading}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <button className="sm-type-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/** One saved-meal card */
function SavedMealCard({ meal, onQuickAdded, onDeleted }) {
  const [picking,  setPicking]  = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleQuickAdd = async (mealType) => {
    setAdding(true);
    try {
      await calorieAPI.quickAddMeal(meal._id, { meal_type: mealType });
      setPicking(false);
      onQuickAdded?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add meal');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${meal.name}"?`)) return;
    setDeleting(true);
    try {
      await calorieAPI.deleteSavedMeal(meal._id);
      onDeleted?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="sm-card">
      <div className="sm-card-top">
        <div className="sm-card-name">{meal.name}</div>
        <button
          className="sm-card-delete"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete ${meal.name}`}
        >
          {deleting ? '…' : '🗑️'}
        </button>
      </div>

      <div className="sm-card-cal">{meal.total_calories} kcal</div>

      <div className="sm-card-macros">
        <span>P {meal.macros?.protein?.toFixed(0)}g</span>
        <span>C {meal.macros?.carbs?.toFixed(0)}g</span>
        <span>F {meal.macros?.fats?.toFixed(0)}g</span>
      </div>

      <ul className="sm-card-items">
        {meal.items.slice(0, 3).map((item, i) => (
          <li key={i}>{item.food_name} ×{item.quantity}</li>
        ))}
        {meal.items.length > 3 && (
          <li className="sm-card-more">+{meal.items.length - 3} more</li>
        )}
      </ul>

      {picking ? (
        <MealTypePicker
          onPick={handleQuickAdd}
          onCancel={() => setPicking(false)}
          loading={adding}
        />
      ) : (
        <button
          className="sm-quick-btn"
          onClick={() => setPicking(true)}
          disabled={adding}
        >
          ⚡ Quick Add
        </button>
      )}
    </div>
  );
}

/** Empty slot — shows + Create button that opens MealLogger in save-mode */
function EmptySlot({ onCreate }) {
  return (
    <button className="sm-empty-slot" onClick={onCreate}>
      <span className="sm-empty-icon">+</span>
      <span className="sm-empty-label">Create Template</span>
    </button>
  );
}

/**
 * SavedMeals modal
 * Props:
 *   onClose       — close the modal
 *   onQuickAdded  — refresh today's meals after quick add
 *   onCreateNew   — open MealLogger in "save" mode
 */
export default function SavedMeals({ onClose, onQuickAdded, onCreateNew }) {
  const [meals,   setMeals]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMeals = useCallback(async () => {
    try {
      const { data } = await calorieAPI.getSavedMeals();
      setMeals(data.meals || []);
    } catch {
      setMeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeals(); }, [fetchMeals]);

  const emptySlots = MAX_SAVED - meals.length;

  return (
    <div className="ct-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-modal sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-title">
        <button className="ct-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="ct-modal-title" id="sm-title">⚡ Saved Meal Templates</h2>
        <p className="ct-modal-sub">
          Save up to 3 of your go-to meals for one-tap logging.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
            Loading…
          </div>
        ) : (
          <div className="sm-grid">
            {meals.map(meal => (
              <SavedMealCard
                key={meal._id}
                meal={meal}
                onQuickAdded={() => { onQuickAdded?.(); fetchMeals(); }}
                onDeleted={fetchMeals}
              />
            ))}
            {Array.from({ length: emptySlots }, (_, i) => (
              <EmptySlot key={`empty-${i}`} onCreate={onCreateNew} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
