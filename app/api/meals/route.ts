import { requireApiUser } from "@/lib/app-auth";
import { getD1 } from "@/lib/database";
import { jsonError, parsePositiveInt } from "@/lib/route-utils";
import { saveMealSchema } from "@/lib/schemas";

type MealRow = {
  id: number;
  eatenAt: string;
  rawText: string;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

type MealItemRow = MealRow & {
  mealId: number;
  itemId: number;
  name: string;
  quantity: string;
  estimatedGrams: number;
  fdcId: number | null;
  sourceDescription: string | null;
  itemCalories: number;
  itemProteinG: number;
  itemCarbsG: number;
  itemFatG: number;
  itemFiberG: number;
  itemSugarG: number;
  itemSodiumMg: number;
  confidence: number;
  note: string | null;
};

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const days = parsePositiveInt(new URL(request.url).searchParams.get("days"), 14, 365);
    const meals = await getD1()
      .prepare(
        `SELECT id, eaten_at as eatenAt, raw_text as rawText, meal_name as mealName,
          calories, protein_g as proteinG, carbs_g as carbsG, fat_g as fatG,
          fiber_g as fiberG, sugar_g as sugarG, sodium_mg as sodiumMg
         FROM meals
         WHERE user_id = ?
           AND date(eaten_at) >= date('now', ?)
         ORDER BY eaten_at DESC, id DESC`,
      )
      .bind(user.id, `-${days} days`)
      .all<MealRow>();

    const mealIds = (meals.results ?? []).map((meal) => meal.id);
    if (mealIds.length === 0) return Response.json({ meals: [] });

    const placeholders = mealIds.map(() => "?").join(",");
    const items = await getD1()
      .prepare(
        `SELECT meal_id as mealId, id as itemId, name, quantity,
          estimated_grams as estimatedGrams, fdc_id as fdcId,
          source_description as sourceDescription, calories as itemCalories,
          protein_g as itemProteinG, carbs_g as itemCarbsG, fat_g as itemFatG,
          fiber_g as itemFiberG, sugar_g as itemSugarG, sodium_mg as itemSodiumMg,
          confidence, note
         FROM meal_items
         WHERE meal_id IN (${placeholders})
         ORDER BY id ASC`,
      )
      .bind(...mealIds)
      .all<MealItemRow>();

    const itemsByMeal = new Map<number, MealItemRow[]>();
    for (const item of items.results ?? []) {
      itemsByMeal.set(item.mealId, [...(itemsByMeal.get(item.mealId) ?? []), item]);
    }

    return Response.json({
      meals: (meals.results ?? []).map((meal) => ({
        ...meal,
        items: (itemsByMeal.get(meal.id) ?? []).map((item) => ({
          id: item.itemId,
          name: item.name,
          quantity: item.quantity,
          estimatedGrams: item.estimatedGrams,
          fdcId: item.fdcId,
          sourceDescription: item.sourceDescription,
          calories: item.itemCalories,
          proteinG: item.itemProteinG,
          carbsG: item.itemCarbsG,
          fatG: item.itemFatG,
          fiberG: item.itemFiberG,
          sugarG: item.itemSugarG,
          sodiumMg: item.itemSodiumMg,
          confidence: item.confidence,
          note: item.note,
        })),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const payload = saveMealSchema.parse(await request.json());
    const eatenAt = payload.eatenAt ?? new Date().toISOString();
    const db = getD1();
    const result = await db
      .prepare(
        `INSERT INTO meals (
          user_id, eaten_at, raw_text, meal_name, calories, protein_g, carbs_g,
          fat_g, fiber_g, sugar_g, sodium_mg
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        user.id,
        eatenAt,
        payload.rawText,
        payload.mealName,
        payload.totals.calories,
        payload.totals.proteinG,
        payload.totals.carbsG,
        payload.totals.fatG,
        payload.totals.fiberG,
        payload.totals.sugarG,
        payload.totals.sodiumMg,
      )
      .run();
    const mealId = Number(result.meta.last_row_id);

    await db.batch(
      payload.items.map((item) =>
        db
          .prepare(
            `INSERT INTO meal_items (
              meal_id, name, quantity, estimated_grams, fdc_id, source_description,
              calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
              confidence, note
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            mealId,
            item.name,
            item.quantity,
            item.estimatedGrams,
            item.fdcId ?? null,
            item.sourceDescription ?? null,
            item.calories,
            item.proteinG,
            item.carbsG,
            item.fatG,
            item.fiberG,
            item.sugarG,
            item.sodiumMg,
            item.confidence,
            item.note ?? null,
          ),
      ),
    );

    return Response.json({ meal: { id: mealId, eatenAt, ...payload } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
