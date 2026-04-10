import React, { useState, useEffect, useRef, useCallback } from 'react';
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

export default function MealLogger({ onClose, onLogged }) {
  const [mealType,   setMealType]   = useState('breakfast');
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [selected,   setSelected]   = useState([]);   // { food, quantity }
  const [logging,       setLogging]       = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showNameInput,  setShowNameInput]  = useState(false);
  const [templateName,   setTemplateName]   = useState('');
  const searchTimer = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await calorieAPI.searchFoods(q, 20);
      setResults(data.foods || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(searchTimer.current);
  }, [query, search]);

  const addFood = (food) => {
    setSelected(prev => {
      const exists = prev.find(s => s.food._id === food._id);
      if (exists) return prev;
      return [...prev, { food, quantity: 1 }];
    });
    setQuery('');
    setResults([]);
  };

  const changeQty = (foodId, delta) => {
    setSelected(prev => prev
      .map(s => s.food._id === foodId
        ? { ...s, quantity: Math.max(0.5, parseFloat((s.quantity + delta).toFixed(1))) }
        : s)
      .filter(s => s.quantity > 0)
    );
  };

  const removeFood = (foodId) => {
    setSelected(prev => prev.filter(s => s.food._id !== foodId));
  };

  const totalCal = selected.reduce(
    (sum, s) => sum + Math.round(s.food.calories * s.quantity), 0
  );

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const items = selected.map(s => ({
        food_id:  s.food._id,
        quantity: s.quantity,
      }));
      await calorieAPI.createSavedMeal({ name, items });
      setShowNameInput(false);
      setTemplateName('');
      alert(`"${name}" saved as a template!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLog = async () => {
    if (!selected.length) return;
    setLogging(true);
    try {
      const items = selected.map(s => ({
        food_id:  s.food._id,
        quantity: s.quantity,
        unit:     s.food.unit,
      }));
      await calorieAPI.logMeal({ meal_type: mealType, items });
      onLogged?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to log meal');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="ml-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ml-sheet" role="dialog" aria-modal="true" aria-labelledby="ml-title">

        {/* Header */}
        <div className="ml-header">
          <h2 className="ml-title" id="ml-title">Log a Meal</h2>
          <button className="ml-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ml-body">
          {/* Meal type */}
          <p className="ml-step-title">Meal Type</p>
          <div className="ml-meal-type-grid">
            {MEAL_TYPES.map(t => (
              <button
                key={t.id}
                className={`ml-type-btn${mealType === t.id ? ' selected' : ''}`}
                onClick={() => setMealType(t.id)}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Food search */}
          <p className="ml-step-title">Search Foods</p>
          <div className="ml-search-wrap">
            <span className="ml-search-icon">🔍</span>
            <input
              ref={inputRef}
              className="ml-search-input"
              type="search"
              placeholder="e.g. roti, chicken breast, banana…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {/* Results */}
          {(results.length > 0 || searching) && (
            <div className="ml-search-results">
              {searching && <div className="ml-empty">Searching…</div>}
              {!searching && results.map(food => (
                <button
                  key={food._id}
                  className="ml-food-result"
                  onClick={() => addFood(food)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  <div>
                    <div className="ml-food-name">{food.name}</div>
                    <div className="ml-food-meta">
                      {food.serving_size} {food.unit} · P {food.protein}g · C {food.carbs}g · F {food.fats}g
                    </div>
                  </div>
                  <div className="ml-food-cal">{food.calories} kcal</div>
                </button>
              ))}
              {!searching && results.length === 0 && query.trim() && (
                <div className="ml-empty">No foods found for "{query}"</div>
              )}
            </div>
          )}

          {/* Selected items */}
          {selected.length > 0 && (
            <div className="ml-selected-items">
              <div className="ml-selected-title">Added ({selected.length})</div>
              {selected.map(({ food, quantity }) => {
                const cal = Math.round(food.calories * quantity);
                return (
                  <div key={food._id} className="ml-selected-item">
                    <div className="ml-item-name">{food.name}</div>
                    <div className="ml-item-qty">
                      <button className="ml-qty-btn" onClick={() => changeQty(food._id, -0.5)}>−</button>
                      <span className="ml-qty-val">{quantity}</span>
                      <button className="ml-qty-btn" onClick={() => changeQty(food._id, +0.5)}>+</button>
                    </div>
                    <div className="ml-item-cal">{cal} kcal</div>
                    <button className="ml-item-remove" onClick={() => removeFood(food._id)} aria-label="Remove">✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total + Log */}
          {selected.length > 0 && (
            <>
              <div className="ml-total-row">
                <span className="ml-total-label">Total Calories</span>
                <span className="ml-total-val">{totalCal} kcal</span>
              </div>
              <button
                className="ml-log-btn"
                onClick={handleLog}
                disabled={logging}
              >
                {logging ? 'Logging…' : `✅ Log ${MEAL_TYPES.find(t => t.id === mealType)?.label}`}
              </button>

              {/* Save as template */}
              {!showNameInput ? (
                <button
                  className="ml-save-template-btn"
                  onClick={() => setShowNameInput(true)}
                  disabled={logging}
                >
                  💾 Save as Template
                </button>
              ) : (
                <div className="ml-template-name-wrap">
                  <input
                    className="ml-template-name-input"
                    type="text"
                    placeholder="Template name (e.g. Bulking Lunch)"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                    autoFocus
                    maxLength={40}
                  />
                  <button
                    className="ml-template-save-btn"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || !templateName.trim()}
                  >
                    {savingTemplate ? '…' : 'Save'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
