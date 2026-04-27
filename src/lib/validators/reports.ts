import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().max(255).optional(),
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

const reportFiltersBaseSchema = z.object({
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  studentId: optionalTrimmedString,
  modalityId: optionalTrimmedString,
  teacherId: optionalTrimmedString,
});

function validateReportDateRange(
  input: {
    dateFrom?: string;
    dateTo?: string;
  },
  context: z.RefinementCtx,
) {
  if (input.dateFrom && input.dateTo && input.dateTo < input.dateFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateTo"],
      message: "A data final nao pode ser anterior a data inicial.",
    });
  }
}

export const reportFiltersSchema = reportFiltersBaseSchema.superRefine(
  validateReportDateRange,
);

export const reportExportKindSchema = z.enum([
  "attendance",
  "payments",
  "delinquency",
  "sales",
  "low-stock",
]);

export const reportExportFormatSchema = z.enum(["csv", "xlsx", "pdf"]);

export const reportExportQuerySchema = reportFiltersBaseSchema
  .extend({
    kind: reportExportKindSchema,
    format: reportExportFormatSchema.default("csv"),
  })
  .superRefine(validateReportDateRange);

export const dreExportQuerySchema = reportFiltersBaseSchema
  .pick({
    dateFrom: true,
    dateTo: true,
  })
  .extend({
    format: reportExportFormatSchema.default("csv"),
  })
  .superRefine(validateReportDateRange);
