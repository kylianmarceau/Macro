export type Sex = "female" | "male";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export type NutritionTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type ProfileInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  weeklyChangeKg: number;
};

export const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const emptyNutritionTotals: NutritionTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
};

export function calculateTargets(profile: ProfileInput) {
  const sexOffset = profile.sex === "male" ? 5 : -161;
  const bmr =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset;
  const maintenanceCalories = bmr * activityMultipliers[profile.activityLevel];
  const weeklyChangeCalories = (Math.abs(profile.weeklyChangeKg) * 7700) / 7;
  const direction =
    profile.goal === "gain" ? 1 : profile.goal === "lose" ? -1 : 0;
  const targetCalories = Math.max(
    1200,
    maintenanceCalories + direction * weeklyChangeCalories,
  );
  const proteinG = profile.weightKg * 1.8;
  const fatG = (targetCalories * 0.25) / 9;
  const carbsG = Math.max(0, (targetCalories - proteinG * 4 - fatG * 9) / 4);

  return {
    bmr: round(bmr, 0),
    maintenanceCalories: round(maintenanceCalories, 0),
    targetCalories: round(targetCalories, 0),
    macroTargets: {
      proteinG: round(proteinG, 0),
      carbsG: round(carbsG, 0),
      fatG: round(fatG, 0),
    },
  };
}

export function sumNutrition(items: NutritionTotals[]): NutritionTotals {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      proteinG: totals.proteinG + item.proteinG,
      carbsG: totals.carbsG + item.carbsG,
      fatG: totals.fatG + item.fatG,
      fiberG: totals.fiberG + item.fiberG,
      sugarG: totals.sugarG + item.sugarG,
      sodiumMg: totals.sodiumMg + item.sodiumMg,
    }),
    { ...emptyNutritionTotals },
  );
}

export function roundNutrition(totals: NutritionTotals): NutritionTotals {
  return {
    calories: round(totals.calories, 0),
    proteinG: round(totals.proteinG, 1),
    carbsG: round(totals.carbsG, 1),
    fatG: round(totals.fatG, 1),
    fiberG: round(totals.fiberG, 1),
    sugarG: round(totals.sugarG, 1),
    sodiumMg: round(totals.sodiumMg, 0),
  };
}

export function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}
