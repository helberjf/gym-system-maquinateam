import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { ApiActionButton } from "@/components/dashboard/ApiActionButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { SubscriptionForm } from "@/components/dashboard/SubscriptionForm";
import { formatDate, toDateInputValue } from "@/lib/academy/constants";
import { getViewerContextFromSession } from "@/lib/academy/access";
import {
  formatCurrencyFromCents,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getSubscriptionStatusLabel,
} from "@/lib/billing/constants";
import {
  getSubscriptionStatusTone,
  resolvePaymentTone,
} from "@/lib/billing/presentation";
import { getSubscriptionDetailData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Detalhes da assinatura",
  description: "Contrato, plano vinculado e historico financeiro.",
};

type RouteParams = Promise<{ id: string }>;

export default async function SubscriptionDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const session = await requirePermission(
    "viewSubscriptions",
    "/dashboard/assinaturas",
  );
  const viewer = await getViewerContextFromSession(session);
  const { id } = await params;
  const data = await getSubscriptionDetailData(viewer, id);
  const { subscription } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assinatura"
        title={subscription.studentProfile.user.name}
        description={`${subscription.plan.name} com vigencia iniciada em ${formatDate(subscription.startDate)}.`}
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            {session.user.role === "ALUNO" &&
            subscription.checkoutPayment?.status === "PENDING" &&
            subscription.checkoutPayment.checkoutUrl ? (
              <Button asChild>
                <a href={subscription.checkoutPayment.checkoutUrl}>Pagar agora</a>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/dashboard/assinaturas">Voltar para assinaturas</Link>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getSubscriptionStatusTone(subscription.status)}>
              {getSubscriptionStatusLabel(subscription.status)}
            </StatusBadge>
            {!subscription.studentProfile.user.isActive ? (
              <StatusBadge tone="danger">Conta inativa</StatusBadge>
            ) : null}
            <StatusBadge tone="info">{subscription.plan.name}</StatusBadge>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Valor liquido</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCurrencyFromCents(
                  Math.max(0, subscription.priceCents - subscription.discountCents),
                )}
              </p>
              <p className="mt-1 text-xs text-brand-gray-light">
                Desconto {formatCurrencyFromCents(subscription.discountCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Renovacao</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {subscription.autoRenew
                  ? `Dia ${subscription.renewalDay ?? "-"}`
                  : "Manual"}
              </p>
              <p className="mt-1 text-xs text-brand-gray-light">
                Vigencia ate {formatDate(subscription.endDate)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Historico</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {subscription._count.payments} pagamento(s)
              </p>
              <p className="mt-1 text-xs text-brand-gray-light">
                Criada por {subscription.createdByUser?.name ?? "sistema"}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">Observacoes</p>
            <p className="mt-3 text-sm text-white">
              {subscription.notes ?? "Sem observacoes registradas para esta assinatura."}
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Acoes rapidas</h2>
          <div className="mt-4 space-y-3">
            {data.canManage && subscription.status !== "CANCELLED" ? (
              <ApiActionButton
                endpoint={`/api/subscriptions/${subscription.id}`}
                method="DELETE"
                label="Cancelar assinatura"
                loadingLabel="Cancelando..."
                variant="danger"
                confirmMessage="Deseja realmente cancelar esta assinatura?"
              />
            ) : null}
            <p className="text-sm text-brand-gray-light">
              Cancelamentos encerram a renovacao automatica e preservam o historico financeiro.
            </p>
          </div>
        </article>
      </section>

      {data.canManage && data.options ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Editar assinatura</h2>
          <p className="mt-1 text-sm text-brand-gray-light">
            Ajuste plano, datas, renovacao e condicoes comerciais.
          </p>
          <div className="mt-6">
            <SubscriptionForm
              mode="edit"
              endpoint={`/api/subscriptions/${subscription.id}`}
              initialValues={{
                id: subscription.id,
                studentProfileId: subscription.studentProfile.id,
                planId: subscription.plan.id,
                status: subscription.status,
                startDate: toDateInputValue(subscription.startDate),
                endDate: toDateInputValue(subscription.endDate),
                renewalDay: subscription.renewalDay?.toString() ?? "",
                autoRenew: subscription.autoRenew,
                price: (subscription.priceCents / 100).toFixed(2),
                discount: (subscription.discountCents / 100).toFixed(2),
                notes: subscription.notes ?? "",
              }}
              options={{
                students: data.options.students.map((student) => ({
                  id: student.id,
                  name: student.user.name,
                  registrationNumber: student.registrationNumber,
                })),
                plans: data.options.plans.map((plan) => ({
                  id: plan.id,
                  name: plan.name,
                  priceCents: plan.priceCents,
                })),
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Historico de pagamentos</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Registros financeiros mais recentes desta assinatura.
            </p>
          </div>
          <StatusBadge tone="neutral">{subscription.payments.length} listados</StatusBadge>
        </div>

        {subscription.payments.length === 0 ? (
          <p className="mt-6 text-sm text-brand-gray-light">
            Ainda nao existem pagamentos registrados para esta assinatura.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {subscription.payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {payment.description ?? "Mensalidade manual"}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray-light">
                      Vence em {formatDate(payment.dueDate)} • {getPaymentMethodLabel(payment.method)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={resolvePaymentTone({
                        status: payment.status,
                        dueDate: payment.dueDate,
                      })}
                    >
                      {getPaymentStatusLabel(payment.status, payment.dueDate)}
                    </StatusBadge>
                    <StatusBadge tone="info">
                      {formatCurrencyFromCents(payment.amountCents)}
                    </StatusBadge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
