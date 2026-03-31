import type { Plan } from "@/types";
import { PLAN_PERIOD_LABELS } from "@/lib/constants/plans";
import { BRAND } from "@/lib/constants/brand";

type PublicPlanCardProps = {
  plan: Plan;
};

export function PublicPlanCard({ plan }: PublicPlanCardProps) {
  return (
    <article
      className={[
        "flex h-full flex-col rounded-[2rem] border p-5 sm:p-6",
        plan.featured
          ? "border-white bg-white text-black shadow-[0_20px_80px_rgba(255,255,255,0.08)]"
          : "border-brand-gray-mid bg-brand-gray-dark text-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={[
              "text-xs uppercase tracking-[0.24em]",
              plan.featured ? "text-black/60" : "text-brand-gray-light",
            ].join(" ")}
          >
            {PLAN_PERIOD_LABELS[plan.period]}
          </p>
          <h3 className="mt-3 text-2xl font-bold uppercase sm:text-3xl">{plan.name}</h3>
        </div>
        {plan.badge ? (
          <span
            className={[
              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
              plan.featured
                ? "bg-black text-white"
                : "border border-brand-gray-mid text-brand-gray-light",
            ].join(" ")}
          >
            {plan.badge}
          </span>
        ) : null}
      </div>

      <p
        className={[
          "mt-4 text-sm leading-6",
          plan.featured ? "text-black/70" : "text-brand-gray-light",
        ].join(" ")}
      >
        {plan.description}
      </p>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.24em] opacity-70">
          {plan.frequency === "UNLIMITED" ? "Acesso livre" : `${plan.frequency} por semana`}
        </p>
        <p className="mt-2 text-4xl font-bold leading-none sm:text-5xl">
          R$ {plan.priceMonthly.toFixed(2).replace(".", ",")}
        </p>
        <p className="mt-2 text-sm opacity-70">
          {plan.period === "FULL" ? "valor mensal de referencia" : "por mes"}
        </p>
      </div>

      <ul
        className={[
          "mt-6 space-y-3 text-sm",
          plan.featured ? "text-black/80" : "text-brand-gray-light",
        ].join(" ")}
      >
        {(plan.benefits ?? []).map((benefit) => (
          <li key={benefit} className="flex gap-3">
            <span className={plan.featured ? "text-black" : "text-white"}>+</span>
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <a
          href={BRAND.contact.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            "flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold",
            plan.featured
              ? "bg-black text-white"
              : "border border-brand-gray-mid text-white hover:bg-brand-gray-mid",
          ].join(" ")}
        >
          Falar com a equipe
        </a>
      </div>
    </article>
  );
}
