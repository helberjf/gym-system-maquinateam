import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { ApiActionButton } from "@/components/dashboard/ApiActionButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PhysicalAssessmentForm } from "@/components/dashboard/PhysicalAssessmentForm";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { listPhysicalAssessments } from "@/lib/academy/assessments";
import { getStudentGamification } from "@/lib/academy/gamification";
import {
  formatDate,
  formatDateTime,
  getAttendanceStatusLabel,
  getStudentStatusLabel,
  getWeekdayLabels,
  toDateInputValue,
} from "@/lib/academy/constants";
import {
  getAttendanceStatusTone,
  getStudentStatusTone,
} from "@/lib/academy/presentation";
import { getStudentDetailData } from "@/lib/academy/service";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Detalhes do aluno",
  description: "Dados, presenca e vinculos do aluno.",
};

type RouteParams = Promise<{ id: string }>;

export default async function StudentDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const session = await requirePermission("viewStudents", "/dashboard/alunos");
  const viewer = await getViewerContextFromSession(session);
  const { id } = await params;
  const data = await getStudentDetailData(viewer, id);
  const { student } = data;

  const canViewAssessments = hasPermission(
    viewer.role,
    "viewPhysicalAssessments",
  );
  const canManageAssessments = hasPermission(
    viewer.role,
    "managePhysicalAssessments",
  );
  const assessmentsData = canViewAssessments
    ? await listPhysicalAssessments({ studentId: student.id, page: 1 }, viewer)
    : null;

  const canViewGamification = hasPermission(viewer.role, "viewGamification");
  const gamification = canViewGamification
    ? await getStudentGamification(student.id, viewer)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Aluno"
        title={student.user.name}
        description={`Matricula ${student.registrationNumber} com acompanhamento operacional e historico recente.`}
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/alunos">Voltar para alunos</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getStudentStatusTone(student.status)}>
              {getStudentStatusLabel(student.status)}
            </StatusBadge>
            {student.user.isActive ? (
              <StatusBadge tone="success">Conta ativa</StatusBadge>
            ) : (
              <StatusBadge tone="danger">Conta inativa</StatusBadge>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Contato
              </p>
              <p className="mt-3 text-sm text-white">{student.user.email}</p>
              <p className="mt-1 text-sm text-brand-gray-light">
                {student.user.phone ?? "Sem telefone cadastrado"}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Perfil
              </p>
              <p className="mt-3 text-sm text-white">
                Modalidade principal: {student.primaryModality?.name ?? "Nao definida"}
              </p>
              <p className="mt-1 text-sm text-white">
                Professor responsavel: {student.responsibleTeacher?.user.name ?? "Nao definido"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Acoes rapidas</h2>
          <div className="mt-4 space-y-3">
            {data.canManage ? (
              <ApiActionButton
                endpoint={`/api/students/${student.id}`}
                method="DELETE"
                label="Inativar aluno"
                loadingLabel="Inativando..."
                variant="danger"
                confirmMessage="Deseja realmente inativar este aluno?"
              />
            ) : null}
            <p className="text-sm text-brand-gray-light">
              O aluno pode ser reativado pelo proprio formulario, alterando o status e salvando novamente.
            </p>
          </div>
        </article>
      </section>

      {gamification ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">Jornada do aluno</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Pontos, nivel e conquistas acumuladas no programa.
              </p>
            </div>
            <StatusBadge tone="success">
              Nivel {gamification.level.level}
            </StatusBadge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Pontos totais
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {gamification.profile.totalPoints}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Streak atual
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {gamification.profile.currentStreak} dias
              </p>
              <p className="mt-1 text-xs text-brand-gray-light">
                Melhor: {gamification.profile.longestStreak} dias
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Check-ins
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {gamification.profile.checkinCount}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                Avaliacoes
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {gamification.profile.assessmentCount}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
            <div className="flex items-center justify-between text-xs text-brand-gray-light">
              <span>Progresso para o proximo nivel</span>
              <span>
                {gamification.level.pointsForNextLevel === null
                  ? "Nivel maximo"
                  : `${gamification.level.pointsIntoLevel}/${gamification.level.pointsForNextLevel}`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-gray-mid/40">
              <div
                className="h-full rounded-full bg-brand-red"
                style={{ width: `${gamification.level.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Conquistas</h3>
              {gamification.earnedBadges.length === 0 ? (
                <p className="mt-2 text-xs text-brand-gray-light">
                  Ainda sem conquistas. Registre presenca e avaliacoes para desbloquear.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {gamification.earnedBadges.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-full border border-brand-gray-mid bg-brand-black/40 px-3 py-1.5 text-xs text-white"
                      title={entry.badge.description}
                    >
                      {entry.badge.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">Historico recente</h3>
              {gamification.recentEvents.length === 0 ? (
                <p className="mt-2 text-xs text-brand-gray-light">
                  Nenhum evento de pontos ainda.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-xs text-brand-gray-light">
                  {gamification.recentEvents.map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-2">
                      <span>
                        {formatDate(event.createdAt)} • {event.reason ?? event.action}
                      </span>
                      <span className="font-semibold text-white">+{event.points}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {data.canManage && data.options ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Editar dados</h2>
          <p className="mt-1 text-sm text-brand-gray-light">
            Ajuste o perfil, status e referencias principais do aluno.
          </p>
          <div className="mt-6">
            <StudentForm
              mode="edit"
              endpoint={`/api/students/${student.id}`}
              initialValues={{
                id: student.id,
                name: student.user.name,
                email: student.user.email,
                phone: student.user.phone ?? "",
                registrationNumber: student.registrationNumber,
                status: student.status,
                primaryModalityId: student.primaryModalityId ?? "",
                responsibleTeacherId: student.responsibleTeacherId ?? "",
                birthDate: toDateInputValue(student.birthDate),
                cpf: student.cpf ?? "",
                city: student.city ?? "",
                state: student.state ?? "",
                joinedAt: toDateInputValue(student.joinedAt),
                beltLevel: student.beltLevel ?? "",
                weightKg: student.weightKg?.toString() ?? "",
                heightCm: student.heightCm?.toString() ?? "",
                goals: student.goals ?? "",
                notes: student.notes ?? "",
              }}
              options={{
                modalities: data.options.modalities.map((modality) => ({
                  id: modality.id,
                  name: modality.name,
                })),
                teachers: data.options.teachers.map((teacher) => ({
                  id: teacher.id,
                  name: teacher.user.name,
                })),
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Turmas vinculadas</h2>
          {student.enrollments.length === 0 ? (
            <p className="mt-4 text-sm text-brand-gray-light">
              Nenhuma turma registrada para este aluno.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {student.enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {enrollment.classSchedule.title}
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {enrollment.classSchedule.modality.name} • {getWeekdayLabels(
                          enrollment.classSchedule.daysOfWeek.length > 0
                            ? enrollment.classSchedule.daysOfWeek
                            : [enrollment.classSchedule.dayOfWeek],
                        ).join(", ")} • {enrollment.classSchedule.startTime} - {enrollment.classSchedule.endTime}
                      </p>
                    </div>
                    <StatusBadge tone={enrollment.isActive ? "success" : "neutral"}>
                      {enrollment.isActive ? "Ativa" : "Encerrada"}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
          <h2 className="text-xl font-bold text-white">Presenca recente</h2>
          {student.attendances.length === 0 ? (
            <p className="mt-4 text-sm text-brand-gray-light">
              Ainda nao existem registros de presenca para este aluno.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {student.attendances.map((attendance) => (
                <div
                  key={attendance.id}
                  className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {attendance.classSchedule.title}
                      </p>
                      <p className="mt-1 text-xs text-brand-gray-light">
                        {formatDate(attendance.classDate)} • {attendance.classSchedule.modality.name}
                      </p>
                    </div>
                    <StatusBadge tone={getAttendanceStatusTone(attendance.status)}>
                      {getAttendanceStatusLabel(attendance.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-xs text-brand-gray-light">
                    Check-in: {formatDateTime(attendance.checkedInAt)} • Check-out: {formatDateTime(attendance.checkedOutAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {assessmentsData ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-white">Avaliacoes fisicas</h2>
              <p className="text-xs text-brand-gray-light">
                {assessmentsData.pagination.totalItems} registradas
              </p>
            </div>
            {assessmentsData.items.length === 0 ? (
              <p className="mt-4 text-sm text-brand-gray-light">
                Nenhuma avaliacao fisica registrada ainda.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {assessmentsData.items.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {formatDateTime(assessment.assessedAt)}
                      </p>
                      <p className="text-xs text-brand-gray-light">
                        {assessment.assessedBy?.user.name ?? "Autoavaliacao"}
                      </p>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-brand-gray-light sm:grid-cols-3">
                      {assessment.weightKg !== null ? (
                        <div>
                          <dt>Peso</dt>
                          <dd className="text-sm text-white">
                            {assessment.weightKg} kg
                          </dd>
                        </div>
                      ) : null}
                      {assessment.heightCm !== null ? (
                        <div>
                          <dt>Altura</dt>
                          <dd className="text-sm text-white">
                            {assessment.heightCm} cm
                          </dd>
                        </div>
                      ) : null}
                      {assessment.bodyFatPercent !== null ? (
                        <div>
                          <dt>% gordura</dt>
                          <dd className="text-sm text-white">
                            {assessment.bodyFatPercent}%
                          </dd>
                        </div>
                      ) : null}
                      {assessment.muscleMassKg !== null ? (
                        <div>
                          <dt>Massa magra</dt>
                          <dd className="text-sm text-white">
                            {assessment.muscleMassKg} kg
                          </dd>
                        </div>
                      ) : null}
                      {assessment.waistCm !== null ? (
                        <div>
                          <dt>Cintura</dt>
                          <dd className="text-sm text-white">
                            {assessment.waistCm} cm
                          </dd>
                        </div>
                      ) : null}
                      {assessment.restingHeartRate !== null ? (
                        <div>
                          <dt>FC repouso</dt>
                          <dd className="text-sm text-white">
                            {assessment.restingHeartRate} bpm
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {assessment.notes ? (
                      <p className="mt-3 whitespace-pre-line text-xs text-brand-gray-light">
                        {assessment.notes}
                      </p>
                    ) : null}
                    {canManageAssessments ? (
                      <div className="mt-3 flex justify-end">
                        <ApiActionButton
                          endpoint={`/api/physical-assessments/${assessment.id}`}
                          method="DELETE"
                          label="Remover"
                          loadingLabel="Removendo..."
                          variant="ghost"
                          size="sm"
                          confirmMessage="Deseja remover esta avaliacao?"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>

          {canManageAssessments ? (
            <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
              <h2 className="text-xl font-bold text-white">Nova avaliacao fisica</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Registre medidas, composicao corporal e observacoes do acompanhamento.
              </p>
              <div className="mt-6">
                <PhysicalAssessmentForm studentId={student.id} />
              </div>
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
