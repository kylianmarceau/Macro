import { z } from "zod";

export const profileSchema = z.object({
  sex: z.enum(["female", "male"]),
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(100).max(240),
  weightKg: z.number().min(30).max(300),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  weeklyChangeKg: z.number().min(0).max(1.5),
});

export const weightEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().min(30).max(300),
});

export const estimateMealSchema = z.object({
  description: z.string().trim().min(2).max(600),
});

export const nutritionTotalsSchema = z.object({
  calories: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(500),
  sugarG: z.number().min(0).max(1000),
  sodiumMg: z.number().min(0).max(50000),
});

export const mealItemSchema = nutritionTotalsSchema.extend({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().min(1).max(80),
  estimatedGrams: z.number().min(1).max(5000),
  fdcId: z.number().int().positive().nullable().optional(),
  sourceDescription: z.string().trim().max(240).nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.55),
  note: z.string().trim().max(240).nullable().optional(),
});

export const saveMealSchema = z.object({
  eatenAt: z.string().datetime().optional(),
  rawText: z.string().trim().min(1).max(600),
  mealName: z.string().trim().min(1).max(120),
  totals: nutritionTotalsSchema,
  items: z.array(mealItemSchema).min(1).max(30),
});
