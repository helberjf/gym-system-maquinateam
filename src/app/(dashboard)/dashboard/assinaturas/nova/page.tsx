import type { Metadata } from "next";
import { SubscriptionForm } from "@/components/dashboard/SubscriptionForm";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getSubscriptionsIndexData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Nova assinatura",
  description: "Cadastro financeiro de assinaturas.",
};

export default async function NewSubscriptionPage() {
  const session = await requirePermission(
    "manageSubscriptions",
    "/dashboard/assinaturas/nova",
  );
  const viewer = await getViewerContextFromSession(session);
  const data = await getSubscriptionsIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Nova assinatura"
        description="Vincule um aluno a um plano, configure renovacao e defina os dados comerciais principais."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <SubscriptionForm
          mode="create"
          endpoint="/api/subscriptions"
          initialValues={{
            studentProfileId: "",
            planId: "",
            status: "ACTIVE",
            startDate: "",
            endDate: "",
            renewalDay: "",
            autoRenew: false,
            price: "",
            discount: "0",
            notes: "",
          }}
          options={{
            students:
              data.options?.students.map((student) => ({
                id: student.id,
                name: student.user.name,
                registrationNumber: student.registrationNumber,
              })) ?? [],
            plans:
              data.options?.plans.map((plan) => ({
                id: plan.id,
                name: plan.name,
                priceCents: plan.priceCents,
              })) ?? [],
          }}
        />
      </section>
    </div>
  );
}
