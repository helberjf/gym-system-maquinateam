import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type PublicPlanPeriodKey =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "special";

export type PublicFullPlanVariant = "standard" | "social" | null;

export type PublicPlanCatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  benefits: string[];
  priceCents: number;
  monthlyEquivalentCents: number;
  enrollmentFeeCents: number;
  billingIntervalMonths: number;
  durationMonths: number | null;
  sessionsPerWeek: number | null;
  isUnlimited: boolean;
  periodKey: PublicPlanPeriodKey;
  periodLabel: string;
  badge: string | null;
  featured: boolean;
  isFull: boolean;
  fullVariant: PublicFullPlanVariant;
  isRecommended: boolean;
  source: "database" | "fallback";
};

export type PublicPlanSection = {
  key: PublicPlanPeriodKey;
  title: string;
  plans: PublicPlanCatalogItem[];
};

const SECTION_ORDER: PublicPlanPeriodKey[] = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "special",
];

const FALLBACK_PUBLIC_PLANS = [
  {
    id: "fallback-plan-mensal-1x-na-semana",
    slug: "mensal-1x-na-semana",
    name: "Mensal 1x na Semana",
    description:
      "Plano mensal para manter constancia com uma aula por semana.",
    benefits: [
      "1 treino por semana",
      "Acesso ao app do aluno",
      "Acompanhamento basico da equipe",
    ],
    priceCents: 12900,
    billingIntervalMonths: 1,
    durationMonths: 1,
    sessionsPerWeek: 1,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-mensal-2x-na-semana",
    slug: "mensal-2x-na-semana",
    name: "Mensal 2x na Semana",
    description:
      "Plano mensal para evoluir tecnica e condicionamento com duas aulas por semana.",
    benefits: [
      "2 treinos por semana",
      "App com historico e pagamentos",
      "Rotina forte de evolucao",
    ],
    priceCents: 15900,
    billingIntervalMonths: 1,
    durationMonths: 1,
    sessionsPerWeek: 2,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-mensal-3x-na-semana",
    slug: "mensal-3x-na-semana",
    name: "Mensal 3x na Semana",
    description:
      "Plano mensal para acelerar a evolucao com tres aulas por semana.",
    benefits: [
      "3 treinos por semana",
      "Melhor custo-beneficio do mensal",
      "Mais intensidade na rotina",
    ],
    priceCents: 17900,
    billingIntervalMonths: 1,
    durationMonths: 1,
    sessionsPerWeek: 3,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-semestral-1x-na-semana",
    slug: "semestral-1x-na-semana",
    name: "Semestral 1x na Semana",
    description:
      "Plano de 6 meses para manter constancia com economia mensal.",
    benefits: [
      "1 treino por semana",
      "Total de R$ 714,00 no periodo",
      "Melhor valor que o mensal",
    ],
    priceCents: 71400,
    billingIntervalMonths: 6,
    durationMonths: 6,
    sessionsPerWeek: 1,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-semestral-2x-na-semana",
    slug: "semestral-2x-na-semana",
    name: "Semestral 2x na Semana",
    description:
      "Plano de 6 meses para manter ritmo forte e previsibilidade.",
    benefits: [
      "2 treinos por semana",
      "Total de R$ 858,00 no periodo",
      "Compromisso de medio prazo",
    ],
    priceCents: 85800,
    billingIntervalMonths: 6,
    durationMonths: 6,
    sessionsPerWeek: 2,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-semestral-3x-na-semana",
    slug: "semestral-3x-na-semana",
    name: "Semestral 3x na Semana",
    description:
      "Plano de 6 meses para quem quer treinar serio e colher resultado.",
    benefits: [
      "3 treinos por semana",
      "Total de R$ 978,00 no periodo",
      "Ritmo forte de evolucao",
    ],
    priceCents: 97800,
    billingIntervalMonths: 6,
    durationMonths: 6,
    sessionsPerWeek: 3,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-anual-1x-na-semana",
    slug: "anual-1x-na-semana",
    name: "Anual 1x na Semana",
    description:
      "Plano anual com a menor mensalidade da grade para manter constancia.",
    benefits: [
      "1 treino por semana",
      "Total de R$ 1.308,00 no periodo",
      "Maior economia no longo prazo",
    ],
    priceCents: 130800,
    billingIntervalMonths: 12,
    durationMonths: 12,
    sessionsPerWeek: 1,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-anual-2x-na-semana",
    slug: "anual-2x-na-semana",
    name: "Anual 2x na Semana",
    description:
      "Plano anual equilibrado para tecnica, cardio e consistencia.",
    benefits: [
      "2 treinos por semana",
      "Total de R$ 1.428,00 no periodo",
      "Valor mensal mais competitivo",
    ],
    priceCents: 142800,
    billingIntervalMonths: 12,
    durationMonths: 12,
    sessionsPerWeek: 2,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-anual-3x-na-semana",
    slug: "anual-3x-na-semana",
    name: "Anual 3x na Semana",
    description:
      "Plano anual premium para acelerar evolucao com a melhor relacao custo-frequencia.",
    benefits: [
      "3 treinos por semana",
      "Total de R$ 1.788,00 no periodo",
      "Plano premium da grade publica",
    ],
    priceCents: 178800,
    billingIntervalMonths: 12,
    durationMonths: 12,
    sessionsPerWeek: 3,
    isUnlimited: false,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-plano-full",
    slug: "plano-full",
    name: "Plano Full",
    description:
      "Qualquer dia e qualquer horario para quem quer viver a rotina completa da academia.",
    benefits: [
      "Treinos ilimitados",
      "Qualquer dia e qualquer horario",
      "Acesso completo a uma arte marcial",
    ],
    priceCents: 25000,
    billingIntervalMonths: 1,
    durationMonths: 1,
    sessionsPerWeek: null,
    isUnlimited: true,
    enrollmentFeeCents: 0,
  },
  {
    id: "fallback-plan-plano-full-desconto-social",
    slug: "plano-full-desconto-social",
    name: "Plano Full Desconto Social",
    description:
      "Siga nossos perfis, avalie a academia e consulte a equipe antes de contratar essa condicao especial.",
    benefits: [
      "Treinos ilimitados",
      "Condicao social especial",
      "Consulte a equipe antes de contratar",
    ],
    priceCents: 18500,
    billingIntervalMonths: 1,
    durationMonths: 1,
    sessionsPerWeek: null,
    isUnlimited: true,
    enrollmentFeeCents: 0,
  },
] as const;

function resolveFullPlanVariant(input: {
  name: string;
  slug: string;
}): PublicFullPlanVariant {
  const normalizedPlan = `${input.name} ${input.slug}`.toLowerCase();

  if (!normalizedPlan.includes("full")) {
    return null;
  }

  if (
    normalizedPlan.includes("desconto") ||
    normalizedPlan.includes("social")
  ) {
    return "social";
  }

  return "standard";
}

function resolvePlanPeriod(input: {
  billingIntervalMonths: number;
  name: string;
  slug: string;
}): {
  key: PublicPlanPeriodKey;
  label: string;
} {
  const normalizedPlan = `${input.name} ${input.slug}`.toLowerCase();

  if (normalizedPlan.includes("full")) {
    return { key: "special", label: "Plano Full" };
  }

  const months = input.billingIntervalMonths;

  if (months === 1) {
    return { key: "monthly", label: "Mensal" };
  }

  if (months === 3) {
    return { key: "quarterly", label: "Trimestral" };
  }

  if (months === 6) {
    return { key: "semiannual", label: "Semestral" };
  }

  if (months === 12) {
    return { key: "annual", label: "Anual" };
  }

  return { key: "special", label: "Especial" };
}

function resolvePlanBadge(input: {
  name: string;
  slug: string;
  billingIntervalMonths: number;
  sessionsPerWeek: number | null;
  isUnlimited: boolean;
  priceCents: number;
}) {
  const fullVariant = resolveFullPlanVariant(input);

  if (fullVariant === "social") {
    return "CONDICAO ESPECIAL";
  }

  if (fullVariant === "standard") {
    return "PLANO COMPLETO";
  }

  if (input.billingIntervalMonths >= 12) {
    return "MAIS ECONOMICO";
  }

  if (
    input.billingIntervalMonths === 1 &&
    (input.sessionsPerWeek ?? 0) >= 3
  ) {
    return "MAIS";
  }

  if ((input.sessionsPerWeek ?? 0) >= 3) {
    return "ALTA EVOLUCAO";
  }

  if (input.billingIntervalMonths >= 3) {
    return "MELHOR VALOR";
  }

  return null;
}

function resolvePlanFeatured(input: {
  billingIntervalMonths: number;
  sessionsPerWeek: number | null;
  isUnlimited: boolean;
}) {
  return (
    input.isUnlimited ||
    (input.sessionsPerWeek ?? 0) >= 3 ||
    input.billingIntervalMonths >= 3
  );
}

function mapPlanToPublicCard(plan: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  benefits: readonly string[];
  priceCents: number;
  billingIntervalMonths: number;
  durationMonths: number | null;
  sessionsPerWeek: number | null;
  isUnlimited: boolean;
  enrollmentFeeCents: number;
}, source: PublicPlanCatalogItem["source"] = "database") {
  const fullVariant = resolveFullPlanVariant({
    name: plan.name,
    slug: plan.slug,
  });
  const period = resolvePlanPeriod({
    billingIntervalMonths: plan.billingIntervalMonths,
    name: plan.name,
    slug: plan.slug,
  });
  const referenceMonths = Math.max(
    1,
    plan.durationMonths ?? plan.billingIntervalMonths,
  );

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    benefits: [...plan.benefits],
    priceCents: plan.priceCents,
    monthlyEquivalentCents: Math.round(plan.priceCents / referenceMonths),
    enrollmentFeeCents: plan.enrollmentFeeCents,
    billingIntervalMonths: plan.billingIntervalMonths,
    durationMonths: plan.durationMonths,
    sessionsPerWeek: plan.sessionsPerWeek,
    isUnlimited: plan.isUnlimited,
    periodKey: period.key,
    periodLabel: period.label,
    badge: resolvePlanBadge({
      name: plan.name,
      slug: plan.slug,
      billingIntervalMonths: plan.billingIntervalMonths,
      sessionsPerWeek: plan.sessionsPerWeek,
      isUnlimited: plan.isUnlimited,
      priceCents: plan.priceCents,
    }),
    featured: resolvePlanFeatured(plan),
    isFull: fullVariant !== null,
    fullVariant,
    isRecommended: fullVariant === "standard",
    source,
  } satisfies PublicPlanCatalogItem;
}

function getFallbackPublicPlansCatalog() {
  return FALLBACK_PUBLIC_PLANS.map((plan) =>
    mapPlanToPublicCard(plan, "fallback"),
  );
}

export const getPublicPlansCatalog = cache(async function getPublicPlansCatalog() {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        active: true,
      },
      orderBy: [
        { billingIntervalMonths: "asc" },
        { priceCents: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        benefits: true,
        priceCents: true,
        billingIntervalMonths: true,
        durationMonths: true,
        sessionsPerWeek: true,
        isUnlimited: true,
        enrollmentFeeCents: true,
      },
    });

    if (plans.length === 0) {
      console.warn(
        "Catalogo publico de planos vazio. Usando fallback estatico para manter a vitrine disponivel.",
      );
      return getFallbackPublicPlansCatalog();
    }

    return plans.map(mapPlanToPublicCard);
  } catch (error) {
    console.error("Falha ao carregar catalogo de planos.", error);
    return getFallbackPublicPlansCatalog();
  }
});

export async function getPublicPlanSections() {
  const plans = await getPublicPlansCatalog();
  const sectionMap = new Map<PublicPlanPeriodKey, PublicPlanSection>();

  for (const plan of plans) {
    if (!sectionMap.has(plan.periodKey)) {
      sectionMap.set(plan.periodKey, {
        key: plan.periodKey,
        title: plan.periodLabel,
        plans: [],
      });
    }

    sectionMap.get(plan.periodKey)!.plans.push(plan);
  }

  return SECTION_ORDER
    .map((key) => sectionMap.get(key))
    .filter((section): section is PublicPlanSection => Boolean(section));
}

export async function getFeaturedPublicPlans(limit = 3) {
  const plans = await getPublicPlansCatalog();
  const ordered = [...plans].sort((left, right) => {
    if (left.isRecommended !== right.isRecommended) {
      return Number(right.isRecommended) - Number(left.isRecommended);
    }

    if (left.isFull !== right.isFull) {
      return Number(right.isFull) - Number(left.isFull);
    }

    if (left.featured !== right.featured) {
      return Number(right.featured) - Number(left.featured);
    }

    if (left.billingIntervalMonths !== right.billingIntervalMonths) {
      return right.billingIntervalMonths - left.billingIntervalMonths;
    }

    if ((left.sessionsPerWeek ?? 0) !== (right.sessionsPerWeek ?? 0)) {
      return (right.sessionsPerWeek ?? 0) - (left.sessionsPerWeek ?? 0);
    }

    return left.priceCents - right.priceCents;
  });

  const selected: PublicPlanCatalogItem[] = [];

  for (const plan of ordered) {
    if (selected.length >= limit) {
      break;
    }

    if (!plan.featured && !plan.isRecommended) {
      continue;
    }

    if (plan.isFull && selected.some((item) => item.isFull)) {
      continue;
    }

    selected.push(plan);
  }

  if (selected.length < limit) {
    for (const plan of ordered) {
      if (selected.length >= limit) {
        break;
      }

      if (selected.some((item) => item.id === plan.id)) {
        continue;
      }

      if (plan.isFull && selected.some((item) => item.isFull)) {
        continue;
      }

      selected.push(plan);
    }
  }

  return selected.slice(0, limit);
}
