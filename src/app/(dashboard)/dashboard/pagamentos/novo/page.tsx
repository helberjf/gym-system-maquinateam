import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaymentForm } from "@/components/dashboard/PaymentForm";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getPaymentsIndexData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Novo pagamento",
  description: "Cadastro financeiro de mensalidades.",
};

export default async function NewPaymentPage() {
  const session = await requirePermission(
    "managePayments",
    "/dashboard/pagamentos/novo",
  );
  const viewer = await getViewerContextFromSession(session);
  const data = await getPaymentsIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Novo pagamento"
        description="Registre vencimentos manuais, pagamentos avulsos e cobrancas associadas a assinaturas."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <PaymentForm
          mode="create"
          endpoint="/api/payments"
          initialValues={{
            studentProfileId: "",
            subscriptionId: "",
            amount: "",
            status: "PENDING",
            method: "PIX",
            dueDate: "",
            paidAt: "",
            description: "",
            notes: "",
          }}
          options={{
            students:
              data.options?.students.map((student) => ({
                id: student.id,
                name: student.user.name,
                registrationNumber: student.registrationNumber,
              })) ?? [],
            subscriptions:
              data.options?.subscriptions.map((subscription) => ({
                id: subscription.id,
                studentProfileId: subscription.studentProfileId,
                studentName: subscription.studentProfile.user.name,
                registrationNumber: subscription.studentProfile.registrationNumber,
                planName: subscription.plan.name,
                status: subscription.status,
              })) ?? [],
          }}
        />
      </section>
    </div>
  );
}
