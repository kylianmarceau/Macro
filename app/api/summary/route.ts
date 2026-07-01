import { requireApiUser } from "@/lib/app-auth";
import { getD1 } from "@/lib/database";
import { jsonError, parsePositiveInt } from "@/lib/route-utils";

type CaloriesPoint = {
  day: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type WeightPoint = {
  day: string;
  weightKg: number;
};

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const days = parsePositiveInt(new URL(request.url).searchParams.get("days"), 30, 365);
    const db = getD1();
    const calories = await db
      .prepare(
        `SELECT date(eaten_at) as day, SUM(calories) as calories,
          SUM(protein_g) as proteinG, SUM(carbs_g) as carbsG, SUM(fat_g) as fatG
         FROM meals
         WHERE user_id = ?
           AND date(eaten_at) >= date('now', ?)
         GROUP BY date(eaten_at)
         ORDER BY day ASC`,
      )
      .bind(user.id, `-${days} days`)
      .all<CaloriesPoint>();
    const weights = await db
      .prepare(
        `SELECT entry_date as day, weight_kg as weightKg
         FROM weight_entries
         WHERE user_id = ?
           AND entry_date >= date('now', ?)
         ORDER BY entry_date ASC`,
      )
      .bind(user.id, `-${days} days`)
      .all<WeightPoint>();

    return Response.json({
      calories: calories.results ?? [],
      weights: weights.results ?? [],
    });
  } catch (error) {
    return jsonError(error);
  }
}
