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
  benefits: string[];
  priceCents: number;
  billingIntervalMonths: number;
  durationMonths: number | null;
  sessionsPerWeek: number | null;
  isUnlimited: boolean;
  enrollmentFeeCents: number;
}) {
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
    benefits: plan.benefits,
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
  } satisfies PublicPlanCatalogItem;
}

export async function getPublicPlansCatalog() {
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

  return plans.map(mapPlanToPublicCard);
}

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
