"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  LogOut,
  Plus,
  Save,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Weight,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  calculateTargets,
  roundNutrition,
  sumNutrition,
  type NutritionTotals,
} from "@/lib/calculations";

type Profile = {
  sex: "female" | "male";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  weeklyChangeKg: number;
};

type Targets = {
  bmr: number;
  maintenanceCalories: number;
  targetCalories: number;
  macroTargets: {
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
};

type MealItem = NutritionTotals & {
  id?: number;
  name: string;
  quantity: string;
  estimatedGrams: number;
  fdcId?: number | null;
  sourceDescription?: string | null;
  confidence: number;
  note?: string | null;
};

type EstimatedMeal = {
  rawText: string;
  mealName: string;
  totals: NutritionTotals;
  items: MealItem[];
};

type SavedMeal = EstimatedMeal & {
  id: number;
  eatenAt: string;
};

type WeightEntry = {
  id?: number;
  entryDate: string;
  weightKg: number;
};

type DayRecord = {
  key: string;
  date: Date;
  dateLabel: string;
  fullLabel: string;
  consumed: number;
  protein: number;
  carbs: number;
  fat: number;
  weightKg: number | null;
  entries: Array<{
    id: number;
    time: string;
    name: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
};

type TooltipPayload = {
  value: number;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
};

type Props = {
  user: {
    email: string;
    displayName: string;
  };
  signOutHref: string;
};

const defaultProfile: Profile = {
  sex: "male",
  age: 25,
  heightCm: 178,
  weightKg: 78,
  activityLevel: "moderate",
  goal: "maintain",
  weeklyChangeKg: 0,
};

const today = dateKey(new Date());

export default function TrackerDashboard({ user, signOutHref }: Props) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [mealText, setMealText] = useState("");
  const [estimate, setEstimate] = useState<EstimatedMeal | null>(null);
  const [weightInput, setWeightInput] = useState({
    entryDate: today,
    weightKg: defaultProfile.weightKg,
  });
  const [dayOffset, setDayOffset] = useState(0);
  const [range, setRange] = useState(30);
  const [showEstimator, setShowEstimator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [savingWeight, setSavingWeight] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshAll();
  }, []);

  const targetSpec = useMemo(() => targets ?? calculateTargets(profile), [targets, profile]);

  const days = useMemo(
    () => buildDayRecords(meals, weights, profile.weightKg),
    [meals, weights, profile.weightKg],
  );

  const lastIndex = days.length - 1;
  const selectedIndex = Math.max(0, lastIndex - dayOffset);
  const selectedDay = days[selectedIndex] ?? days[lastIndex];
  const isToday = dayOffset === 0;
  const chartData = useMemo(() => days.slice(-range), [days, range]);
  const tickEvery = Math.max(1, Math.ceil(chartData.length / 6));
  const last7 = days.slice(-7);
  const avgConsumed = Math.round(
    last7.reduce((sum, day) => sum + day.consumed, 0) / Math.max(1, last7.length),
  );
  const avgDeviation = avgConsumed - targetSpec.targetCalories;
  const currentWeight = latestWeight(weights, profile.weightKg);
  const weightSevenDaysAgo = weightAtOffset(days, 7) ?? currentWeight;
  const weightChange7 = round(currentWeight - weightSevenDaysAgo, 1);
  const goalWeight = deriveGoalWeight(profile, currentWeight);
  const weeksToGoal = projectedWeeks(profile, currentWeight, goalWeight);
  const etaLabel = projectedDateLabel(weeksToGoal);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [profileResponse, mealsResponse, weightsResponse] = await Promise.all([
        apiGet<{ profile: Profile | null; targets: Targets | null }>("/api/profile"),
        apiGet<{ meals: SavedMeal[] }>("/api/meals?days=90"),
        apiGet<{ weights: WeightEntry[] }>("/api/weights?days=180"),
      ]);

      if (profileResponse.profile) {
        setProfile(profileResponse.profile);
        setWeightInput((current) => ({
          ...current,
          weightKg: profileResponse.profile?.weightKg ?? current.weightKg,
        }));
      }
      setTargets(profileResponse.targets);
      setMeals(mealsResponse.meals);
      setWeights(weightsResponse.weights);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiSend<{ profile: Profile; targets: Targets }>(
        "/api/profile",
        "PUT",
        profile,
      );
      setProfile(result.profile);
      setTargets(result.targets);
      setWeightInput((current) => ({ ...current, weightKg: result.profile.weightKg }));
      setMessage("Calibration saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function estimateMeal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setEstimating(true);
    setError(null);
    setMessage(null);
    setEstimate(null);
    try {
      const result = await apiSend<{ estimate: EstimatedMeal }>(
        "/api/meals/estimate",
        "POST",
        { description: mealText },
      );
      setEstimate(result.estimate);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEstimating(false);
    }
  }

  async function saveMeal() {
    if (!estimate) return;
    setSavingMeal(true);
    setError(null);
    setMessage(null);
    try {
      await apiSend("/api/meals", "POST", {
        ...estimate,
        totals: roundNutrition(sumNutrition(estimate.items)),
        eatenAt: new Date().toISOString(),
      });
      setEstimate(null);
      setMealText("");
      setShowEstimator(false);
      setDayOffset(0);
      setMessage("Meal logged.");
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingMeal(false);
    }
  }

  async function saveWeight() {
    setSavingWeight(true);
    setError(null);
    setMessage(null);
    try {
      await apiSend("/api/weights", "POST", weightInput);
      setMessage("Weight check-in saved.");
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingWeight(false);
    }
  }

  function openEstimator() {
    setDayOffset(0);
    setShowEstimator(true);
  }

  return (
    <div className="calibrate-app">
      <style>{calibrateStyles}</style>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>

      <div className="shell">
        <header className="cal-header">
          <div>
            <p className="wordmark">MACRO</p>
            <p className="tagline">AI intake calibration</p>
          </div>
          <div className="header-controls">
            <div className="day-nav">
              <button
                className="nav-btn"
                onClick={() => setDayOffset((offset) => Math.min(6, offset + 1))}
                disabled={dayOffset >= 6}
                title="Previous day"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="day-label">{dayOffsetLabel(dayOffset, selectedDay)}</span>
              <button
                className="nav-btn"
                onClick={() => setDayOffset((offset) => Math.max(0, offset - 1))}
                disabled={dayOffset === 0}
                title="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <button className="btn-primary" onClick={openEstimator}>
              <Sparkles size={15} /> Log with AI
            </button>
            <a
              className="nav-btn signout"
              href={signOutHref}
              title={`Sign out ${user.displayName}`}
            >
              <LogOut size={16} />
            </a>
          </div>
        </header>

        {error ? <div className="notice error">{error}</div> : null}
        {message ? <div className="notice success">{message}</div> : null}

        <div className="grid-top">
          <div className="card">
            <div className="eyebrow">
              <Flame size={12} /> Daily reading
            </div>
            <CalorieDial
              value={selectedDay.consumed}
              target={targetSpec.targetCalories}
              maintenance={targetSpec.maintenanceCalories}
              caption={readingCaption(selectedDay, isToday, targetSpec)}
            />
            <div className="dial-legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "var(--teal)" }} /> Target{" "}
                {targetSpec.targetCalories.toLocaleString()}
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "var(--rust)" }} /> Maint.{" "}
                {targetSpec.maintenanceCalories.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="eyebrow">Calibration spec</div>
            <div className="readout-row">
              <span className="readout-label">Maintenance</span>
              <span className="readout-value">
                {targetSpec.maintenanceCalories.toLocaleString()} kcal
              </span>
            </div>
            <div className="readout-row">
              <span className="readout-label">
                Daily target
                <span className="readout-sub">
                  &nbsp;· {signed(targetSpec.targetCalories - targetSpec.maintenanceCalories)} kcal/day
                </span>
              </span>
              <span className="readout-value">
                {targetSpec.targetCalories.toLocaleString()} kcal
              </span>
            </div>
            <div className="readout-row">
              <span className="readout-label">7-day avg intake</span>
              <span className="readout-value">
                {avgConsumed.toLocaleString()} kcal
                <span
                  style={{
                    color: avgDeviation <= 0 ? "var(--teal)" : "var(--rust)",
                    fontSize: 11,
                  }}
                >
                  ({signed(avgDeviation)})
                </span>
              </span>
            </div>

            <div className="readout-divider" />

            <div className="readout-row">
              <span className="readout-label">
                <Weight size={13} /> Current weight
              </span>
              <span className="readout-value">
                {currentWeight.toFixed(1)} kg
                <span
                  style={{
                    color: weightChange7 <= 0 ? "var(--teal)" : "var(--rust)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {weightChange7 <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                  {Math.abs(weightChange7).toFixed(1)}
                </span>
              </span>
            </div>
            <div className="readout-row">
              <span className="readout-label">Goal weight</span>
              <span className="readout-value">{goalWeight.toFixed(1)} kg</span>
            </div>
            <div className="readout-row">
              <span className="readout-label">Pace</span>
              <span className="readout-value">
                {profile.goal === "maintain" ? "maintain" : `${profile.weeklyChangeKg} kg / wk`}
              </span>
            </div>
            <div className="readout-row">
              <span className="readout-label">Projected</span>
              <span className="readout-value">
                {weeksToGoal < 0.1 ? "Goal reached" : `${etaLabel} · ~${weeksToGoal.toFixed(1)} wks`}
              </span>
            </div>

            <form className="profile-grid" onSubmit={(event) => void submitProfile(event, saveProfile)}>
              <SelectField
                label="Sex"
                value={profile.sex}
                onChange={(value) => setProfile({ ...profile, sex: value as Profile["sex"] })}
                options={[
                  ["male", "Male"],
                  ["female", "Female"],
                ]}
              />
              <NumberField
                label="Age"
                value={profile.age}
                min={13}
                max={100}
                onChange={(value) => setProfile({ ...profile, age: value })}
              />
              <NumberField
                label="Height cm"
                value={profile.heightCm}
                min={100}
                max={240}
                onChange={(value) => setProfile({ ...profile, heightCm: value })}
              />
              <NumberField
                label="Weight kg"
                value={profile.weightKg}
                min={30}
                max={300}
                step={0.1}
                onChange={(value) => setProfile({ ...profile, weightKg: value })}
              />
              <SelectField
                label="Activity"
                value={profile.activityLevel}
                onChange={(value) =>
                  setProfile({ ...profile, activityLevel: value as Profile["activityLevel"] })
                }
                options={[
                  ["sedentary", "Sedentary"],
                  ["light", "Light"],
                  ["moderate", "Moderate"],
                  ["active", "Active"],
                  ["very_active", "Very active"],
                ]}
              />
              <SelectField
                label="Goal"
                value={profile.goal}
                onChange={(value) =>
                  setProfile({
                    ...profile,
                    goal: value as Profile["goal"],
                    weeklyChangeKg: value === "maintain" ? 0 : Math.max(profile.weeklyChangeKg, 0.25),
                  })
                }
                options={[
                  ["lose", "Lose"],
                  ["maintain", "Maintain"],
                  ["gain", "Gain"],
                ]}
              />
              <NumberField
                label="kg / wk"
                value={profile.weeklyChangeKg}
                min={0}
                max={1.5}
                step={0.1}
                disabled={profile.goal === "maintain"}
                onChange={(value) => setProfile({ ...profile, weeklyChangeKg: value })}
              />
              <button className="btn-primary profile-save" disabled={savingProfile} type="submit">
                {savingProfile ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
                Save
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow">Macros - {dayOffsetLabel(dayOffset, selectedDay).toLowerCase()}</div>
          <div className="macro-grid">
            <MacroBar
              label="Protein"
              value={selectedDay.protein}
              target={targetSpec.macroTargets.proteinG}
              color="var(--brass)"
            />
            <MacroBar
              label="Carbs"
              value={selectedDay.carbs}
              target={targetSpec.macroTargets.carbsG}
              color="var(--teal)"
            />
            <MacroBar
              label="Fat"
              value={selectedDay.fat}
              target={targetSpec.macroTargets.fatG}
              color="var(--rust)"
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header-row">
            <div className="eyebrow" style={{ marginBottom: 0 }}>
              Calorie trend
            </div>
            <div className="range-toggle">
              {[7, 30, 90].map((daysRange) => (
                <button
                  key={daysRange}
                  className={`range-btn ${range === daysRange ? "active" : ""}`}
                  onClick={() => setRange(daysRange)}
                >
                  {daysRange}D
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="calFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brass)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--brass)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 6" />
              <XAxis
                dataKey="dateLabel"
                interval={tickEvery}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={{ stroke: "var(--line)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<CalorieTooltip />} />
              <ReferenceLine
                y={targetSpec.targetCalories}
                stroke="var(--teal)"
                strokeDasharray="4 4"
                label={{
                  value: "Target",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--teal)",
                }}
              />
              <ReferenceLine
                y={targetSpec.maintenanceCalories}
                stroke="var(--rust)"
                strokeDasharray="4 4"
                label={{
                  value: "Maintenance",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--rust)",
                }}
              />
              <Area
                type="monotone"
                dataKey="consumed"
                stroke="var(--brass)"
                strokeWidth={2}
                fill="url(#calFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header-row">
            <div className="eyebrow" style={{ marginBottom: 0 }}>
              Weight trend
            </div>
            <form className="weight-inline" onSubmit={(event) => void submitWeight(event, saveWeight)}>
              <input
                type="date"
                value={weightInput.entryDate}
                onChange={(event) =>
                  setWeightInput({ ...weightInput, entryDate: event.target.value })
                }
                aria-label="Weight date"
              />
              <input
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={weightInput.weightKg}
                onChange={(event) =>
                  setWeightInput({ ...weightInput, weightKg: Number(event.target.value) })
                }
                aria-label="Weight kg"
              />
              <button className="btn-ghost" type="submit" disabled={savingWeight}>
                {savingWeight ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
                Check-in
              </button>
            </form>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="wFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 6" />
              <XAxis
                dataKey="dateLabel"
                interval={tickEvery}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={{ stroke: "var(--line)" }}
                tickLine={false}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<WeightTooltip />} />
              <ReferenceLine
                y={goalWeight}
                stroke="var(--brass)"
                strokeDasharray="4 4"
                label={{
                  value: "Goal",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--brass)",
                }}
              />
              <Area
                type="monotone"
                dataKey="weightKg"
                stroke="var(--teal)"
                strokeWidth={2}
                fill="url(#wFill)"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header-row">
            <div className="eyebrow" style={{ marginBottom: 0 }}>
              Log - {dayOffsetLabel(dayOffset, selectedDay).toLowerCase()}
            </div>
            {!showEstimator && (
              <button className="btn-ghost" onClick={openEstimator}>
                <Sparkles size={14} /> Estimate meal
              </button>
            )}
          </div>

          {showEstimator && (
            <form className="ai-entry" onSubmit={estimateMeal}>
              <div className="field">
                <label>Meal description</label>
                <textarea
                  value={mealText}
                  onChange={(event) => setMealText(event.target.value)}
                  placeholder="e.g. eggs on 2 toast, bowl of muesli"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={estimating || mealText.trim().length < 2}
                >
                  {estimating ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                  Estimate
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setShowEstimator(false);
                    setEstimate(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {estimate ? (
            <div className="estimate-panel">
              <div className="readout-row">
                <span className="readout-label">{estimate.mealName}</span>
                <span className="readout-value">{estimate.totals.calories.toLocaleString()} kcal</span>
              </div>
              <div className="estimate-items">
                {estimate.items.map((item, index) => (
                  <span key={`${item.name}-${index}`} className="estimate-chip">
                    {item.name} · {Math.round(item.estimatedGrams)}g
                  </span>
                ))}
              </div>
              <div className="estimate-actions">
                <button className="btn-primary" onClick={saveMeal} disabled={savingMeal}>
                  {savingMeal ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
                  Save estimate
                </button>
                <button className="btn-ghost" onClick={() => setEstimate(null)}>
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="table-scroll">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Food</th>
                  <th>Macros</th>
                  <th style={{ textAlign: "right" }}>Kcal</th>
                </tr>
              </thead>
              <tbody>
                {selectedDay.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="log-time">{entry.time}</td>
                    <td>{entry.name}</td>
                    <td className="log-macros">
                      P{entry.protein} C{entry.carbs} F{entry.fat}
                    </td>
                    <td className="log-kcal">{entry.kcal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? <div className="empty-log">Loading calibrated data...</div> : null}
            {!loading && selectedDay.entries.length === 0 ? (
              <div className="empty-log">No AI-estimated meals logged for this day yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalorieDial({
  value,
  target,
  maintenance,
  caption,
}: {
  value: number;
  target: number;
  maintenance: number;
  caption: string;
}) {
  const cx = 120;
  const cy = 130;
  const r = 92;
  const max = Math.max(maintenance * 1.15, target * 1.15, 1);
  const frac = Math.max(0, Math.min(1, value / max));
  const valueAngle = START_ANGLE + frac * SWEEP;
  const targetAngle = START_ANGLE + Math.min(1, target / max) * SWEEP;
  const maintAngle = START_ANGLE + Math.min(1, maintenance / max) * SWEEP;
  const status = value <= target ? "var(--teal)" : value <= maintenance ? "var(--brass)" : "var(--rust)";
  const ticks = Array.from({ length: 21 }, (_, index) => index / 20);

  return (
    <svg viewBox="0 0 240 230" className="dial-svg">
      <path d={arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP)} className="dial-track" />
      <path
        d={arcPath(cx, cy, r, START_ANGLE, valueAngle)}
        stroke={status}
        className="dial-progress"
      />
      {ticks.map((tick, index) => {
        const angle = START_ANGLE + tick * SWEEP;
        const isMajor = index % 5 === 0;
        const [x1, y1] = polar(cx, cy, r + 7, angle);
        const [x2, y2] = polar(cx, cy, isMajor ? r + 17 : r + 12, angle);
        return (
          <line
            key={tick}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={isMajor ? "tick-major" : "tick-minor"}
          />
        );
      })}
      <circle cx={polar(cx, cy, r, targetAngle)[0]} cy={polar(cx, cy, r, targetAngle)[1]} r="3.5" className="tick-target" />
      <circle cx={polar(cx, cy, r, maintAngle)[0]} cy={polar(cx, cy, r, maintAngle)[1]} r="3.5" className="tick-maint" />
      <line
        x1={cx}
        y1={cy}
        x2={polar(cx, cy, r - 18, valueAngle)[0]}
        y2={polar(cx, cy, r - 18, valueAngle)[1]}
        className="dial-needle"
      />
      <circle cx={cx} cy={cy} r="6" className="dial-hub" />
      <text x={cx} y={cy + 44} textAnchor="middle" className="dial-value">
        {Math.round(value).toLocaleString()}
      </text>
      <text x={cx} y={cy + 62} textAnchor="middle" className="dial-caption">
        {caption}
      </text>
    </svg>
  );
}

function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = Math.min(100, (value / Math.max(target, 1)) * 100);
  return (
    <div className="macro-bar">
      <div className="macro-bar-head">
        <span className="macro-label">{label}</span>
        <span className="macro-value">
          {Math.round(value)}
          <span className="macro-sep"> / {Math.round(target)}g</span>
        </span>
      </div>
      <div className="macro-track">
        <div className="macro-fill" style={{ width: `${pct}%`, background: color }} />
        {[25, 50, 75].map((mark) => (
          <span key={mark} className="macro-tick" style={{ left: `${mark}%` }} />
        ))}
      </div>
    </div>
  );
}

function CalorieTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{label}</div>
      <div className="chart-tooltip-row">
        <span>Intake</span>
        <b>{Math.round(payload[0].value).toLocaleString()} kcal</b>
      </div>
    </div>
  );
}

function WeightTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{label}</div>
      <div className="chart-tooltip-row">
        <span>Weight</span>
        <b>{payload[0].value.toFixed(1)} kg</b>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function buildDayRecords(meals: SavedMeal[], weights: WeightEntry[], profileWeight: number) {
  const mealsByDate = new Map<string, SavedMeal[]>();
  for (const meal of meals) {
    const key = meal.eatenAt.slice(0, 10);
    mealsByDate.set(key, [...(mealsByDate.get(key) ?? []), meal]);
  }

  const weightsByDate = new Map(weights.map((entry) => [entry.entryDate, entry.weightKg]));
  let lastKnownWeight = weights
    .slice()
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate))[0]?.weightKg ?? profileWeight;

  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (89 - index));
    const key = dateKey(date);
    const dayMeals = (mealsByDate.get(key) ?? []).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));
    if (weightsByDate.has(key)) lastKnownWeight = weightsByDate.get(key) ?? lastKnownWeight;
    const totals = roundNutrition(sumNutrition(dayMeals.map((meal) => meal.totals)));

    return {
      key,
      date,
      dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullLabel: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      consumed: totals.calories,
      protein: totals.proteinG,
      carbs: totals.carbsG,
      fat: totals.fatG,
      weightKg: lastKnownWeight,
      entries: dayMeals.map((meal) => ({
        id: meal.id,
        time: new Date(meal.eatenAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        name: meal.mealName,
        kcal: Math.round(meal.totals.calories),
        protein: Math.round(meal.totals.proteinG),
        carbs: Math.round(meal.totals.carbsG),
        fat: Math.round(meal.totals.fatG),
      })),
    };
  });
}

function readingCaption(day: DayRecord, isToday: boolean, targets: Targets) {
  if (isToday) {
    const remaining = targets.targetCalories - day.consumed;
    if (remaining >= 0) return `${remaining.toLocaleString()} kcal remaining`;
    return `${Math.abs(remaining).toLocaleString()} kcal over target`;
  }
  const diff = day.consumed - targets.targetCalories;
  if (diff <= 0) return `${Math.abs(diff).toLocaleString()} kcal under target`;
  return `${diff.toLocaleString()} kcal over target`;
}

function dayOffsetLabel(offset: number, day: DayRecord) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Yesterday";
  return day.fullLabel;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 <= 180 ? 0 : 1;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function latestWeight(weights: WeightEntry[], fallback: number) {
  return weights.slice().sort((a, b) => a.entryDate.localeCompare(b.entryDate)).at(-1)?.weightKg ?? fallback;
}

function weightAtOffset(days: DayRecord[], offset: number) {
  const index = Math.max(0, days.length - 1 - offset);
  return days[index]?.weightKg ?? null;
}

function deriveGoalWeight(profile: Profile, currentWeight: number) {
  if (profile.goal === "lose") return Math.max(30, currentWeight - 5);
  if (profile.goal === "gain") return Math.min(300, currentWeight + 5);
  return currentWeight;
}

function projectedWeeks(profile: Profile, currentWeight: number, goalWeight: number) {
  if (profile.goal === "maintain" || profile.weeklyChangeKg <= 0) return 0;
  return Math.max(0, Math.abs(currentWeight - goalWeight) / profile.weeklyChangeKg);
}

function projectedDateLabel(weeksToGoal: number) {
  const etaDate = new Date();
  etaDate.setDate(etaDate.getDate() + Math.round(weeksToGoal * 7));
  return etaDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function submitProfile(event: FormEvent<HTMLFormElement>, saveProfile: () => Promise<void>) {
  event.preventDefault();
  await saveProfile();
}

async function submitWeight(event: FormEvent<HTMLFormElement>, saveWeight: () => Promise<void>) {
  event.preventDefault();
  await saveWeight();
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return parseApiResponse<T>(response);
}

async function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.status}`);
  return data;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const START_ANGLE = 135;
const SWEEP = 270;

const calibrateStyles = `
  .calibrate-app {
    --bg: #171310;
    --panel: #221D17;
    --panel-2: #2B241A;
    --line: rgba(241,233,219,0.09);
    --brass: #C99A55;
    --teal: #57A796;
    --rust: #BC5B3C;
    --ink: #F1E9DB;
    --muted: rgba(241,233,219,0.55);
    --muted-2: rgba(241,233,219,0.32);
    background: var(--bg);
    color: var(--ink);
    font-family: 'Inter', -apple-system, sans-serif;
    min-height: 100vh;
    padding: 28px 20px 60px;
  }
  .calibrate-app * { box-sizing: border-box; }
  .shell { max-width: 1040px; margin: 0 auto; }
  .cal-header {
    display: flex; justify-content: space-between; align-items: flex-end;
    flex-wrap: wrap; gap: 16px; margin-bottom: 24px;
  }
  .wordmark {
    font-family: 'Space Grotesk', sans-serif; font-weight: 700;
    font-size: 26px; letter-spacing: -0.01em; margin: 0;
  }
  .tagline {
    font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.12em; color: var(--muted); text-transform: uppercase;
    margin-top: 4px;
  }
  .header-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .day-nav {
    display: flex; align-items: center; gap: 2px;
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 6px; padding: 4px;
  }
  .nav-btn {
    display: flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 4px; border: none;
    background: transparent; color: var(--ink); cursor: pointer; text-decoration: none;
  }
  .nav-btn:hover:not(:disabled) { background: var(--panel-2); }
  .nav-btn:disabled { opacity: 0.3; cursor: default; }
  .signout { border: 1px solid var(--line); width: 38px; height: 38px; }
  .day-label {
    font-family: 'IBM Plex Mono', monospace; font-size: 12px;
    min-width: 96px; text-align: center; color: var(--ink);
  }
  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: var(--brass); color: #22190D; border: none;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px;
    padding: 9px 14px; border-radius: 6px; cursor: pointer; white-space: nowrap;
  }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-primary:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: default; }
  .btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent; border: 1px solid var(--line); color: var(--muted);
    font-family: 'Inter', sans-serif; font-size: 13px; padding: 9px 14px;
    border-radius: 6px; cursor: pointer; white-space: nowrap;
  }
  .btn-ghost:hover { color: var(--ink); border-color: var(--muted-2); }
  .grid-top {
    display: grid; grid-template-columns: 300px 1fr; gap: 16px; margin-bottom: 16px;
  }
  .card {
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 6px; padding: 20px 22px;
  }
  .eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
    display: flex; align-items: center; gap: 6px; margin-bottom: 14px;
  }
  .notice {
    border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px;
    margin-bottom: 16px; font-size: 13px;
  }
  .notice.error { border-color: rgba(188,91,60,0.45); color: #F2B39F; background: rgba(188,91,60,0.08); }
  .notice.success { border-color: rgba(87,167,150,0.45); color: #B8E6DC; background: rgba(87,167,150,0.08); }
  .dial-svg { width: 100%; height: auto; display: block; }
  .dial-track { fill: none; stroke: rgba(241,233,219,0.08); stroke-width: 13; stroke-linecap: round; }
  .dial-progress { fill: none; stroke-width: 13; stroke-linecap: round; }
  .tick-major { stroke: rgba(241,233,219,0.5); stroke-width: 2; }
  .tick-minor { stroke: rgba(241,233,219,0.2); stroke-width: 1; }
  .tick-target { fill: var(--teal); }
  .tick-maint { fill: var(--rust); }
  .dial-needle { stroke: var(--ink); stroke-width: 3; stroke-linecap: round; }
  .dial-hub { fill: var(--ink); }
  .dial-value { font-family: 'IBM Plex Mono', monospace; font-size: 32px; font-weight: 600; fill: var(--ink); }
  .dial-caption { font-family: 'Inter', sans-serif; font-size: 11.5px; fill: var(--muted); }
  .dial-legend { display: flex; justify-content: center; gap: 20px; margin-top: 6px; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); }
  .legend-dot { width: 7px; height: 7px; border-radius: 50%; }
  .readout-row {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px;
  }
  .readout-row:last-child { border-bottom: none; }
  .readout-label { color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .readout-sub { color: var(--muted-2); font-size: 11px; }
  .readout-value {
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13.5px;
    display: flex; align-items: center; gap: 5px; text-align: right;
  }
  .readout-divider { height: 1px; background: var(--line); margin: 6px 0 8px; }
  .macro-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .macro-bar-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .macro-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .macro-value { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; }
  .macro-sep { color: var(--muted); font-weight: 400; }
  .macro-track { position: relative; height: 8px; background: var(--panel-2); border-radius: 4px; overflow: visible; }
  .macro-fill { height: 100%; border-radius: 4px; }
  .macro-tick { position: absolute; top: -2px; width: 1px; height: 12px; background: rgba(241,233,219,0.15); }
  .card-header-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 4px; }
  .range-toggle { display: flex; gap: 2px; background: var(--panel-2); border-radius: 6px; padding: 3px; }
  .range-btn {
    border: none; background: transparent; color: var(--muted); font-size: 12px;
    font-family: 'IBM Plex Mono', monospace; padding: 5px 10px; border-radius: 4px; cursor: pointer;
  }
  .range-btn.active { background: var(--brass); color: #22190D; font-weight: 600; }
  .chart-tooltip {
    background: var(--panel-2); border: 1px solid var(--line); border-radius: 6px;
    padding: 8px 12px; font-family: 'Inter', sans-serif; color: var(--ink);
  }
  .chart-tooltip-date { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
  .chart-tooltip-row { display: flex; gap: 12px; justify-content: space-between; font-size: 12.5px; }
  .log-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .log-table th {
    text-align: left; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-2);
    padding: 6px 8px; border-bottom: 1px solid var(--line); font-weight: 500;
  }
  .log-table td { padding: 10px 8px; border-bottom: 1px solid var(--line); font-size: 13px; }
  .log-table tr:last-child td { border-bottom: none; }
  .log-time { font-family: 'IBM Plex Mono', monospace; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .log-kcal { font-family: 'IBM Plex Mono', monospace; text-align: right; white-space: nowrap; }
  .log-macros { color: var(--muted); font-size: 11.5px; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
  .empty-log { color: var(--muted); font-size: 13px; padding: 18px 4px; text-align: center; }
  .field label, .field span {
    display: block; font-size: 10px; color: var(--muted); margin-bottom: 4px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .field input, .field textarea, .field select, .weight-inline input {
    width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--ink);
    border-radius: 4px; padding: 7px 9px; font-family: 'Inter', sans-serif; font-size: 13px;
  }
  .field textarea { min-height: 78px; resize: vertical; }
  .field input:focus, .field textarea:focus, .field select:focus, .weight-inline input:focus {
    outline: none; border-color: var(--brass);
  }
  .field input:disabled { color: var(--muted-2); }
  .profile-grid {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;
    align-items: end; margin-top: 14px; padding: 14px; background: var(--panel-2);
    border-radius: 6px;
  }
  .profile-save { min-height: 34px; }
  .weight-inline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .weight-inline input { width: 130px; }
  .ai-entry {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px;
    align-items: end; margin: 14px 0 4px; padding: 14px; background: var(--panel-2);
    border-radius: 6px;
  }
  .form-actions { display: flex; gap: 8px; align-items: center; }
  .estimate-panel {
    margin: 14px 0; padding: 14px; background: rgba(201,154,85,0.08);
    border: 1px solid var(--line); border-radius: 6px;
  }
  .estimate-items { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .estimate-chip {
    border: 1px solid var(--line); border-radius: 999px; padding: 5px 8px;
    color: var(--muted); font-size: 12px;
  }
  .estimate-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .table-scroll { overflow-x: auto; }
  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 860px) {
    .grid-top { grid-template-columns: 1fr; }
    .macro-grid { grid-template-columns: 1fr; gap: 16px; }
    .profile-grid { grid-template-columns: 1fr 1fr; }
    .ai-entry { grid-template-columns: 1fr; }
    .cal-header { align-items: flex-start; }
  }
  @media (max-width: 560px) {
    .calibrate-app { padding: 20px 12px 42px; }
    .card { padding: 16px; }
    .profile-grid, .weight-inline { grid-template-columns: 1fr; }
    .weight-inline input { width: 100%; }
    .card-header-row { align-items: flex-start; flex-direction: column; }
  }
`;
