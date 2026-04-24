import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { NutritionPlanForm } from "@/components/dashboard/NutritionPlanForm";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { requirePermission } from "@/lib/auth/guards";
import { listNutritionPlans } from "@/lib/nutrition/service";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type RouteParams = { id: string };

export const metadata: Metadata = {
  title: "Plano alimentar do aluno",
  description: "Registro e historico de planos alimentares.",
};

export const dynamic = "force-dynamic";

export default async function StudentNutritionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const session = await requirePermission("viewNutritionPlans");
  const viewer = await getViewerContextFromSession(session);

  const student = await prisma.studentProfile.findUnique({
    where: { id },
    select: {
      id: true,
      user: { select: { name: true } },
    },
  });

  if (!student) {
    notFound();
  }

  const canManage = hasPermission(viewer.role, "manageNutritionPlans");
  const { items } = await listNutritionPlans(
    { studentId: id, page: 1 },
    viewer,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plano alimentar"
        title={student.user.name}
        description="Historico e registro de planos alimentares do aluno."
      />

      {canManage ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-lg font-bold text-white">Novo plano alimentar</h2>
          <p className="mt-1 text-sm text-brand-gray-light">
            Ao salvar, o aluno recebe uma notificacao no WhatsApp (se estiver
            habilitado).
          </p>
          <div className="mt-5">
            <NutritionPlanForm studentId={id} />
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <h2 className="text-lg font-bold text-white">Historico</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-brand-gray-light">
            Nenhum plano alimentar registrado ainda.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-gray-mid text-sm">
            {items.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold text-white">{plan.title}</p>
                  <p className="text-xs text-brand-gray-light">
                    {plan.createdAt.toISOString().slice(0, 10)}
                    {plan.createdByUser
                      ? ` - por ${plan.createdByUser.name}`
                      : ""}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-widest text-brand-gray-light">
                  {plan.status === "ACTIVE" ? "Ativo" : "Arquivado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
