import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  round,
  roundNutrition,
  sumNutrition,
  type NutritionTotals,
} from "./calculations";
import { getRuntimeString } from "./runtime-env";

const parsedMealSchema = z.object({
  mealName: z.string().min(1).max(120),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        quantity: z.string().min(1).max(80),
        estimatedGrams: z.number().min(1).max(5000),
        searchQuery: z.string().min(1).max(120),
        confidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(30),
});

const parsedMealJsonSchema = {
  type: "object",
  properties: {
    mealName: {
      type: "string",
      description: "Short meal name inferred from the user's text.",
    },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: {
            type: "string",
            description: "Quantity exactly as a human would understand it.",
          },
          estimatedGrams: {
            type: "number",
            minimum: 1,
            maximum: 5000,
            description: "Best estimate of edible portion mass in grams.",
          },
          searchQuery: {
            type: "string",
            description: "Plain USDA search term, without quantity words.",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence in the quantity estimate.",
          },
        },
        required: ["name", "quantity", "estimatedGrams", "searchQuery", "confidence"],
      },
    },
  },
  required: ["mealName", "items"],
};

type ParsedMeal = z.infer<typeof parsedMealSchema>;

type UsdaNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type UsdaFood = {
  fdcId: number;
  description: string;
  foodNutrients?: UsdaNutrient[];
};

type UsdaSearchResponse = {
  foods?: UsdaFood[];
};

export type EstimatedMealItem = NutritionTotals & {
  name: string;
  quantity: string;
  estimatedGrams: number;
  fdcId: number | null;
  sourceDescription: string | null;
  confidence: number;
  note: string | null;
};

export type EstimatedMeal = {
  rawText: string;
  mealName: string;
  totals: NutritionTotals;
  items: EstimatedMealItem[];
};

export async function estimateMeal(description: string): Promise<EstimatedMeal> {
  const parsed = await parseMealWithGemini(description);
  const items = await Promise.all(parsed.items.map((item) => enrichItem(item)));
  return {
    rawText: description,
    mealName: parsed.mealName,
    totals: roundNutrition(sumNutrition(items)),
    items,
  };
}

async function parseMealWithGemini(description: string): Promise<ParsedMeal> {
  const apiKey = getRuntimeString("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add a Gemini API key locally and in Sites runtime variables before estimating meals.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Parse this meal into foods and realistic gram estimates: "${description}"`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: parsedMealJsonSchema,
      systemInstruction:
        "You parse short food log text. Return JSON only. Estimate edible grams for common portions when the user is vague. Do not include body data or advice.",
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty meal estimate.");
  return parsedMealSchema.parse(JSON.parse(text));
}

async function enrichItem(item: ParsedMeal["items"][number]): Promise<EstimatedMealItem> {
  const food = await searchUsdaFood(item.searchQuery);
  if (!food) {
    return {
      name: item.name,
      quantity: item.quantity,
      estimatedGrams: round(item.estimatedGrams, 0),
      fdcId: null,
      sourceDescription: null,
      confidence: Math.min(item.confidence, 0.2),
      note: "No USDA match found; nutrients set to zero.",
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
    };
  }

  const per100g = nutrientsPer100g(food);
  const scale = item.estimatedGrams / 100;
  const totals = roundNutrition({
    calories: per100g.calories * scale,
    proteinG: per100g.proteinG * scale,
    carbsG: per100g.carbsG * scale,
    fatG: per100g.fatG * scale,
    fiberG: per100g.fiberG * scale,
    sugarG: per100g.sugarG * scale,
    sodiumMg: per100g.sodiumMg * scale,
  });

  return {
    name: item.name,
    quantity: item.quantity,
    estimatedGrams: round(item.estimatedGrams, 0),
    fdcId: food.fdcId,
    sourceDescription: food.description,
    confidence: item.confidence,
    note: null,
    ...totals,
  };
}

async function searchUsdaFood(query: string) {
  const apiKey = getRuntimeString("USDA_API_KEY");
  if (!apiKey) {
    throw new Error(
      "Missing USDA_API_KEY. Add a FoodData Central API key locally and in Sites runtime variables before estimating meals.",
    );
  }

  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        pageSize: 5,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"],
        sortBy: "score",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`USDA lookup failed with status ${response.status}.`);
  }

  const data = (await response.json()) as UsdaSearchResponse;
  return data.foods?.[0] ?? null;
}

function nutrientsPer100g(food: UsdaFood): NutritionTotals {
  return {
    calories: nutrientValue(food, [1008], ["energy"], "KCAL"),
    proteinG: nutrientValue(food, [1003], ["protein"]),
    carbsG: nutrientValue(food, [1005], ["carbohydrate"]),
    fatG: nutrientValue(food, [1004], ["total lipid", "fat"]),
    fiberG: nutrientValue(food, [1079], ["fiber"]),
    sugarG: nutrientValue(food, [2000], ["sugars", "sugar"]),
    sodiumMg: nutrientValue(food, [1093], ["sodium"]),
  };
}

function nutrientValue(
  food: UsdaFood,
  ids: number[],
  names: string[],
  requiredUnit?: string,
) {
  const nutrient = food.foodNutrients?.find((entry) => {
    const name = entry.nutrientName?.toLowerCase() ?? "";
    const unit = entry.unitName?.toUpperCase();
    const idMatches = entry.nutrientId ? ids.includes(entry.nutrientId) : false;
    const nameMatches = names.some((candidate) => name.includes(candidate));
    const unitMatches = requiredUnit ? unit === requiredUnit : true;
    return unitMatches && (idMatches || nameMatches);
  });

  return Number(nutrient?.value ?? 0);
}
