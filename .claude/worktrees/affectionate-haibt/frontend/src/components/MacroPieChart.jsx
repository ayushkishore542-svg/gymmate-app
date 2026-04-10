import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './CalorieTracker.css';

const MACROS = [
  { key: 'protein', label: 'Protein', color: '#7c3aed', kcalPer: 4 },
  { key: 'carbs',   label: 'Carbs',   color: '#f59e0b', kcalPer: 4 },
  { key: 'fats',    label: 'Fats',    color: '#10b981', kcalPer: 9 },
];

/**
 * Traffic-light for each macro:
 *   ✅  80–120 % of goal
 *   🟡  50–79 % or 121–150 %
 *   🔴  < 50 % or > 150 %
 */
function trafficLight(consumed, goal) {
  if (!goal) return '⚪';
  const pct = consumed / goal;
  if (pct >= 0.8 && pct <= 1.2) return '✅';
  if (pct >= 0.5 && pct <= 1.5) return '🟡';
  return '🔴';
}

/** Custom label rendered inside each slice */
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null;   // hide label on tiny slices
  const RAD = Math.PI / 180;
  const r   = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x   = cx + r * Math.cos(-midAngle * RAD);
  const y   = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700 }}>
      {Math.round(percent * 100)}%
    </text>
  );
}

/** Custom tooltip */
function MacroTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, color } = payload[0];
  return (
    <div className="mpc-tooltip">
      <span className="mpc-tooltip-dot" style={{ background: color }} />
      <span className="mpc-tooltip-name">{name}</span>
      <span className="mpc-tooltip-val">{value} kcal</span>
    </div>
  );
}

export default function MacroPieChart({ summary, goals }) {
  const protein = summary?.protein || 0;
  const carbs   = summary?.carbs   || 0;
  const fats    = summary?.fats    || 0;

  // Convert grams → kcal for the pie
  const proteinKcal = Math.round(protein * 4);
  const carbsKcal   = Math.round(carbs   * 4);
  const fatsKcal    = Math.round(fats    * 9);
  const totalKcal   = proteinKcal + carbsKcal + fatsKcal;

  const pieData = totalKcal > 0
    ? [
        { name: 'Protein', value: proteinKcal, color: '#7c3aed' },
        { name: 'Carbs',   value: carbsKcal,   color: '#f59e0b' },
        { name: 'Fats',    value: fatsKcal,    color: '#10b981' },
      ]
    : [{ name: 'No data', value: 1, color: 'var(--border-color)' }];

  const isEmpty = totalKcal === 0;

  return (
    <div className="mpc-wrap">
      {/* Pie */}
      <div className="mpc-chart">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={72}
              paddingAngle={isEmpty ? 0 : 2}
              dataKey="value"
              labelLine={false}
              label={isEmpty ? false : PieLabel}
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            {!isEmpty && <Tooltip content={<MacroTooltip />} />}
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div className="mpc-centre">
          {isEmpty
            ? <span className="mpc-centre-empty">Log a<br />meal</span>
            : <><span className="mpc-centre-num">{totalKcal}</span><span className="mpc-centre-lbl">kcal</span></>
          }
        </div>
      </div>

      {/* Legend + traffic lights */}
      <div className="mpc-legend">
        {MACROS.map(({ key, label, color, kcalPer }) => {
          const grams    = key === 'protein' ? protein : key === 'carbs' ? carbs : fats;
          const goalG    = key === 'protein' ? goals?.protein_goal : key === 'carbs' ? goals?.carbs_goal : goals?.fats_goal;
          const kcal     = Math.round(grams * kcalPer);
          const pct      = goalG ? Math.min(Math.round((grams / goalG) * 100), 999) : 0;
          const light    = trafficLight(grams, goalG);

          return (
            <div key={key} className="mpc-legend-row">
              <span className="mpc-legend-dot" style={{ background: color }} />
              <span className="mpc-legend-label">{label}</span>
              <div className="mpc-legend-right">
                <span className="mpc-legend-val">
                  <strong>{Math.round(grams)}g</strong>
                  {goalG ? <span className="mpc-legend-goal"> / {goalG}g</span> : null}
                </span>
                <span className="mpc-legend-kcal">{kcal} kcal</span>
                <span className="mpc-legend-pct">{pct}%</span>
                <span className="mpc-traffic" title={`${pct}% of goal`}>{light}</span>
              </div>
            </div>
          );
        })}

        {/* Calorie breakdown from macros */}
        {!isEmpty && (
          <div className="mpc-footer">
            {Math.round(totalKcal)} kcal tracked from macros
            {goals?.calorie_goal
              ? ` · ${Math.round((totalKcal / goals.calorie_goal) * 100)}% of goal`
              : ''}
          </div>
        )}
      </div>
    </div>
  );
}
