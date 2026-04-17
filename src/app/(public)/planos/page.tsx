import Link from "next/link";
import { BadgeCheck, Clock3, Flame, Sparkles } from "lucide-react";
import { PlanCheckoutButton } from "@/components/public/PlanCheckoutButton";
import { PublicPlanCard } from "@/components/public/PublicPlanCard";
import { SectionHeading } from "@/components/public/SectionHeading";
import { Button } from "@/components/ui/Button";
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

export const dynamic = "force-dynamic";

function RecommendedFullPlanCard({
  plan,
}: {
  plan: PublicPlanCatalogItem;
}) {
  const isFallback = plan.source === "fallback";
  const isRecommended = plan.isRecommended;

  return (
    <article
      className={[
        "flex h-full flex-col rounded-[2rem] border p-5 sm:p-6",
        isRecommended
          ? "border-white/18 bg-[linear-gradient(180deg,#1b1b1b_0%,#0e0e0e_100%)] text-white shadow-[0_22px_80px_rgba(0,0,0,0.34)]"
          : "border-[#e2b34d]/55 bg-[radial-gradient(circle_at_top,rgba(226,179,77,0.18),transparent_34%),linear-gradient(180deg,#1e1608_0%,#0b0b0b_56%,#050505_100%)] text-white shadow-[0_24px_90px_rgba(226,179,77,0.16)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
            {isRecommended ? "Plano recomendado" : "Condicao especial"}
          </p>
          <h3 className="mt-3 text-2xl font-bold uppercase sm:text-3xl">
            {plan.name}
          </h3>
        </div>
        <span className="rounded-full border border-[#e2b34d]/40 bg-[#e2b34d]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3d98d]">
          {isRecommended ? "FULL" : "SOCIAL"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-brand-gray-light">
        {plan.description}
      </p>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
          Qualquer dia e horario
        </p>
        <p className="mt-2 text-4xl font-bold leading-none sm:text-5xl">
          {formatCurrencyFromCents(plan.monthlyEquivalentCents)}
        </p>
        <p className="mt-2 text-sm text-brand-gray-light">por mes</p>
        <p className="mt-3 text-sm text-brand-gray-light">
          Cobranca: {formatCurrencyFromCents(plan.priceCents)}
          {plan.fullVariant === "social"
            ? " com validacao comercial"
            : " no ciclo mensal"}
        </p>
      </div>

      <ul className="mt-6 space-y-3 text-sm text-brand-gray-light">
        {(plan.benefits ?? []).slice(0, 3).map((benefit) => (
          <li key={benefit} className="flex gap-3">
            <span className="text-[#f3d98d]">+</span>
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      {plan.fullVariant === "social" ? (
        <p className="mt-5 rounded-2xl border border-[#e2b34d]/20 bg-[#e2b34d]/8 px-4 py-3 text-xs uppercase tracking-[0.14em] text-[#f3d98d]">
          Consulte a equipe antes de contratar essa condicao.
        </p>
      ) : null}

      {isFallback ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.14em] text-brand-gray-light">
          Catalogo temporario enquanto o checkout online e sincronizado.
        </p>
      ) : null}

      <div className="mt-8">
        <PlanCheckoutButton
          planId={plan.id}
          callbackUrl="/planos"
          mode={isFallback ? "contact" : "checkout"}
          contactLabel="Consultar plano"
          tone="dark"
          className="w-full shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
        />
      </div>
    </article>
  );
}

function RecommendedFullSection({
  plans,
}: {
  plans: PublicPlanCatalogItem[];
}) {
  if (plans.length === 0) {
    return null;
  }

  const isFallbackCatalog = plans.some((plan) => plan.source === "fallback");
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
              {isFallbackCatalog
                ? "O FULL continua em destaque mesmo durante a sincronizacao do catalogo online: acesso livre, liberdade de agenda e atendimento rapido da equipe comercial para fechar o plano."
                : "O FULL concentra a melhor experiencia da grade publica: acesso livre, liberdade de agenda e checkout online com Pix pela AbacatePay ou cartao no Mercado Pago."}
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
                  label: isFallbackCatalog ? "Atendimento" : "Checkout",
                  value: isFallbackCatalog ? "Equipe comercial" : "Pix ou cartao",
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
                {isFallbackCatalog
                  ? "Ele continua sendo o melhor argumento para quem quer treinar serio desde o primeiro acesso, mesmo enquanto a contratacao online passa pela sincronizacao."
                  : "Ele entrega a rotina mais livre da academia e centraliza o melhor argumento de conversao para quem ja quer treinar serio desde o primeiro acesso."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {orderedPlans.map((plan) => (
              <RecommendedFullPlanCard
                key={plan.id}
                plan={plan}
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
}: {
  section: PublicPlanSection;
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
            callbackUrl="/planos"
          />
        ))}
      </div>
    </section>
  );
}

export default async function PlanosPage() {
  const sections = await getPublicPlanSections();
  const hasFallbackPlans = sections.some((section) =>
    section.plans.some((plan) => plan.source === "fallback"),
  );

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
        <div className="mb-6 flex justify-center sm:justify-end">
          <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
            <Link href="/">Voltar para a home</Link>
          </Button>
        </div>

        <SectionHeading
          eyebrow="Planos"
          title="Escolha o seu ritmo"
          description="Planos claros, diretos e com checkout online. Escolha a frequencia e o periodo que encaixam na sua rotina."
          align="center"
        />

        {hasFallbackPlans ? (
          <section className="mx-auto mt-8 max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-5 text-center sm:px-6">
            <p className="text-xs uppercase tracking-[0.28em] text-brand-gray-light">
              Catalogo temporario
            </p>
            <p className="mt-3 text-sm leading-7 text-brand-white sm:text-base">
              Os valores abaixo continuam visiveis enquanto o catalogo online e
              sincronizado novamente. Se quiser fechar agora, a equipe comercial
              atende rapido pelo WhatsApp.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="w-full sm:w-auto">
                <a
                  href={BRAND.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar com a equipe
                </a>
              </Button>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/contato">Ver contato completo</Link>
              </Button>
            </div>
          </section>
        ) : null}

        <RecommendedFullSection
          plans={fullPlans}
        />

        <div className="mt-14 space-y-14">
          {displaySections.map((section) => (
            <PlanPeriodSection
              key={section.key}
              section={section}
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
              variant="outline-dark"
              className="w-full sm:w-auto"
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
