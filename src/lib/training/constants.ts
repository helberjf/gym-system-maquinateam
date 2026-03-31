import { TrainingAssignmentStatus, UserRole } from "@prisma/client";

export type NormalizedTrainingStructure = {
  aquecimento: string[];
  blocoTecnico: string[];
  blocoFisico: string[];
  desaquecimento: string[];
  rounds: string | null;
  series: string | null;
  repeticoes: string | null;
  tempo: string | null;
  observacoes: string | null;
};

export type NormalizedTrainingMetadata = {
  objective: string | null;
  observacoesProfessor: string | null;
};

export const TRAINING_ASSIGNMENT_STATUS_LABEL_MAP: Record<
  TrainingAssignmentStatus,
  string
> = {
  ASSIGNED: "Atribuido",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluido",
  MISSED: "Nao realizado",
  CANCELLED: "Cancelado",
};

export function getTrainingAssignmentStatusLabel(
  status: TrainingAssignmentStatus,
) {
  return TRAINING_ASSIGNMENT_STATUS_LABEL_MAP[status] ?? status;
}

export function getAnnouncementTargetLabel(targetRole?: UserRole | null) {
  switch (targetRole) {
    case UserRole.ADMIN:
      return "Administracao";
    case UserRole.RECEPCAO:
      return "Recepcao";
    case UserRole.PROFESSOR:
      return "Professores";
    case UserRole.ALUNO:
      return "Alunos";
    default:
      return "Todos";
  }
}

export function splitTextareaLines(value?: string | null) {
  return value
    ?.split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function normalizeUnknownLines(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return splitTextareaLines(value);
  }

  return [];
}

function normalizeUnknownString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function buildTrainingStructure(input: {
  aquecimento?: string | null;
  blocoTecnico?: string | null;
  blocoFisico?: string | null;
  desaquecimento?: string | null;
  rounds?: string | null;
  series?: string | null;
  repeticoes?: string | null;
  tempo?: string | null;
  observacoes?: string | null;
}) {
  return {
    aquecimento: splitTextareaLines(input.aquecimento),
    blocoTecnico: splitTextareaLines(input.blocoTecnico),
    blocoFisico: splitTextareaLines(input.blocoFisico),
    desaquecimento: splitTextareaLines(input.desaquecimento),
    rounds: normalizeUnknownString(input.rounds),
    series: normalizeUnknownString(input.series),
    repeticoes: normalizeUnknownString(input.repeticoes),
    tempo: normalizeUnknownString(input.tempo),
    observacoes: normalizeUnknownString(input.observacoes),
  } satisfies NormalizedTrainingStructure;
}

export function extractTrainingStructure(content: unknown): NormalizedTrainingStructure {
  const source =
    content && typeof content === "object"
      ? (content as Record<string, unknown>)
      : {};

  return {
    aquecimento: normalizeUnknownLines(source.aquecimento),
    blocoTecnico: normalizeUnknownLines(source.blocoTecnico ?? source.tecnica),
    blocoFisico: normalizeUnknownLines(
      source.blocoFisico ??
        source.condicionamento ??
        source.circuito ??
        source.finalizacao,
    ),
    desaquecimento: normalizeUnknownLines(source.desaquecimento),
    rounds: normalizeUnknownString(source.rounds),
    series: normalizeUnknownString(source.series),
    repeticoes: normalizeUnknownString(source.repeticoes),
    tempo: normalizeUnknownString(source.tempo),
    observacoes: normalizeUnknownString(source.observacoes),
  };
}

export function extractTrainingMetadata(content: unknown): NormalizedTrainingMetadata {
  const source =
    content && typeof content === "object"
      ? (content as Record<string, unknown>)
      : {};

  return {
    objective: normalizeUnknownString(source.objective ?? source.objetivo),
    observacoesProfessor: normalizeUnknownString(
      source.observacoesProfessor ?? source.professorNotes,
    ),
  };
}

export function countFilledTrainingBlocks(structure: NormalizedTrainingStructure) {
  return [
    structure.aquecimento.length,
    structure.blocoTecnico.length,
    structure.blocoFisico.length,
    structure.desaquecimento.length,
    structure.rounds ? 1 : 0,
    structure.series ? 1 : 0,
    structure.repeticoes ? 1 : 0,
    structure.tempo ? 1 : 0,
    structure.observacoes ? 1 : 0,
  ].reduce((total, current) => total + current, 0);
}
