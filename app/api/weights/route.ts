import { requireApiUser } from "@/lib/app-auth";
import { getD1 } from "@/lib/database";
import { jsonError, parsePositiveInt } from "@/lib/route-utils";
import { weightEntrySchema } from "@/lib/schemas";

type WeightRow = {
  id: number;
  entryDate: string;
  weightKg: number;
  createdAt: string;
};

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const days = parsePositiveInt(new URL(request.url).searchParams.get("days"), 90, 365);
    const rows = await getD1()
      .prepare(
        `SELECT id, entry_date as entryDate, weight_kg as weightKg, created_at as createdAt
         FROM weight_entries
         WHERE user_id = ?
           AND entry_date >= date('now', ?)
         ORDER BY entry_date ASC`,
      )
      .bind(user.id, `-${days} days`)
      .all<WeightRow>();

    return Response.json({ weights: rows.results ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const payload = weightEntrySchema.parse(await request.json());
    await getD1()
      .prepare(
        `INSERT INTO weight_entries (user_id, entry_date, weight_kg)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, entry_date) DO UPDATE SET
           weight_kg = excluded.weight_kg`,
      )
      .bind(user.id, payload.entryDate, payload.weightKg)
      .run();

    return Response.json({ weight: payload }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
