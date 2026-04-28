import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { GuestPlanCheckoutForm } from "@/components/public/GuestPlanCheckoutForm";
import { SectionHeading } from "@/components/public/SectionHeading";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import { prisma } from "@/lib/prisma";
import { buildPublicMetadata } from "@/lib/seo";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: PageParams }) {
  const { id } = await params;
  const plan = await prisma.plan.findFirst({
    where: { id, active: true },
    select: { name: true },
  });

  return buildPublicMetadata({
    title: plan ? `Assinar ${plan.name}` : "Assinar plano",
    description:
      "Cadastro rapido e checkout do plano em uma so etapa. Pague no Pix ou cartao.",
    path: `/planos/${id}/assinar`,
  });
}

export const dynamic = "force-dynamic";

export default async function GuestPlanCheckoutPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  const session = await auth();
  if (session?.user?.id) {
    redirect("/planos");
  }

  const plan = await prisma.plan.findFirst({
    where: { id, active: true },
    select: {
      id: true,
      name: true,
      description: true,
      benefits: true,
      priceCents: true,
      enrollmentFeeCents: true,
      billingIntervalMonths: true,
      durationMonths: true,
      sessionsPerWeek: true,
      isUnlimited: true,
    },
  });

  if (!plan) {
    notFound();
  }

  const totalCents = plan.priceCents + plan.enrollmentFeeCents;
  const referenceMonths = Math.max(
    1,
    plan.durationMonths ?? plan.billingIntervalMonths,
  );
  const monthlyEquivalent = Math.round(plan.priceCents / referenceMonths);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-center sm:justify-start">
        <Button asChild variant="secondary" size="sm">
          <Link href="/planos">Voltar para os planos</Link>
        </Button>
      </div>

      <SectionHeading
        eyebrow="Assinatura"
        title={`Assine o ${plan.name}`}
        description="Preencha seus dados, escolha o pagamento e finalize sua matricula em poucos cliques."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <aside className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
            Plano selecionado
          </p>
          <h2 className="mt-3 text-2xl font-bold uppercase text-white sm:text-3xl">
            {plan.name}
          </h2>
          {plan.description ? (
            <p className="mt-3 text-sm leading-6 text-brand-gray-light">
              {plan.description}
            </p>
          ) : null}

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-gray-light">
              Valor do periodo
            </p>
            <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              {formatCurrencyFromCents(totalCents)}
            </p>
            <p className="mt-1 text-xs text-brand-gray-light">
              equivalente a {formatCurrencyFromCents(monthlyEquivalent)} por mes
            </p>
            {plan.enrollmentFeeCents > 0 ? (
              <p className="mt-1 text-xs text-brand-gray-light">
                Inclui matricula de{" "}
                {formatCurrencyFromCents(plan.enrollmentFeeCents)}
              </p>
            ) : null}
          </div>

          {plan.benefits.length > 0 ? (
            <ul className="mt-5 space-y-2 text-sm text-brand-gray-light">
              {plan.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span className="text-white">+</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-6 text-xs leading-6 text-brand-gray-light/80">
            Apos o pagamento confirmado, sua conta ja fica ativa para acompanhar
            treinos, presencas e comunicados pelo painel do aluno.
          </p>
        </aside>

        <section className="rounded-[2rem] border border-brand-gray-mid bg-brand-black/60 p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
            Seus dados
          </p>
          <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
            Crie sua conta e ja garanta o plano
          </h3>
          <p className="mt-2 text-xs text-brand-gray-light">
            Ja possui uma conta?{" "}
            <Link
              href={`/login?callbackUrl=${encodeURIComponent("/planos")}`}
              className="text-white underline-offset-4 hover:underline"
            >
              Entrar para assinar
            </Link>
            .
          </p>

          <GuestPlanCheckoutForm planId={plan.id} className="mt-6" />
        </section>
      </div>
    </div>
  );
}
