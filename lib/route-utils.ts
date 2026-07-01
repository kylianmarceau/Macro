import { ZodError } from "zod";

export function jsonError(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Invalid request.", issues: error.issues },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  const status =
    message.includes("binding `DB`") || message.includes("API key") ? 503 : 500;
  return Response.json({ error: message }, { status });
}

export function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}
