import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PublicPlanCard } from "@/components/public/PublicPlanCard";
import { SectionHeading } from "@/components/public/SectionHeading";
import { BRAND } from "@/lib/constants/brand";
import { PLAN_PERIOD_LABELS, groupPlansByPeriod } from "@/lib/constants/plans";

export const metadata: Metadata = {
  title: "Planos",
  description: "Conheca os planos da Maquina Team e escolha o ritmo ideal para sua rotina.",
};

const groupedPlans = groupPlansByPeriod();

const sections = [
  { key: "monthly", title: PLAN_PERIOD_LABELS.MONTHLY, plans: groupedPlans.monthly },
  {
    key: "semiannual",
    title: PLAN_PERIOD_LABELS.SEMIANNUAL,
    plans: groupedPlans.semiannual,
  },
  { key: "annual", title: PLAN_PERIOD_LABELS.ANNUAL, plans: groupedPlans.annual },
  { key: "full", title: PLAN_PERIOD_LABELS.FULL, plans: groupedPlans.full },
] as const;

export default function PlanosPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Planos"
        title="Tabela publica"
        description="Todos os planos foram organizados por periodo para facilitar a comparacao. Se quiser ajuda na escolha, a equipe comercial atende rapido pelo WhatsApp."
        align="center"
      />

      <div className="mt-12 space-y-12">
        {sections.map((section) => (
          <section key={section.key}>
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-brand-gray-light">
                  {section.title}
                </p>
                <h2 className="mt-2 text-3xl font-bold uppercase text-white sm:text-4xl">
                  {section.title}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {section.plans.map((plan) => (
                <PublicPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-14 rounded-[2.5rem] border border-brand-gray-mid bg-white px-6 py-10 text-black sm:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-black/55">
          Proximo passo
        </p>
        <h2 className="mt-4 text-4xl font-bold uppercase leading-none sm:text-5xl">
          Escolha o plano e entre no sistema
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/70 sm:text-base">
          Depois do cadastro, o aluno passa a acompanhar pagamentos, presenca,
          treinos atribuidos e comunicacoes da academia no proprio painel.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
            <a href={BRAND.contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
              Tirar duvidas no WhatsApp
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
