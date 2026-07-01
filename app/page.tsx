import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getOptionalAppUser } from "@/lib/app-auth";
import TrackerDashboard from "./tracker-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getOptionalAppUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171310] px-6 text-[#F1E9DB]">
        <section className="w-full max-w-sm rounded-md border border-[rgba(241,233,219,0.09)] bg-[#221D17] p-6">
          <p className="text-[26px] font-bold tracking-tight">MACRO</p>
          <p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[rgba(241,233,219,0.55)]">
            AI intake calibration
          </p>
          <h1 className="mt-6 text-xl font-semibold">Sign in to continue</h1>
          <a
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#C99A55] px-4 py-3 text-sm font-semibold text-[#22190D] transition hover:brightness-110"
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
