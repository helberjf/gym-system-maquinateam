import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/constants/brand";

type AuthShowcaseShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  supportTitle: string;
  supportDescription: string;
  highlights: string[];
  children: React.ReactNode;
};

const supportStats = [
  {
    label: "Planos",
    value: "Checkout e suporte",
  },
  {
    label: "Treinos",
    value: "Rotina no painel",
  },
  {
    label: "Atendimento",
    value: "Equipe comercial ativa",
  },
  {
    label: "Horario",
    value: "08h as 22h",
  },
] as const;

export function AuthShowcaseShell({
  eyebrow,
  title,
  description,
  supportTitle,
  supportDescription,
  highlights,
  children,
}: AuthShowcaseShellProps) {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-brand-gray-dark/75 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-white transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para home
          </Link>

          <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,#121212_0%,#080808_100%)] p-5 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-white">
              <LockKeyhole className="h-4 w-4" />
              {eyebrow}
            </span>
            <h1 className="mt-5 text-4xl font-bold uppercase leading-[0.92] text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-gray-light sm:text-base">
              {description}
            </p>

            <div className="mt-8">{children}</div>
          </div>
        </div>

        <aside className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_26%),linear-gradient(180deg,#0f0f0f_0%,#060606_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.jpg"
              alt={BRAND.name}
              width={54}
              height={54}
              className="size-12 rounded-full border border-white/10 object-cover sm:size-[54px]"
            />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-white sm:text-base">
                {BRAND.name}
              </p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand-gray-light">
                Area segura
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-brand-white">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                Fluxo premium
              </p>
            </div>
            <h2 className="mt-4 text-3xl font-bold uppercase leading-[0.95] text-white sm:text-4xl">
              {supportTitle}
            </h2>
            <p className="mt-4 text-sm leading-7 text-brand-gray-light sm:text-base">
              {supportDescription}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {highlights.map((item) => (
              <div
                key={item}
                className="rounded-[1.35rem] border border-white/10 bg-black/30 px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-brand-white" />
                  <p className="text-sm leading-6 text-brand-white">{item}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {supportStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-gray-light">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold uppercase leading-tight text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
