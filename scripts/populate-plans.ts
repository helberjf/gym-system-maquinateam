import { PrismaClient } from "@prisma/client";
import { DEFAULT_PUBLIC_PLAN_CATALOG } from "../src/lib/billing/public-plan-catalog";

const prisma = new PrismaClient();

async function main() {
  console.log(`Sincronizando ${DEFAULT_PUBLIC_PLAN_CATALOG.length} planos no banco...`);

  const results = await prisma.$transaction(
    DEFAULT_PUBLIC_PLAN_CATALOG.map((plan) =>
      prisma.plan.upsert({
        where: { slug: plan.slug },
        update: {
          name: plan.name,
          description: plan.description,
          benefits: [...plan.benefits],
          modalityId: null,
          priceCents: plan.priceCents,
          billingIntervalMonths: plan.billingIntervalMonths,
          durationMonths: plan.durationMonths,
          sessionsPerWeek: plan.sessionsPerWeek,
          isUnlimited: plan.isUnlimited,
          enrollmentFeeCents: plan.enrollmentFeeCents,
          active: true,
        },
        create: {
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          benefits: [...plan.benefits],
          modalityId: null,
          priceCents: plan.priceCents,
          billingIntervalMonths: plan.billingIntervalMonths,
          durationMonths: plan.durationMonths,
          sessionsPerWeek: plan.sessionsPerWeek,
          isUnlimited: plan.isUnlimited,
          enrollmentFeeCents: plan.enrollmentFeeCents,
          active: true,
        },
        select: { id: true, slug: true, name: true },
      }),
    ),
  );

  console.log("\nPlanos sincronizados:");
  results.forEach((plan) => console.log(`  ✓ ${plan.name} (${plan.slug})`));
  console.log(`\nTotal: ${results.length} planos ativos no banco.`);
}

main()
  .catch((error) => {
    console.error("Erro ao popular planos:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
