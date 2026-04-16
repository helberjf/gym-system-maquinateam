import {
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
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

const requiredDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.");

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

const currencyField = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return Math.round(value * 100);
    }

    if (typeof value === "string") {
      const normalized = Number(value.replace(",", "."));

      if (Number.isNaN(normalized)) {
        return Number.NaN;
      }

      return Math.round(normalized * 100);
    }

    return value;
  },
  z
    .number()
    .int("Informe um valor monetario valido.")
    .nonnegative("O valor nao pode ser negativo."),
);

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens.")
  .max(120);

const benefitsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string().trim().min(1).max(120)).max(12).default([]));

export const planFiltersSchema = z.object({
  search: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  active: optionalBoolean,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const planBaseSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do plano.").max(120),
  slug: slugSchema.optional(),
  description: optionalText,
  benefits: benefitsSchema,
  modalityId: optionalTrimmedString,
  priceCents: currencyField.refine((value) => value > 0, "Informe um preco maior que zero."),
  billingIntervalMonths: optionalInteger
    .refine((value) => value === undefined || value > 0, "Informe uma recorrencia valida.")
    .default(1),
  durationMonths: optionalInteger.refine(
    (value) => value === undefined || value > 0,
    "Informe uma duracao valida.",
  ),
  sessionsPerWeek: optionalInteger.refine(
    (value) => value === undefined || value > 0,
    "Informe uma quantidade de sessoes valida.",
  ),
  isUnlimited: optionalBoolean.default(false),
  enrollmentFeeCents: currencyField.default(0),
  active: optionalBoolean.default(true),
});

export const createPlanSchema = planBaseSchema;

export const updatePlanSchema = planBaseSchema.extend({
  id: z.string().min(1),
});

export const subscriptionFiltersSchema = z.object({
  search: optionalTrimmedString,
  studentId: optionalTrimmedString,
  planId: optionalTrimmedString,
  status: z.nativeEnum(SubscriptionStatus).optional(),
  autoRenew: optionalBoolean,
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const subscriptionBaseObjectSchema = z.object({
  studentProfileId: z.string().min(1, "Selecione o aluno."),
  planId: z.string().min(1, "Selecione o plano."),
  status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.ACTIVE),
  startDate: requiredDateString,
  endDate: optionalDateString,
  renewalDay: optionalInteger.refine(
    (value) => value === undefined || (value >= 1 && value <= 31),
    "O dia de renovacao deve ficar entre 1 e 31.",
  ),
  autoRenew: optionalBoolean.default(false),
  priceCents: currencyField.optional(),
  discountCents: currencyField.default(0),
  notes: optionalText,
});

function applySubscriptionRefinement<
  TSchema extends z.ZodTypeAny,
>(schema: TSchema) {
  return schema.superRefine((input, context) => {
    if (input.endDate && input.endDate < input.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "A data final nao pode ser anterior ao inicio.",
      });
    }
  });
}

export const createSubscriptionSchema = applySubscriptionRefinement(
  subscriptionBaseObjectSchema,
);

export const updateSubscriptionSchema = applySubscriptionRefinement(
  subscriptionBaseObjectSchema.extend({
    id: z.string().min(1),
  }),
);

export const paymentFiltersSchema = z.object({
  search: optionalTrimmedString,
  studentId: optionalTrimmedString,
  subscriptionId: optionalTrimmedString,
  status: z.enum(["PENDING", "OVERDUE", "PAID", "CANCELLED"]).optional(),
  method: z.enum(["PIX", "CARD", "CASH", "BANK_TRANSFER", "OTHER"]).optional(),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  page: optionalInteger
    .refine((value) => value === undefined || value >= 1, "Pagina invalida.")
    .default(1),
});

const paymentBaseSchema = z.object({
  studentProfileId: z.string().min(1, "Selecione o aluno."),
  subscriptionId: z.string().min(1, "Selecione a assinatura."),
  amountCents: currencyField.refine((value) => value > 0, "Informe um valor maior que zero."),
  status: z
    .enum([PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.CANCELLED])
    .default(PaymentStatus.PENDING),
  method: z
    .enum([
      PaymentMethod.PIX,
      PaymentMethod.CASH,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.BOLETO,
      PaymentMethod.DEBIT_CARD,
    ])
    .default(PaymentMethod.PIX),
  dueDate: requiredDateString,
  paidAt: optionalDateString,
  description: optionalTrimmedString,
  notes: optionalText,
});

export const createPaymentSchema = paymentBaseSchema.superRefine(
  (input, context) => {
    if (input.status === PaymentStatus.PAID && !input.paidAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paidAt"],
        message: "Informe a data de pagamento para registrar como pago.",
      });
    }
  },
);

export const updatePaymentSchema = paymentBaseSchema
  .extend({
    id: z.string().min(1),
  })
  .superRefine((input, context) => {
    if (input.status === PaymentStatus.PAID && !input.paidAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paidAt"],
        message: "Informe a data de pagamento para registrar como pago.",
      });
    }
  });

export const selfServicePlanCheckoutSchema = z.object({
  paymentMethod: z
    .enum([
      PaymentMethod.PIX,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.DEBIT_CARD,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.BOLETO,
    ])
    .default(PaymentMethod.PIX),
});
