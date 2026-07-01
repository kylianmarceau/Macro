import { requireApiUser } from "@/lib/app-auth";
import { estimateMeal } from "@/lib/nutrition";
import { jsonError } from "@/lib/route-utils";
import { estimateMealSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const payload = estimateMealSchema.parse(await request.json());
    const estimate = await estimateMeal(payload.description);
    return Response.json({ estimate });
  } catch (error) {
    return jsonError(error);
  }
}
