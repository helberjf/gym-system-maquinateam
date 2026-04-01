import Link from "next/link";
import { BadgeCheck, Clock3, Flame, Sparkles } from "lucide-react";
import { PlanCheckoutButton } from "@/components/public/PlanCheckoutButton";
import { PublicPlanCard } from "@/components/public/PublicPlanCard";
import { SectionHeading } from "@/components/public/SectionHeading";
import { Button } from "@/components/ui/Button";
import { getOptionalSession } from "@/lib/auth/session";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  getPublicPlanSections,
  type PublicPlanCatalogItem,
  type PublicPlanSection,
} from "@/lib/billing/public";
import { BRAND } from "@/lib/constants/brand";
import { absoluteUrl, buildPublicMetadata, serializeJsonLd } from "@/lib/seo";

export const metadata = buildPublicMetadata({
  title: "Planos de treino",
  description:
    "Conheca os planos da Maquina Team e escolha o ritmo ideal para sua rotina de treino em Juiz de Fora.",
  path: "/planos",
  keywords: [
    "planos de academia",
    "planos de luta",
    "academia em juiz de fora",
    "plano full",
  ],
});

export const revalidate = 120;

function RecommendedFullPlanCard({
  plan,
  isAuthenticated,
}: {
  plan: PublicPlanCatalogItem;
  isAuthenticated: boolean;
}) {
  const isRecommended = plan.isRecommended;

  return (
    <article
      className={[
        "flex h-full flex-col rounded-[2rem] border p-5 sm:p-6",
        isRecommended
          ? "border-white bg-white text-black shadow-[0_18px_60px_rgba(255,255,255,0.08)]"
          : "border-[#e2b34d] bg-[#f5e2a8] text-black shadow-[0_18px_60px_rgba(226,179,77,0.14)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-black/60">
            {isRecommended ? "Plano recomendado" : "Condicao especial"}
          </p>
          <h3 className="mt-3 text-2xl font-bold uppercase sm:text-3xl">
            {plan.name}
          </h3>
        </div>
        <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
          {isRecommended ? "FULL" : "SOCIAL"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-black/70">
        {plan.description}
      </p>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.24em] text-black/60">
          Qualquer dia e horario
        </p>
        <p className="mt-2 text-4xl font-bold leading-none sm:text-5xl">
          {formatCurrencyFromCents(plan.monthlyEquivalentCents)}
        </p>
        <p className="mt-2 text-sm text-black/70">por mes</p>
        <p className="mt-3 text-sm text-black/70">
          Cobranca: {formatCurrencyFromCents(plan.priceCents)}
          {plan.fullVariant === "social"
            ? " com validacao comercial"
            : " no ciclo mensal"}
        </p>
      </div>

      <ul className="mt-6 space-y-3 text-sm text-black/80">
        {(plan.benefits ?? []).slice(0, 3).map((benefit) => (
          <li key={benefit} className="flex gap-3">
            <span className="text-black">+</span>
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      {plan.fullVariant === "social" ? (
        <p className="mt-5 rounded-2xl border border-black/10 bg-black/[0.04] px-4 py-3 text-xs uppercase tracking-[0.14em] text-black/70">
          Consulte a equipe antes de contratar essa condicao.
        </p>
      ) : null}

      <div className="mt-8">
        <PlanCheckoutButton
          planId={plan.id}
          isAuthenticated={isAuthenticated}
          callbackUrl="/planos"
          tone="light"
          className="w-full bg-black text-white hover:bg-black/90"
        />
      </div>
    </article>
  );
}

function RecommendedFullSection({
  plans,
  isAuthenticated,
}: {
  plans: PublicPlanCatalogItem[];
  isAuthenticated: boolean;
}) {
  if (plans.length === 0) {
    return null;
  }

  const recommended = plans.find((plan) => plan.isRecommended) ?? plans[0];
  const orderedPlans = [
    recommended,
    ...plans.filter((plan) => plan.id !== recommended.id),
  ];

  return (
    <section className="mt-12 overflow-hidden rounded-[2.7rem] border border-[#e2b34d]/35 bg-[radial-gradient(circle_at_top_left,rgba(226,179,77,0.2),transparent_30%),linear-gradient(135deg,#0b0b0b,#171717)] p-1 shadow-[0_30px_120px_rgba(0,0,0,0.4)]">
      <div className="rounded-[2.4rem] bg-brand-black px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start">
          <div>
            <span className="inline-flex rounded-full border border-[#e2b34d]/30 bg-[#e2b34d]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f3d98d]">
              Plano recomendado
            </span>
            <h2 className="mt-4 text-4xl font-bold uppercase leading-[0.92] text-white sm:text-5xl">
              Plano FULL para quem quer viver a academia
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-brand-gray-light sm:text-base">
              O FULL concentra a melhor experiencia da grade publica: acesso
              livre, liberdade de agenda e checkout online com Pix pela
              AbacatePay ou cartao no Mercado Pago.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Clock3,
                  label: "Flexibilidade",
                  value: "Qualquer dia e horario",
                },
                {
                  icon: Flame,
                  label: "Ritmo",
                  value: "Treinos ilimitados",
                },
                {
                  icon: BadgeCheck,
                  label: "Checkout",
                  value: "Pix ou cartao",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
                >
                  <item.icon className="h-5 w-5 text-[#f3d98d]" />
                  <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-[#f3d98d]">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.22em]">
                  Por que recomendamos esse plano
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-brand-gray-light">
                Ele entrega a rotina mais livre da academia e centraliza o
                melhor argumento de conversao para quem ja quer treinar serio
                desde o primeiro acesso.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {orderedPlans.map((plan) => (
              <RecommendedFullPlanCard
                key={plan.id}
                plan={plan}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanPeriodSection({
  section,
  isAuthenticated,
}: {
  section: PublicPlanSection;
  isAuthenticated: boolean;
}) {
  return (
    <section>
      <h2 className="text-3xl font-bold uppercase text-white sm:text-4xl">
        {section.title}
      </h2>
      <p className="mt-2 text-sm text-brand-gray-light">
        {section.plans.length}{" "}
        {section.plans.length === 1 ? "opcao ativa" : "opcoes ativas"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {section.plans.map((plan) => (
          <PublicPlanCard
            key={plan.id}
            plan={plan}
            isAuthenticated={isAuthenticated}
            callbackUrl="/planos"
          />
        ))}
      </div>
    </section>
  );
}

export default async function PlanosPage() {
  const [session, sections] = await Promise.all([
    getOptionalSession(),
    getPublicPlanSections(),
  ]);
  const isAuthenticated = Boolean(session?.user?.id);

  const fullPlans = sections.flatMap((section) =>
    section.plans.filter((plan) => plan.isFull),
  );
  const remainingSections = sections
    .map((section) => ({
      ...section,
      plans: section.plans.filter((plan) => !plan.isFull),
    }))
    .filter((section) => section.plans.length > 0);
  const fullSection =
    fullPlans.length > 0
      ? ({
          key: "special",
          title: "Plano Full",
          plans: fullPlans,
        } satisfies PublicPlanSection)
      : null;
  const displaySections = fullSection
    ? [...remainingSections, fullSection]
    : remainingSections;
  const plansSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Planos Maquina Team",
    url: absoluteUrl("/planos"),
    description:
      "Tabela publica de planos de treino da Maquina Team com opcoes mensais, semestrais, anuais e Full.",
    hasPart: displaySections.map((section) => ({
      "@type": "OfferCatalog",
      name: section.title,
      itemListElement: section.plans.map((plan, index) => ({
        "@type": "Offer",
        position: index + 1,
        name: plan.name,
        description: plan.description,
        priceCurrency: "BRL",
        price: (plan.priceCents / 100).toFixed(2),
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/planos"),
      })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(plansSchema),
        }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Planos"
          title="Escolha o seu ritmo"
          description="Planos claros, diretos e com checkout online. Escolha a frequencia e o periodo que encaixam na sua rotina."
          align="center"
        />

        <RecommendedFullSection
          plans={fullPlans}
          isAuthenticated={isAuthenticated}
        />

        <div className="mt-14 space-y-14">
          {displaySections.map((section) => (
            <PlanPeriodSection
              key={section.key}
              section={section}
              isAuthenticated={isAuthenticated}
            />
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
            Depois do cadastro, o aluno passa a acompanhar pagamentos, treinos
            atribuidos e comunicacoes da academia no proprio painel.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="w-full border-black/15 text-black hover:bg-black/5 sm:w-auto"
            >
              <a
                href={BRAND.contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tirar duvidas no WhatsApp
              </a>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
