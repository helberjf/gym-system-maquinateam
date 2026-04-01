import { prisma } from "@/lib/prisma";

export type PublicPlanPeriodKey =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "special";

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

function resolvePlanPeriod(months: number): {
  key: PublicPlanPeriodKey;
  label: string;
} {
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
  billingIntervalMonths: number;
  sessionsPerWeek: number | null;
  isUnlimited: boolean;
}) {
  if (input.isUnlimited) {
    return "ILIMITADO";
  }

  if (input.billingIntervalMonths >= 12) {
    return "LONGO PRAZO";
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
  const period = resolvePlanPeriod(plan.billingIntervalMonths);
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
    badge: resolvePlanBadge(plan),
    featured: resolvePlanFeatured(plan),
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

  return plans
    .sort((left, right) => {
      if (left.featured !== right.featured) {
        return Number(right.featured) - Number(left.featured);
      }

      return left.priceCents - right.priceCents;
    })
    .slice(0, limit);
}
