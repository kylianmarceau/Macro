import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getOptionalAppUser } from "@/lib/app-auth";
import TrackerDashboard from "./tracker-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getOptionalAppUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f4ef] px-6 text-[#1d2528]">
        <section className="w-full max-w-sm rounded-lg border border-[#d8d4c8] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#69706a]">
            Macro
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Sign in to continue</h1>
          <a
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#1f7a5a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#196549]"
            href={chatGPTSignInPath("/")}
          >
            Sign in with ChatGPT
          </a>
        </section>
      </main>
    );
  }

  return (
    <TrackerDashboard
      user={{
        email: user.email,
        displayName: user.displayName,
      }}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
}
