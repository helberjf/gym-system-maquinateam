import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TeacherForm } from "@/components/dashboard/TeacherForm";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getTeachersIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Novo professor",
  description: "Cadastro operacional de professores.",
};

export default async function NewTeacherPage() {
  const session = await requirePermission(
    "manageTeachers",
    "/dashboard/professores/novo",
  );
  const viewer = await getViewerContextFromSession(session);
  const data = await getTeachersIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Novo professor"
        description="Crie a conta do professor e defina as modalidades que ele esta apto a ensinar."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <TeacherForm
          mode="create"
          endpoint="/api/teachers"
          initialValues={{
            name: "",
            email: "",
            phone: "",
            registrationNumber: "",
            cpf: "",
            specialties: "",
            experienceYears: "",
            hireDate: "",
            beltLevel: "",
            notes: "",
            modalityIds: [],
            isActive: true,
          }}
          options={{
            modalities:
              data.options?.modalities.map((modality) => ({
                id: modality.id,
                name: modality.name,
              })) ?? [],
          }}
        />
      </section>
    </div>
  );
}
