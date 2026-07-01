"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  Loader2,
  LogOut,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  Utensils,
  Weight,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { roundNutrition, sumNutrition, type NutritionTotals } from "@/lib/calculations";

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

type SummaryPoint = {
  day: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  weightKg?: number;
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

const today = new Date().toISOString().slice(0, 10);

export default function TrackerDashboard({ user, signOutHref }: Props) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [caloriePoints, setCaloriePoints] = useState<SummaryPoint[]>([]);
  const [weightPoints, setWeightPoints] = useState<SummaryPoint[]>([]);
  const [mealText, setMealText] = useState("");
  const [estimate, setEstimate] = useState<EstimatedMeal | null>(null);
  const [weightInput, setWeightInput] = useState({
    entryDate: today,
    weightKg: defaultProfile.weightKg,
  });
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

  const todayMeals = useMemo(
    () => meals.filter((meal) => meal.eatenAt.slice(0, 10) === today),
    [meals],
  );

  const todayTotals = useMemo(
    () => roundNutrition(sumNutrition(todayMeals.map((meal) => meal.totals))),
    [todayMeals],
  );

  const caloriesRemaining = targets
    ? Math.round(targets.targetCalories - todayTotals.calories)
    : 0;
  const calorieProgress = targets
    ? Math.min(100, Math.round((todayTotals.calories / targets.targetCalories) * 100))
    : 0;

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [profileResponse, mealsResponse, weightsResponse, summaryResponse] =
        await Promise.all([
          apiGet<{ profile: Profile | null; targets: Targets | null }>("/api/profile"),
          apiGet<{ meals: SavedMeal[] }>("/api/meals?days=30"),
          apiGet<{ weights: WeightEntry[] }>("/api/weights?days=120"),
          apiGet<{ calories: SummaryPoint[]; weights: SummaryPoint[] }>(
            "/api/summary?days=45",
          ),
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
      setCaloriePoints(summaryResponse.calories);
      setWeightPoints(summaryResponse.weights);
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
      setMessage("Profile saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function estimateMeal() {
    setEstimating(true);
    setError(null);
    setMessage(null);
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
      const totals = roundNutrition(sumNutrition(estimate.items));
      await apiSend("/api/meals", "POST", {
        ...estimate,
        totals,
        eatenAt: new Date().toISOString(),
      });
      setEstimate(null);
      setMealText("");
      setMessage("Meal saved.");
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
      setMessage("Weight saved.");
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingWeight(false);
    }
  }

  async function deleteMeal(id: number) {
    setError(null);
    setMessage(null);
    try {
      await apiSend(`/api/meals/${id}`, "DELETE");
      setMeals((current) => current.filter((meal) => meal.id !== id));
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function updateEstimateItem(index: number, patch: Partial<MealItem>) {
    if (!estimate) return;
    const items = estimate.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    setEstimate({
      ...estimate,
      items,
      totals: roundNutrition(sumNutrition(items)),
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#1d2528]">
      <header className="border-b border-[#d9d5c8] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#1f7a5a] text-white">
              <Utensils size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">Macro</h1>
              <p className="text-sm text-[#68716d]">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 rounded-md border border-[#d9d5c8] bg-[#fbfaf7] px-3 py-2 sm:flex">
              <User size={16} aria-hidden />
              {user.displayName}
            </span>
            <a
              className="inline-flex size-10 items-center justify-center rounded-md border border-[#d9d5c8] bg-white text-[#46504b] transition hover:bg-[#f0eee7]"
              href={signOutHref}
              title="Sign out"
            >
              <LogOut size={17} aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricPanel
              icon={<Activity size={18} />}
              label="Calories today"
              value={formatKcal(todayTotals.calories)}
              detail={
                targets
                  ? `${caloriesRemaining >= 0 ? caloriesRemaining : Math.abs(caloriesRemaining)} kcal ${caloriesRemaining >= 0 ? "left" : "over"}`
                  : "Set profile"
              }
            />
            <MetricPanel
              icon={<BarChart3 size={18} />}
              label="Target"
              value={targets ? formatKcal(targets.targetCalories) : "--"}
              detail={targets ? `${targets.maintenanceCalories} kcal maintenance` : "No target"}
            />
            <MetricPanel
              icon={<Weight size={18} />}
              label="Latest weight"
              value={
                weights.at(-1) ? `${formatNumber(weights.at(-1)?.weightKg ?? 0)} kg` : "--"
              }
              detail={weights.at(-1)?.entryDate ?? "No entries"}
            />
          </div>

          <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Today</h2>
                <p className="text-sm text-[#68716d]">
                  Protein {formatNumber(todayTotals.proteinG)}g · Carbs{" "}
                  {formatNumber(todayTotals.carbsG)}g · Fat{" "}
                  {formatNumber(todayTotals.fatG)}g
                </p>
              </div>
              <span className="rounded-md bg-[#eaf3ee] px-3 py-1 text-sm font-semibold text-[#1f7a5a]">
                {calorieProgress}%
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#ebe7dd]">
              <div
                className="h-full rounded-full bg-[#1f7a5a]"
                style={{ width: `${calorieProgress}%` }}
              />
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Log a meal</h2>
              <Sparkles className="text-[#d45b3f]" size={20} aria-hidden />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <textarea
                className="min-h-24 resize-y rounded-md border border-[#cfcabd] bg-[#fbfaf7] px-3 py-3 text-sm outline-none transition focus:border-[#1f7a5a] focus:ring-2 focus:ring-[#1f7a5a]/20"
                value={mealText}
                onChange={(event) => setMealText(event.target.value)}
                placeholder="2 eggs on toast, bowl of muesli, chicken wrap..."
              />
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1f7a5a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#196549] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={estimating || mealText.trim().length < 2}
                onClick={estimateMeal}
                title="Estimate meal"
              >
                {estimating ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
                Estimate
              </button>
            </div>

            {estimate ? (
              <div className="mt-5 border-t border-[#e2ded1] pt-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    className="rounded-md border border-[#cfcabd] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7a5a]"
                    value={estimate.mealName}
                    onChange={(event) =>
                      setEstimate({ ...estimate, mealName: event.target.value })
                    }
                  />
                  <div className="rounded-md bg-[#f0eee7] px-3 py-2 text-sm font-semibold">
                    {formatKcal(estimate.totals.calories)}
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs uppercase text-[#68716d]">
                      <tr>
                        <th className="py-2 pr-2">Food</th>
                        <th className="py-2 pr-2">Qty</th>
                        <th className="py-2 pr-2">g</th>
                        <th className="py-2 pr-2">kcal</th>
                        <th className="py-2 pr-2">P</th>
                        <th className="py-2 pr-2">C</th>
                        <th className="py-2 pr-2">F</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.items.map((item, index) => (
                        <tr key={`${item.name}-${index}`} className="border-t border-[#ece8dd]">
                          <td className="py-2 pr-2">
                            <input
                              className="w-full rounded border border-[#d9d5c8] px-2 py-1"
                              value={item.name}
                              onChange={(event) =>
                                updateEstimateItem(index, { name: event.target.value })
                              }
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              className="w-full rounded border border-[#d9d5c8] px-2 py-1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateEstimateItem(index, { quantity: event.target.value })
                              }
                            />
                          </td>
                          <NumberCell
                            value={item.estimatedGrams}
                            onChange={(value) =>
                              updateEstimateItem(index, { estimatedGrams: value })
                            }
                          />
                          <NumberCell
                            value={item.calories}
                            onChange={(value) => updateEstimateItem(index, { calories: value })}
                          />
                          <NumberCell
                            value={item.proteinG}
                            onChange={(value) => updateEstimateItem(index, { proteinG: value })}
                          />
                          <NumberCell
                            value={item.carbsG}
                            onChange={(value) => updateEstimateItem(index, { carbsG: value })}
                          />
                          <NumberCell
                            value={item.fatG}
                            onChange={(value) => updateEstimateItem(index, { fatG: value })}
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-[#1f7a5a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#196549] disabled:opacity-60"
                    disabled={savingMeal}
                    onClick={saveMeal}
                    title="Save meal"
                  >
                    {savingMeal ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Save meal
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-[#d9d5c8] px-4 py-2 text-sm font-semibold text-[#46504b] transition hover:bg-[#f0eee7]"
                    onClick={() => setEstimate(null)}
                    title="Discard estimate"
                  >
                    <Trash2 size={16} />
                    Discard
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartPanel title="Calories" data={caloriePoints} dataKey="calories" stroke="#d45b3f" />
            <ChartPanel title="Weight" data={weightPoints} dataKey="weightKg" stroke="#2c6fbb" />
          </section>

          <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent meals</h2>
              <CalendarDays size={18} className="text-[#68716d]" aria-hidden />
            </div>
            <div className="mt-4 divide-y divide-[#ece8dd]">
              {loading ? (
                <div className="py-8 text-sm text-[#68716d]">Loading meals...</div>
              ) : meals.length === 0 ? (
                <div className="py-8 text-sm text-[#68716d]">No meals logged.</div>
              ) : (
                meals.slice(0, 10).map((meal) => (
                  <article key={meal.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <h3 className="font-semibold">{meal.mealName}</h3>
                      <p className="text-sm text-[#68716d]">
                        {new Date(meal.eatenAt).toLocaleString()} ·{" "}
                        {meal.items.map((item) => item.name).join(", ")}
                      </p>
                      <p className="mt-1 text-sm">
                        {formatKcal(meal.totals.calories)} · P{" "}
                        {formatNumber(meal.totals.proteinG)}g · C{" "}
                        {formatNumber(meal.totals.carbsG)}g · F{" "}
                        {formatNumber(meal.totals.fatG)}g
                      </p>
                    </div>
                    <button
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[#d9d5c8] text-[#8d3f33] transition hover:bg-[#fff1ed]"
                      onClick={() => deleteMeal(meal.id)}
                      title="Delete meal"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          {error ? (
            <div className="rounded-lg border border-[#d8998a] bg-[#fff5f2] px-4 py-3 text-sm text-[#8d3f33]">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-lg border border-[#a8cfbd] bg-[#f0faf5] px-4 py-3 text-sm text-[#1f7a5a]">
              {message}
            </div>
          ) : null}

          <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Profile</h2>
            <div className="mt-4 grid gap-3">
              <SelectField
                label="Sex"
                value={profile.sex}
                onChange={(value) => setProfile({ ...profile, sex: value as Profile["sex"] })}
                options={[
                  ["male", "Male"],
                  ["female", "Female"],
                ]}
              />
              <div className="grid grid-cols-3 gap-3">
                <InputField
                  label="Age"
                  value={profile.age}
                  onChange={(value) => setProfile({ ...profile, age: value })}
                />
                <InputField
                  label="cm"
                  value={profile.heightCm}
                  onChange={(value) => setProfile({ ...profile, heightCm: value })}
                />
                <InputField
                  label="kg"
                  value={profile.weightKg}
                  onChange={(value) => setProfile({ ...profile, weightKg: value })}
                />
              </div>
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
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <SelectField
                  label="Goal"
                  value={profile.goal}
                  onChange={(value) =>
                    setProfile({
                      ...profile,
                      goal: value as Profile["goal"],
                      weeklyChangeKg: value === "maintain" ? 0 : profile.weeklyChangeKg,
                    })
                  }
                  options={[
                    ["lose", "Lose"],
                    ["maintain", "Maintain"],
                    ["gain", "Gain"],
                  ]}
                />
                <InputField
                  label="kg/wk"
                  value={profile.weeklyChangeKg}
                  step={0.1}
                  disabled={profile.goal === "maintain"}
                  onChange={(value) => setProfile({ ...profile, weeklyChangeKg: value })}
                />
              </div>
              <button
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#1f7a5a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#196549] disabled:opacity-60"
                onClick={saveProfile}
                disabled={savingProfile}
                title="Save profile"
              >
                {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Save profile
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Targets</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <TargetRow label="BMR" value={targets ? formatKcal(targets.bmr) : "--"} />
              <TargetRow
                label="Maintenance"
                value={targets ? formatKcal(targets.maintenanceCalories) : "--"}
              />
              <TargetRow
                label="Target"
                value={targets ? formatKcal(targets.targetCalories) : "--"}
              />
              <TargetRow
                label="Macros"
                value={
                  targets
                    ? `P ${targets.macroTargets.proteinG}g · C ${targets.macroTargets.carbsG}g · F ${targets.macroTargets.fatG}g`
                    : "--"
                }
              />
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Weight</h2>
            <div className="mt-4 grid grid-cols-[1fr_110px_auto] gap-3">
              <input
                className="rounded-md border border-[#cfcabd] bg-[#fbfaf7] px-3 py-2 text-sm outline-none focus:border-[#1f7a5a]"
                type="date"
                value={weightInput.entryDate}
                onChange={(event) =>
                  setWeightInput({ ...weightInput, entryDate: event.target.value })
                }
              />
              <input
                className="rounded-md border border-[#cfcabd] bg-[#fbfaf7] px-3 py-2 text-sm outline-none focus:border-[#1f7a5a]"
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={weightInput.weightKg}
                onChange={(event) =>
                  setWeightInput({
                    ...weightInput,
                    weightKg: Number(event.target.value),
                  })
                }
              />
              <button
                className="inline-flex size-10 items-center justify-center rounded-md bg-[#2c6fbb] text-white transition hover:bg-[#235c9d] disabled:opacity-60"
                onClick={saveWeight}
                disabled={savingWeight}
                title="Add weight"
              >
                {savingWeight ? <Loader2 className="animate-spin" size={16} /> : <Plus size={18} />}
              </button>
            </div>
            <div className="mt-4 divide-y divide-[#ece8dd]">
              {weights.slice(-5).reverse().map((entry) => (
                <div key={`${entry.id ?? entry.entryDate}`} className="flex justify-between py-2 text-sm">
                  <span className="text-[#68716d]">{entry.entryDate}</span>
                  <span className="font-semibold">{formatNumber(entry.weightKg)} kg</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function MetricPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-lg border border-[#d9d5c8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[#68716d]">
        <span className="text-sm font-medium">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-[#68716d]">{detail}</div>
    </section>
  );
}

function ChartPanel({
  title,
  data,
  dataKey,
  stroke,
}: {
  title: string;
  data: SummaryPoint[];
  dataKey: "calories" | "weightKg";
  stroke: string;
}) {
  return (
    <section className="rounded-lg border border-[#d9d5c8] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#eee8dc" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickMargin={8} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function NumberCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <td className="py-2 pr-2">
      <input
        className="w-20 rounded border border-[#d9d5c8] px-2 py-1"
        type="number"
        min={0}
        step={0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </td>
  );
}

function InputField({
  label,
  value,
  onChange,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-[#68716d]">
      {label}
      <input
        className="rounded-md border border-[#cfcabd] bg-[#fbfaf7] px-3 py-2 text-sm font-normal text-[#1d2528] outline-none focus:border-[#1f7a5a] disabled:bg-[#ece8dd]"
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
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
    <label className="grid gap-1 text-xs font-semibold uppercase text-[#68716d]">
      {label}
      <select
        className="rounded-md border border-[#cfcabd] bg-[#fbfaf7] px-3 py-2 text-sm font-normal text-[#1d2528] outline-none focus:border-[#1f7a5a]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TargetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#ece8dd] pb-2 last:border-b-0">
      <span className="text-[#68716d]">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
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

function formatKcal(value: number) {
  return `${Math.round(value).toLocaleString()} kcal`;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "--";
}
