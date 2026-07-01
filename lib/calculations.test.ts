import { describe, expect, it } from "vitest";
import { calculateTargets, roundNutrition, sumNutrition } from "./calculations";

describe("calculateTargets", () => {
  it("calculates maintenance calories with Mifflin-St Jeor", () => {
    const targets = calculateTargets({
      sex: "male",
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: "moderate",
      goal: "maintain",
      weeklyChangeKg: 0,
    });

    expect(targets.bmr).toBe(1780);
    expect(targets.maintenanceCalories).toBe(2759);
    expect(targets.targetCalories).toBe(2759);
  });

  it("subtracts the chosen weekly loss from maintenance", () => {
    const targets = calculateTargets({
      sex: "female",
      age: 35,
      heightCm: 165,
      weightKg: 70,
      activityLevel: "light",
      goal: "lose",
      weeklyChangeKg: 0.5,
    });

    expect(targets.targetCalories).toBeLessThan(targets.maintenanceCalories);
    expect(targets.maintenanceCalories - targets.targetCalories).toBe(550);
  });
});

describe("nutrition totals", () => {
  it("sums and rounds macro totals", () => {
    const totals = roundNutrition(
      sumNutrition([
        {
          calories: 120.4,
          proteinG: 11.24,
          carbsG: 2.22,
          fatG: 8.81,
          fiberG: 0,
          sugarG: 0.4,
          sodiumMg: 72.3,
        },
        {
          calories: 91.2,
          proteinG: 3.72,
          carbsG: 16.18,
          fatG: 1.1,
          fiberG: 2.1,
          sugarG: 2.88,
          sodiumMg: 183.7,
        },
      ]),
    );

    expect(totals).toEqual({
      calories: 212,
      proteinG: 15,
      carbsG: 18.4,
      fatG: 9.9,
      fiberG: 2.1,
      sugarG: 3.3,
      sodiumMg: 256,
    });
  });
});
