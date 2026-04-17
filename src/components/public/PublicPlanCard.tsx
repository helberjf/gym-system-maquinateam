import { PlanCheckoutButton } from "@/components/public/PlanCheckoutButton";
import {
  formatCurrencyFromCents,
  formatMonthsLabel,
  getBillingIntervalLabel,
} from "@/lib/billing/constants";
import type { PublicPlanCatalogItem } from "@/lib/billing/public";

type PublicPlanCardProps = {
  plan: PublicPlanCatalogItem;
  callbackUrl?: string;
};

export function PublicPlanCard({
  plan,
  callbackUrl,
}: PublicPlanCardProps) {
  const isFallback = plan.source === "fallback";
  const recurringLabel = getBillingIntervalLabel(plan.billingIntervalMonths);
  const durationLabel = formatMonthsLabel(
    plan.durationMonths ?? plan.billingIntervalMonths,
  );
  const badgeLabel = plan.isRecommended ? "RECOMENDADO" : plan.badge;
  const emphasisTone = plan.isRecommended
    ? "border-[#e2b34d]/60 bg-[radial-gradient(circle_at_top,rgba(226,179,77,0.18),transparent_34%),linear-gradient(180deg,#1e1608_0%,#0b0b0b_56%,#050505_100%)] shadow-[0_24px_90px_rgba(226,179,77,0.16)]"
    : plan.featured
      ? "border-white/20 bg-[linear-gradient(180deg,#1b1b1b_0%,#0e0e0e_100%)] shadow-[0_22px_80px_rgba(0,0,0,0.34)]"
      : "border-brand-gray-mid bg-brand-gray-dark";

  return (
    <article
      className={[
        "flex h-full flex-col rounded-[2rem] border p-5 sm:p-6",
        "text-white",
        emphasisTone,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-xs uppercase tracking-[0.24em] text-brand-gray-light"
          >
            {plan.periodLabel}
          </p>
          <h3 className="mt-3 text-2xl font-bold uppercase sm:text-3xl">
            {plan.name}
          </h3>
        </div>
        {badgeLabel ? (
          <span
            className={[
              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
              plan.isRecommended
                ? "border border-[#e2b34d]/40 bg-[#e2b34d]/12 text-[#f3d98d]"
                : "border border-brand-gray-mid text-brand-gray-light",
            ].join(" ")}
          >
            {badgeLabel}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-brand-gray-light">
        {plan.description ??
          "Plano ativo para acompanhar treinos, pagamentos e evolucao no sistema da academia."}
      </p>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.24em] opacity-70">
          {plan.isUnlimited
            ? "Acesso livre"
            : plan.sessionsPerWeek
              ? `${plan.sessionsPerWeek} treino(s) por semana`
              : recurringLabel}
        </p>
        <p className="mt-2 text-4xl font-bold leading-none sm:text-5xl">
          {formatCurrencyFromCents(plan.monthlyEquivalentCents)}
        </p>
        <p className="mt-2 text-sm opacity-70">
          {plan.billingIntervalMonths > 1
            ? `equivale a ${formatCurrencyFromCents(plan.monthlyEquivalentCents)} por mes`
            : "por mes"}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] opacity-70">
          {recurringLabel} | duracao {durationLabel}
        </p>
        <p className="mt-3 text-sm opacity-70">
          Cobranca do periodo: {formatCurrencyFromCents(plan.priceCents)}
          {plan.enrollmentFeeCents > 0
            ? ` + matricula ${formatCurrencyFromCents(plan.enrollmentFeeCents)}`
            : ""}
        </p>
      </div>

      <ul className="mt-6 space-y-3 text-sm text-brand-gray-light">
        {(plan.benefits ?? []).map((benefit) => (
          <li key={benefit} className="flex gap-3">
            <span className={plan.isRecommended ? "text-[#f3d98d]" : "text-white"}>+</span>
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      {isFallback ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.14em] text-brand-gray-light">
          Catalogo temporario enquanto o checkout online e sincronizado.
        </p>
      ) : null}

      <div className="mt-8">
        <PlanCheckoutButton
          planId={plan.id}
          callbackUrl={callbackUrl}
          mode={isFallback ? "contact" : "checkout"}
          contactLabel="Consultar plano"
          tone="dark"
          className="w-full shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
        />
      </div>
    </article>
  );
}
