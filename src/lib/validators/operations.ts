import {
  AttendanceStatus,
  ExpenseCategory,
  NutritionPlanStatus,
  StudentStatus,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(255).optional(),
);

const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(4000).optional(),
);

const optionalDateString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.")
    .optional(),
);

const optionalInteger = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  },
  z.number().int().optional(),
);

const optionalNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  },
  z.number().optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens.")
  .max(120);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Informe um e-mail valido.");

const phoneSchema = z
  .string()
  .trim()
  .min(8, "Informe um telefone valido.")
  .max(30);

const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no maximo 72 caracteres.");

const studentStatusSchema = z.enum([
  StudentStatus.ACTIVE,
  StudentStatus.SUSPENDED,
  StudentStatus.INACTIVE,
  StudentStatus.TRIAL,
  StudentStatus.PENDING,
]);

const weekdayArraySchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Selecione pelo menos um dia da semana.")
  .max(7)
  .transform((value) => Array.from(new Set(value)).sort((left, right) => left - right));

export const studentFiltersSchema = z.object({
  search: optionalTrimmedString,
  status: z.nativeEnum(StudentStatus).optional(),
  modalityId: optionalTrimmedString,
  teacherId: optionalTrimmedString,
  onlyInactive: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const studentBaseSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  registrationNumber: optionalTrimmedString,
  status: studentStatusSchema.default(StudentStatus.ACTIVE),
  primaryModalityId: optionalTrimmedString,
  responsibleTeacherId: optionalTrimmedString,
  birthDate: optionalDateString,
  cpf: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value.replace(/\D/g, "")
          : value,
      z
        .string()
        .length(11, "Informe um CPF com 11 digitos.")
        .optional(),
    ),
  city: optionalTrimmedString,
  state: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim().length === 0
          ? undefined
          : value,
      z.string().trim().length(2, "Use a sigla do estado.").optional(),
    ),
  joinedAt: optionalDateString,
  beltLevel: optionalTrimmedString,
  weightKg: optionalNumber,
  heightCm: optionalInteger,
  goals: optionalText,
  notes: optionalText,
});

export const createStudentSchema = studentBaseSchema
  .extend({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .superRefine((input, context) => {
    if (input.password !== input.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "As senhas precisam ser iguais.",
      });
    }
  });

export const updateStudentSchema = studentBaseSchema.extend({
  id: z.string().min(1),
});

export const teacherFiltersSchema = z.object({
  search: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  onlyInactive: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const teacherBaseSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  registrationNumber: optionalTrimmedString,
  cpf: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value.replace(/\D/g, "")
          : value,
      z
        .string()
        .length(11, "Informe um CPF com 11 digitos.")
        .optional(),
    ),
  specialties: optionalText,
  experienceYears: optionalInteger,
  hireDate: optionalDateString,
  beltLevel: optionalTrimmedString,
  notes: optionalText,
  modalityIds: z.array(z.string().min(1)).default([]),
  isActive: optionalBoolean.default(true),
});

export const createTeacherSchema = teacherBaseSchema
  .extend({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .superRefine((input, context) => {
    if (input.password !== input.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "As senhas precisam ser iguais.",
      });
    }
  });

export const updateTeacherSchema = teacherBaseSchema.extend({
  id: z.string().min(1),
});

export const modalityFiltersSchema = z.object({
  search: optionalTrimmedString,
  onlyInactive: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

export const createModalitySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da modalidade.").max(80),
  slug: slugSchema.optional(),
  description: optionalText,
  colorHex: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim().length === 0
          ? undefined
          : value,
      z
        .string()
        .trim()
        .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Use um HEX valido.")
        .optional(),
    ),
  sortOrder: optionalInteger.default(0),
  isActive: optionalBoolean.default(true),
});

export const updateModalitySchema = createModalitySchema.extend({
  id: z.string().min(1),
});

export const classScheduleFiltersSchema = z.object({
  search: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  teacherId: optionalTrimmedString,
  dayOfWeek: optionalInteger.refine(
    (value) => value === undefined || (value >= 0 && value <= 6),
    "Dia da semana invalido.",
  ),
  onlyInactive: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const classScheduleBaseSchema = z.object({
  title: z.string().trim().min(3, "Informe o nome da turma.").max(120),
  description: optionalText,
  modalityId: z.string().min(1, "Selecione a modalidade."),
  teacherProfileId: z.string().min(1, "Selecione o professor."),
  daysOfWeek: weekdayArraySchema,
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Informe o horario no formato HH:MM."),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Informe o horario no formato HH:MM."),
  room: optionalTrimmedString,
  capacity: optionalInteger.refine(
    (value) => value === undefined || value > 0,
    "A capacidade deve ser maior que zero.",
  ),
  validFrom: optionalDateString,
  validUntil: optionalDateString,
  isActive: optionalBoolean.default(true),
  studentIds: z.array(z.string().min(1)).default([]),
});

export const createClassScheduleSchema = classScheduleBaseSchema.superRefine(
  (input, context) => {
    if (input.endTime <= input.startTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "O horario final precisa ser maior que o inicial.",
      });
    }

    if (input.capacity && input.studentIds.length > input.capacity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentIds"],
        message: "A quantidade de alunos excede a capacidade informada.",
      });
    }
  },
);

export const updateClassScheduleSchema = classScheduleBaseSchema
  .extend({
    id: z.string().min(1),
  })
  .superRefine((input, context) => {
    if (input.endTime <= input.startTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "O horario final precisa ser maior que o inicial.",
      });
    }

    if (input.capacity && input.studentIds.length > input.capacity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentIds"],
        message: "A quantidade de alunos excede a capacidade informada.",
      });
    }
  });

export const attendanceFiltersSchema = z.object({
  studentId: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  teacherId: optionalTrimmedString,
  classScheduleId: optionalTrimmedString,
  status: z.nativeEnum(AttendanceStatus).optional(),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
});

export const checkInSchema = z.object({
  studentProfileId: z.string().min(1),
  classScheduleId: z.string().min(1),
  classDate: optionalDateString,
  notes: optionalText,
  overrideFinancial: z.boolean().optional().default(false),
});

export const checkOutSchema = z.object({
  attendanceId: z.string().min(1),
  notes: optionalText,
});

const optionalDateTimeString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Informe uma data valida.")
    .optional(),
);

const percentSchema = z
  .number()
  .min(0, "Use um valor entre 0 e 100.")
  .max(100, "Use um valor entre 0 e 100.");

const optionalPercent = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  },
  percentSchema.optional(),
);

const optionalPositiveNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  },
  z.number().positive("Informe um valor positivo.").optional(),
);

const optionalPositiveInteger = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  },
  z.number().int().positive("Informe um valor positivo.").optional(),
);

export const physicalAssessmentFiltersSchema = z.object({
  studentId: z.string().min(1, "Informe o aluno."),
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const physicalAssessmentBaseSchema = z.object({
  studentId: z.string().min(1, "Informe o aluno."),
  assessedAt: optionalDateTimeString,
  weightKg: optionalPositiveNumber,
  heightCm: optionalPositiveInteger,
  bodyFatPercent: optionalPercent,
  muscleMassKg: optionalPositiveNumber,
  chestCm: optionalPositiveNumber,
  waistCm: optionalPositiveNumber,
  hipCm: optionalPositiveNumber,
  leftArmCm: optionalPositiveNumber,
  rightArmCm: optionalPositiveNumber,
  leftThighCm: optionalPositiveNumber,
  rightThighCm: optionalPositiveNumber,
  restingHeartRate: optionalPositiveInteger,
  bloodPressureSystolic: optionalPositiveInteger,
  bloodPressureDiastolic: optionalPositiveInteger,
  notes: optionalText,
});

export const createPhysicalAssessmentSchema = physicalAssessmentBaseSchema;

export const updatePhysicalAssessmentSchema =
  physicalAssessmentBaseSchema.partial({ studentId: true }).extend({
    id: z.string().min(1),
  });

export const qrCheckInSchema = z.object({
  token: z.string().min(1, "Token invalido."),
  classScheduleId: z.string().min(1, "Informe a turma."),
  classDate: optionalDateString,
  overrideFinancial: z.boolean().optional().default(false),
});

export const dreFiltersSchema = z.object({
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
});

export const expenseFiltersSchema = z.object({
  category: z.nativeEnum(ExpenseCategory).optional(),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const expenseBaseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  description: z
    .string()
    .trim()
    .min(1, "Descricao obrigatoria.")
    .max(120, "Descricao muito longa."),
  amountCents: z
    .preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") {
          return undefined;
        }
        if (typeof value === "string") {
          return Number(value);
        }
        return value;
      },
      z.number().int("Informe um valor inteiro.").positive("Valor deve ser positivo."),
    ),
  incurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida."),
  notes: optionalText,
});

export const createExpenseSchema = expenseBaseSchema.refine(
  (input) => input.category !== ExpenseCategory.MP_FEE,
  {
    message: "Despesas da categoria MP_FEE sao automaticas.",
    path: ["category"],
  },
);

export const updateExpenseSchema = expenseBaseSchema
  .partial({
    category: true,
    description: true,
    amountCents: true,
    incurredAt: true,
  })
  .extend({
    id: z.string().min(1),
  })
  .refine((input) => input.category !== ExpenseCategory.MP_FEE, {
    message: "Nao e possivel reclassificar como MP_FEE.",
    path: ["category"],
  });

export const nutritionPlanFiltersSchema = z.object({
  studentId: z.string().min(1, "Informe o aluno."),
  status: z.nativeEnum(NutritionPlanStatus).optional(),
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const nutritionMealSchema = z.object({
  title: z.string().trim().min(1, "Titulo da refeicao obrigatorio.").max(80),
  time: optionalTrimmedString,
  items: z
    .array(z.string().trim().min(1).max(200))
    .max(20, "Maximo de 20 itens por refeicao."),
  notes: optionalText,
});

const nutritionContentSchema = z.object({
  caloriesTarget: optionalInteger.refine(
    (value) => value === undefined || value >= 0,
    "Meta calorica invalida.",
  ),
  objective: optionalText,
  meals: z.array(nutritionMealSchema).max(10, "Maximo de 10 refeicoes."),
});

const nutritionPlanBaseSchema = z.object({
  studentId: z.string().min(1, "Informe o aluno."),
  title: z.string().trim().min(1, "Titulo obrigatorio.").max(120),
  description: optionalText,
  startsAt: optionalDateString,
  endsAt: optionalDateString,
  status: z.nativeEnum(NutritionPlanStatus).default(NutritionPlanStatus.ACTIVE),
  content: nutritionContentSchema,
});

export const createNutritionPlanSchema = nutritionPlanBaseSchema;

export const updateNutritionPlanSchema = nutritionPlanBaseSchema
  .partial({
    studentId: true,
    title: true,
    content: true,
  })
  .extend({
    id: z.string().min(1),
  });
