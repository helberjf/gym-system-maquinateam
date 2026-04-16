import type { Metadata } from "next";
import { ClassScheduleForm } from "@/components/dashboard/ClassScheduleForm";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getClassSchedulesIndexData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Nova turma",
  description: "Cadastro operacional de turmas e horarios.",
};

export default async function NewClassSchedulePage() {
  const session = await requirePermission(
    "manageClassSchedules",
    "/dashboard/turmas/nova",
  );
  const viewer = await getViewerContextFromSession(session);
  const data = await getClassSchedulesIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Nova turma"
        description="Monte a grade da turma, vincule o professor e selecione os alunos iniciais."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <ClassScheduleForm
          mode="create"
          endpoint="/api/class-schedules"
          initialValues={{
            title: "",
            description: "",
            modalityId: "",
            teacherProfileId: "",
            daysOfWeek: [],
            startTime: "",
            endTime: "",
            room: "",
            capacity: "",
            validFrom: "",
            validUntil: "",
            isActive: true,
            studentIds: [],
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
            students:
              data.options?.students.map((student) => ({
                id: student.id,
                registrationNumber: student.registrationNumber,
                name: student.user.name,
              })) ?? [],
          }}
        />
      </section>
    </div>
  );
}
