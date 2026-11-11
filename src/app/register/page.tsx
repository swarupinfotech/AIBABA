import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth/session";
import { Logo } from "@/components/brand/Logo";

export const metadata = { title: "Create your account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/new");
  const { next } = await searchParams;

  return (
    <div className="container-page grid min-h-[calc(100vh-16rem)] items-center gap-12 py-14 lg:grid-cols-[1fr_0.95fr]">
      <div className="mx-auto w-full max-w-md">
        <div className="lg:hidden">
          <Logo />
        </div>
        <p className="eyebrow mt-8 lg:mt-0">A considered beginning</p>
        <h1 className="display mt-4 text-4xl text-[#10152b]">Create your account</h1>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-[#6b6785]">
          You can start with one method and add others later. Your draft stays private until you choose
          to submit it.
        </p>
        <div className="mt-8">
          <AuthForm mode="register" redirectTo={next} />
        </div>
        <p className="mt-6 flex items-start gap-2 text-[0.72rem] leading-relaxed text-[#8a86a0]">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6ae63]" />
          AIBABA is for adults and young people aged 13+. It offers traditional reflection, not medical,
          legal or financial advice.
        </p>
      </div>

      <div className="hidden lg:block">
        <div className="panel-dark relative overflow-hidden rounded-[2rem] p-12">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 75% 5%, rgba(214,174,99,.24), transparent 40%), radial-gradient(circle at 5% 100%, rgba(103,70,200,.45), transparent 50%)",
            }}
          />
          <div className="relative">
            <Logo light />
            <h2 className="display mt-12 text-[3.2rem] text-[#faf7f0]">
              A reading with
              <br />
              <em className="text-[#d6ae63]">nothing to hide.</em>
            </h2>
            <div className="mt-10 space-y-5">
              {[
                ["Separate consents", "Calculations, AI interpretation and palm images are each opt-in."],
                ["Visible uncertainty", "Unknown birth time and unreadable palms are stated, not smoothed over."],
                ["Yours to erase", "Delete a reading or your entire account whenever you choose."],
              ].map(([title, body]) => (
                <div key={title} className="border-l border-[rgba(214,174,99,.4)] pl-4">
                  <p className="text-[0.86rem] font-semibold text-[#faf7f0]">{title}</p>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-[rgba(250,247,240,.55)]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="col-span-full text-center text-[0.76rem] text-[#8a86a0]">
        <Link href="/" className="hover:text-[#6746c8]">
          ← Back to AIBABA
        </Link>
      </p>
    </div>
  );
}
