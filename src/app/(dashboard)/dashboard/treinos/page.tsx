import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { formatDate } from "@/lib/academy/constants";
import { flattenSearchParams } from "@/lib/academy/presentation";
import { requirePermission } from "@/lib/auth/guards";
import {
  getTrainingAssignmentStatusLabel,
} from "@/lib/training/constants";
import { getTrainingAssignmentTone } from "@/lib/training/presentation";
import { getTrainingHubData } from "@/lib/training/service";
import {
  parseSearchParams,
  trainingAssignmentFiltersSchema,
  trainingTemplateFiltersSchema,
} from "@/lib/validators";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Treinos",
  description: "Modelos, atribuicoes e historico de treinos da academia.",
};

export default async function TrainingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePermission("viewTrainings", "/dashboard/treinos");
  const viewer = await getViewerContextFromSession(session);
  const rawSearchParams = flattenSearchParams(await searchParams);
  const templateFilters = parseSearchParams(
    {
      search: rawSearchParams.templateSearch,
      modalityId: rawSearchParams.templateModalityId,
      level: rawSearchParams.templateLevel,
      onlyInactive: rawSearchParams.templateOnlyInactive,
    },
    trainingTemplateFiltersSchema,
  );
  const assignmentFilters = parseSearchParams(
    {
      search: rawSearchParams.assignmentSearch,
      studentId: rawSearchParams.studentId,
      teacherId: rawSearchParams.teacherId,
      modalityId: rawSearchParams.assignmentModalityId,
      status: rawSearchParams.status,
      level: rawSearchParams.assignmentLevel,
    },
    trainingAssignmentFiltersSchema,
  );
  const data = await getTrainingHubData(viewer, {
    templateFilters,
    assignmentFilters,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treinos"
        title={data.canManage ? "Modelos e atribuicoes" : "Meus treinos"}
        description={
          data.canManage
            ? "Monte modelos reutilizaveis por modalidade, atribua treinos em escala e acompanhe a execucao dos alunos."
            : "Acompanhe seus treinos atribuidos, historico recente e orientacoes dos professores."
        }
        action={
          data.canManage ? (
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/dashboard/treinos/atribuicoes/nova">Nova atribuicao</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/treinos/modelos/novo">Novo modelo</Link>
              </Button>
            </div>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Modelos visiveis"
          value={data.summary.templateCount}
          note="Total carregado com os filtros atuais."
        />
        <MetricCard
          label="Modelos ativos"
          value={data.summary.activeTemplateCount}
          note="Prontos para novas atribuicoes."
        />
        <MetricCard
          label="Treinos em andamento"
          value={data.summary.assignedCount}
          note="Aguardando leitura, execucao ou feedback."
        />
        <MetricCard
          label="Treinos concluidos"
          value={data.summary.completedCount}
          note="Historico finalizado dentro do recorte atual."
        />
      </section>

      {data.canManage ? (
        <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
          <h2 className="text-lg font-bold text-white">Filtrar modelos</h2>
          <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <input
              name="templateSearch"
              placeholder="Titulo, descricao ou objetivo"
              defaultValue={templateFilters.search ?? ""}
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            />
            <select
              name="templateModalityId"
              defaultValue={templateFilters.modalityId ?? ""}
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              <option value="">Todas as modalidades</option>
              {data.options.modalities.map((modality) => (
                <option key={modality.id} value={modality.id}>
                  {modality.name}
                </option>
              ))}
            </select>
            <select
              name="templateLevel"
              defaultValue={templateFilters.level ?? ""}
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              <option value="">Todos os niveis</option>
              {data.options.levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <select
              name="templateOnlyInactive"
              defaultValue={templateFilters.onlyInactive ? "true" : ""}
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              <option value="">Todos os status</option>
              <option value="true">Somente inativos</option>
            </select>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="secondary" className="w-full">
                Filtrar
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/dashboard/treinos">Limpar</Link>
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {data.canManage ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Modelos de treino</h2>
              <p className="mt-1 text-sm text-brand-gray-light">
                Biblioteca reutilizavel por modalidade, nivel e professor.
              </p>
            </div>
            <StatusBadge tone="neutral">{data.templates.length} modelo(s)</StatusBadge>
          </div>

          {data.templates.length === 0 ? (
            <EmptyState
              title="Nenhum modelo encontrado"
              description="Ajuste os filtros ou crie um novo modelo de treino para a academia."
              actionLabel="Criar modelo"
              actionHref="/dashboard/treinos/modelos/novo"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {data.templates.map((template) => (
                <article
                  key={template.id}
                  className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-white">{template.name}</h2>
                        <StatusBadge tone={template.isActive ? "success" : "neutral"}>
                          {template.isActive ? "Ativo" : "Inativo"}
                        </StatusBadge>
                        {template.modality ? (
                          <StatusBadge tone="info">{template.modality.name}</StatusBadge>
                        ) : null}
                        {template.level ? (
                          <StatusBadge tone="neutral">{template.level}</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-brand-gray-light">
                        {template.description ?? "Sem contexto adicional cadastrado."}
                      </p>
                      <p className="mt-2 text-xs text-brand-gray-light">
                        Professor{" "}
                        {template.teacherProfile?.user.name ?? "biblioteca compartilhada"} •{" "}
                        {template._count.assignments} atribuicao(oes)
                      </p>
                    </div>

                    <Button asChild variant="secondary">
                      <Link href={`/dashboard/treinos/modelos/${template.id}`}>
                        Ver detalhes
                      </Link>
                    </Button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Objetivo
                    </p>
                    <p className="mt-3 text-sm text-white">
                      {template.objective ?? "Sem objetivo especificado."}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5">
        <h2 className="text-lg font-bold text-white">Filtrar atribuicoes</h2>
        <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            name="assignmentSearch"
            placeholder="Titulo, instrucoes ou aluno"
            defaultValue={assignmentFilters.search ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          />
          {data.canManage ? (
            <select
              name="studentId"
              defaultValue={assignmentFilters.studentId ?? ""}
              className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
            >
              <option value="">Todos os alunos</option>
              {data.options.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.user.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            name="assignmentModalityId"
            defaultValue={assignmentFilters.modalityId ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todas as modalidades</option>
            {data.options.modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
          <select
            name="assignmentLevel"
            defaultValue={assignmentFilters.level ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os niveis</option>
            {data.options.levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={assignmentFilters.status ?? ""}
            className="rounded-xl border border-brand-gray-mid bg-brand-black px-4 py-3 text-sm text-white outline-none transition focus:border-brand-red"
          >
            <option value="">Todos os status</option>
            <option value="ASSIGNED">Atribuido</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluido</option>
            <option value="MISSED">Nao realizado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" className="w-full">
              Filtrar
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/dashboard/treinos">Limpar</Link>
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              {data.canManage ? "Treinos em andamento" : "Treinos atribuidos"}
            </h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Itens que ainda dependem de execucao, leitura ou acompanhamento.
            </p>
          </div>
          <StatusBadge tone="info">{data.activeAssignments.length} ativo(s)</StatusBadge>
        </div>

        {data.activeAssignments.length === 0 ? (
          <EmptyState
            title="Nenhum treino ativo"
            description={
              data.canManage
                ? "Nao ha atribuicoes abertas neste recorte."
                : "Nenhum treino ativo foi atribuido ao seu perfil."
            }
          />
        ) : (
          <div className="space-y-4">
            {data.activeAssignments.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{assignment.title}</h2>
                      <StatusBadge tone={getTrainingAssignmentTone(assignment.status)}>
                        {getTrainingAssignmentStatusLabel(assignment.status)}
                      </StatusBadge>
                      {assignment.trainingTemplate?.modality ? (
                        <StatusBadge tone="info">
                          {assignment.trainingTemplate.modality.name}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-brand-gray-light">
                      {assignment.instructions ?? "Sem instrucoes adicionais cadastradas."}
                    </p>
                    <p className="mt-2 text-xs text-brand-gray-light">
                      {data.canManage ? assignment.studentProfile.user.name : "Atribuido"} •{" "}
                      {assignment.teacherProfile?.user.name ?? "equipe"} •{" "}
                      {assignment.trainingTemplate?.name ?? "treino livre"}
                    </p>
                  </div>

                  <Button asChild variant="secondary">
                    <Link href={`/dashboard/treinos/atribuicoes/${assignment.id}`}>
                      Ver treino
                    </Link>
                  </Button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Atribuido em
                    </p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {formatDate(assignment.assignedAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Validade
                    </p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {formatDate(assignment.dueAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-gray-light">
                      Nivel
                    </p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {assignment.trainingTemplate?.level ?? "Nao informado"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Historico de treinos</h2>
            <p className="mt-1 text-sm text-brand-gray-light">
              Registros concluidos, cancelados ou nao realizados.
            </p>
          </div>
          <StatusBadge tone="neutral">{data.historyAssignments.length} registro(s)</StatusBadge>
        </div>

        {data.historyAssignments.length === 0 ? (
          <EmptyState
            title="Sem historico por enquanto"
            description="Quando os treinos forem finalizados, eles aparecerao aqui."
          />
        ) : (
          <div className="space-y-4">
            {data.historyAssignments.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{assignment.title}</h2>
                      <StatusBadge tone={getTrainingAssignmentTone(assignment.status)}>
                        {getTrainingAssignmentStatusLabel(assignment.status)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-brand-gray-light">
                      {assignment.feedback ??
                        assignment.studentNotes ??
                        "Sem observacoes adicionais registradas."}
                    </p>
                  </div>

                  <Button asChild variant="secondary">
                    <Link href={`/dashboard/treinos/atribuicoes/${assignment.id}`}>
                      Abrir historico
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
