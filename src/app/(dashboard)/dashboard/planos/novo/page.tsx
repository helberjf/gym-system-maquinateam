import type { Metadata } from "next";
import { PlanForm } from "@/components/dashboard/PlanForm";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getPlansIndexData } from "@/lib/billing/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Novo plano",
  description: "Cadastro financeiro de planos.",
};

export default async function NewPlanPage() {
  const session = await requirePermission("managePlans", "/dashboard/planos/novo");
  const viewer = await getViewerContextFromSession(session);
  const data = await getPlansIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Novo plano"
        description="Defina o produto principal da academia com recorrencia, beneficios e regras comerciais."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <PlanForm
          mode="create"
          endpoint="/api/plans"
          initialValues={{
            name: "",
            slug: "",
            description: "",
            benefits: "",
            modalityId: "",
            price: "",
            billingIntervalMonths: "1",
            durationMonths: "",
            sessionsPerWeek: "",
            enrollmentFee: "0",
            isUnlimited: false,
            active: true,
          }}
          options={data.options}
        />
      </section>
    </div>
  );
}
