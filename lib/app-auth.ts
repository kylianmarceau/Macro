import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureUser, type UserRecord } from "./database";
import { getRuntimeString } from "./runtime-env";

export type AppUser = UserRecord & {
  fullName: string | null;
};

export async function getOptionalAppUser(): Promise<AppUser | null> {
  const chatGPTUser = await getChatGPTUser();
  const devEmail =
    process.env.NODE_ENV !== "production" ? getRuntimeString("DEV_AUTH_EMAIL") : null;

  if (!chatGPTUser && !devEmail) return null;

  const email = chatGPTUser?.email ?? devEmail ?? "";
  const displayName = chatGPTUser?.displayName ?? email;
  const record = await ensureUser(email, displayName);
  return { ...record, fullName: chatGPTUser?.fullName ?? null };
}

export async function requireApiUser() {
  const user = await getOptionalAppUser();
  if (!user) {
    return {
      user: null,
      response: Response.json(
        { error: "Sign in is required before using Macro." },
        { status: 401 },
      ),
    };
  }
  return { user, response: null };
}
