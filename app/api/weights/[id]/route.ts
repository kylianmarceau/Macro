import { requireApiUser } from "@/lib/app-auth";
import { getD1 } from "@/lib/database";
import { jsonError } from "@/lib/route-utils";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const { id } = await params;
    await getD1()
      .prepare("DELETE FROM weight_entries WHERE id = ? AND user_id = ?")
      .bind(Number(id), user.id)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
