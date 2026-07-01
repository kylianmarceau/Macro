import { calculateTargets } from "@/lib/calculations";
import { requireApiUser } from "@/lib/app-auth";
import { getD1 } from "@/lib/database";
import { jsonError } from "@/lib/route-utils";
import { profileSchema } from "@/lib/schemas";

type ProfileRow = {
  sex: "female" | "male";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  weeklyChangeKg: number;
};

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const profile = await getD1()
      .prepare(
        `SELECT sex, age, height_cm as heightCm, weight_kg as weightKg,
          activity_level as activityLevel, goal, weekly_change_kg as weeklyChangeKg
         FROM profiles
         WHERE user_id = ?`,
      )
      .bind(user.id)
      .first<ProfileRow>();

    return Response.json({
      user: {
        email: user.email,
        displayName: user.displayName,
        fullName: user.fullName,
      },
      profile,
      targets: profile ? calculateTargets(profile) : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const payload = profileSchema.parse(await request.json());
    await getD1()
      .prepare(
        `INSERT INTO profiles (
          user_id, sex, age, height_cm, weight_kg, activity_level, goal, weekly_change_kg
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          sex = excluded.sex,
          age = excluded.age,
          height_cm = excluded.height_cm,
          weight_kg = excluded.weight_kg,
          activity_level = excluded.activity_level,
          goal = excluded.goal,
          weekly_change_kg = excluded.weekly_change_kg,
          updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        user.id,
        payload.sex,
        payload.age,
        payload.heightCm,
        payload.weightKg,
        payload.activityLevel,
        payload.goal,
        payload.weeklyChangeKg,
      )
      .run();

    return Response.json({
      profile: payload,
      targets: calculateTargets(payload),
    });
  } catch (error) {
    return jsonError(error);
  }
}
