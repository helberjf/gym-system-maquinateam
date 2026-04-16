import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getStudentsIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Novo aluno",
  description: "Cadastro operacional de alunos.",
};

export default async function NewStudentPage() {
  const session = await requirePermission("manageStudents", "/dashboard/alunos/novo");
  const viewer = await getViewerContextFromSession(session);
  const data = await getStudentsIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Novo aluno"
        description="Crie o usuario do aluno, defina status inicial e vincule modalidade e professor quando fizer sentido."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <StudentForm
          mode="create"
          endpoint="/api/students"
          initialValues={{
            name: "",
            email: "",
            phone: "",
            registrationNumber: "",
            status: "ACTIVE",
            primaryModalityId: "",
            responsibleTeacherId: "",
            birthDate: "",
            cpf: "",
            city: "",
            state: "",
            joinedAt: new Date().toISOString().slice(0, 10),
            beltLevel: "",
            weightKg: "",
            heightCm: "",
            goals: "",
            notes: "",
          }}
          options={{
            modalities:
              data.options?.modalities.map((modality) => ({
                id: modality.id,
                name: modality.name,
              })) ?? [],
            teachers:
              data.options?.teachers.map((teacher) => ({
                id: teacher.id,
                name: teacher.user.name,
              })) ?? [],
          }}
        />
      </section>
    </div>
  );
}
