import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth/session";
import { Logo } from "@/components/brand/Logo";
import { isProduction } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/new");
  const { next } = await searchParams;

  return (
    <div className="container-page grid min-h-[calc(100vh-16rem)] items-center gap-12 py-14 lg:grid-cols-[1fr_0.95fr]">
      <div className="hidden lg:block">
        <div className="panel-dark relative overflow-hidden rounded-[2rem] p-12">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 0%, rgba(214,174,99,.22), transparent 42%), radial-gradient(circle at 0% 100%, rgba(103,70,200,.4), transparent 45%)",
            }}
          />
          <div className="relative">
            <Logo light />
            <h1 className="display mt-12 text-[3.2rem] text-[#faf7f0]">
              Return to your
              <br />
              <em className="text-[#d6ae63]">own story.</em>
            </h1>
            <p className="mt-6 max-w-sm text-[0.92rem] leading-relaxed text-[rgba(250,247,240,.62)]">
              Your readings, conversations and privacy controls live in one quiet place. Nothing is
              shared without a link you create.
            </p>
            <div className="mt-12 space-y-3 border-t border-[rgba(250,247,240,.12)] pt-8">
              {["Encrypted birth details", "Private palm photographs", "One-click full deletion"].map((item) => (
                <p key={item} className="flex items-center gap-3 text-[0.8rem] text-[rgba(250,247,240,.7)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d6ae63]" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="lg:hidden">
          <Logo />
        </div>
        <p className="eyebrow mt-8 lg:mt-0">Welcome back</p>
        <h1 className="display mt-4 text-4xl text-[#10152b]">Sign in to AIBABA</h1>
        <p className="mt-3 text-[0.9rem] text-[#6b6785]">
          Continue a reading, revisit a report or adjust your privacy choices.
        </p>
        <div className="mt-8">
          <AuthForm mode="login" redirectTo={next} />
        </div>
        {!isProduction && (
          <div className="mt-6 rounded-xl border border-[#e8dfc9] bg-[#fbf9f4] px-4 py-3">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#8a6a2d]">Local demo account</p>
            <p className="mt-1 font-mono text-[0.78rem] text-[#4b4866]">demo@aibaba.app · Aibaba@2026</p>
          </div>
        )}
        <p className="mt-8 text-center text-[0.76rem] text-[#8a86a0]">
          <Link href="/" className="hover:text-[#6746c8]">
            ← Back to AIBABA
          </Link>
        </p>
      </div>
    </div>
  );
}
