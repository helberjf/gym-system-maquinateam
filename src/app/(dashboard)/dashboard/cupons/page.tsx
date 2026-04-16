import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ApiActionButton } from "@/components/dashboard/ApiActionButton";
import { StoreCouponForm } from "@/components/store/StoreCouponForm";
import { requirePermission } from "@/lib/auth/guards";
import { formatCurrencyFromCents } from "@/lib/billing/constants";
import {
  formatCouponValue,
  getCouponDiscountTypeLabel,
} from "@/lib/store/constants";
import { getCouponManagementData } from "@/lib/store/coupons";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { parseSearchParams } from "@/lib/validators";
import { couponFiltersSchema } from "@/lib/validators/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Cupons",
  description: "CRUD administrativo de cupons, regras e campanhas da loja.",
};

function toDateTimeLocal(value?: Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("manageCoupons", "/dashboard/cupons");
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(
    flattenSearchParams(rawSearchParams),
    couponFiltersSchema,
  );
  const data = await getCouponManagementData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Loja"
        title="Cupons"
        description="Gerencie campanhas, limites de uso, expiracao e elegibilidade por categoria da loja."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <h2 className="text-xl font-bold text-white">Criar cupom</h2>
        <p className="mt-1 text-sm text-brand-gray-light">
          Estruture campanhas com desconto percentual ou fixo, limites de uso e valor minimo.
        </p>
        <div className="mt-6">
          <StoreCouponForm
            mode="create"
            endpoint="/api/store/coupons"
            categories={data.categories}
            initialValues={{
              code: "",
              description: "",
              discountType: "PERCENTAGE",
              discountValue: "",
              active: true,
              usageLimit: "",
              perUserLimit: "",
              minOrderValue: "",
              startsAt: "",
              expiresAt: "",
              eligibleCategories: [],
            }}
          />
        </div>
      </section>

      <section className="space-y-4">
        {data.coupons.map((coupon) => (
          <details
            key={coupon.id}
            className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{coupon.code}</h2>
                    <StatusBadge tone={coupon.active ? "success" : "neutral"}>
                      {coupon.active ? "Ativo" : "Inativo"}
                    </StatusBadge>
                    <StatusBadge tone="info">
                      {getCouponDiscountTypeLabel(coupon.discountType)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-brand-gray-light">
                    {coupon.description ?? "Sem descricao complementar."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone="neutral">
                    {formatCouponValue({
                      discountType: coupon.discountType,
                      discountValue: coupon.discountValue,
                    })}
                  </StatusBadge>
                  <StatusBadge tone="neutral">
                    {coupon._count.redemptions} resgate(s)
                  </StatusBadge>
                </div>
              </div>
            </summary>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Pedido minimo
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {coupon.minOrderValueCents
                    ? formatCurrencyFromCents(coupon.minOrderValueCents)
                    : "Nao definido"}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Uso total
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {coupon.usageCount}
                  {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Limite por usuario
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {coupon.perUserLimit ?? "Livre"}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                  Categorias
                </p>
                <p className="mt-3 text-sm text-white">
                  {coupon.eligibleCategories.length > 0
                    ? coupon.eligibleCategories.join(", ")
                    : "Todo o catalogo"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
              <StoreCouponForm
                mode="edit"
                endpoint={`/api/store/coupons/${coupon.id}`}
                categories={data.categories}
                initialValues={{
                  id: coupon.id,
                  code: coupon.code,
                  description: coupon.description ?? "",
                  discountType: coupon.discountType,
                  discountValue:
                    coupon.discountType === "FIXED_AMOUNT"
                      ? (coupon.discountValue / 100).toFixed(2)
                      : String(coupon.discountValue),
                  active: coupon.active,
                  usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
                  perUserLimit: coupon.perUserLimit ? String(coupon.perUserLimit) : "",
                  minOrderValue: coupon.minOrderValueCents
                    ? (coupon.minOrderValueCents / 100).toFixed(2)
                    : "",
                  startsAt: toDateTimeLocal(coupon.startsAt),
                  expiresAt: toDateTimeLocal(coupon.expiresAt),
                  eligibleCategories: coupon.eligibleCategories,
                }}
              />

              <div className="rounded-3xl border border-brand-gray-mid bg-brand-black/30 p-5">
                <h3 className="text-lg font-bold text-white">Acoes</h3>
                <p className="mt-2 text-sm text-brand-gray-light">
                  Desative o cupom para impedir novos usos sem perder historico.
                </p>
                <div className="mt-5">
                  <ApiActionButton
                    endpoint={`/api/store/coupons/${coupon.id}`}
                    method="DELETE"
                    variant="danger"
                    label="Desativar cupom"
                    loadingLabel="Desativando..."
                    confirmMessage="Deseja realmente desativar este cupom?"
                  />
                </div>
              </div>
            </div>
          </details>
        ))}
      </section>

      <PaginationControls
        pathname="/dashboard/cupons"
        pagination={data.pagination}
        searchParams={rawSearchParams}
      />
    </div>
  );
}
