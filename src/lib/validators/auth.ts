import { z } from "zod";
import {
  formatStateUf,
  formatZipCodeBR,
  onlyDigits,
} from "@/lib/utils/formatters";
import { validateCpf } from "@/lib/validators/validateCpf";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Informe um e-mail valido.");

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .regex(/[a-z]/, "A senha deve ter ao menos uma letra minuscula.")
  .regex(/[A-Z]/, "A senha deve ter ao menos uma letra maiuscula.")
  .regex(/[0-9]/, "A senha deve ter ao menos um numero.");

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional(),
);

const optionalDateString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.")
    .optional(),
);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Informe seu nome completo.")
      .max(120, "Nome muito longo."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
    cpf: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }

        const digits = onlyDigits(value);
        return digits.length > 0 ? digits : undefined;
      },
      z
        .string()
        .length(11, "Informe um CPF com 11 digitos.")
        .refine(validateCpf, "Informe um CPF valido.")
        .optional(),
    ),
    phone: optionalTrimmedString.refine(
      (value) => value === undefined || value.length >= 8,
      "Informe um telefone valido.",
    ),
    birthDate: optionalDateString,
    zipCode: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }

        const digits = onlyDigits(formatZipCodeBR(value));
        return digits.length > 0 ? digits : undefined;
      },
      z
        .string()
        .length(8, "Informe um CEP com 8 digitos.")
        .optional(),
    ),
    street: optionalTrimmedString.refine(
      (value) => value === undefined || value.length <= 160,
      "Rua muito longa.",
    ),
    number: optionalTrimmedString.refine(
      (value) => value === undefined || value.length <= 20,
      "Numero muito longo.",
    ),
    complement: optionalTrimmedString.refine(
      (value) => value === undefined || value.length <= 120,
      "Complemento muito longo.",
    ),
    district: optionalTrimmedString.refine(
      (value) => value === undefined || value.length <= 120,
      "Bairro muito longo.",
    ),
    city: optionalTrimmedString.refine(
      (value) => value === undefined || value.length <= 120,
      "Cidade muito longa.",
    ),
    state: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return value;
        }

        const formatted = formatStateUf(value);
        return formatted.length > 0 ? formatted : undefined;
      },
      z.string().length(2, "Use a sigla do estado.").optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "As senhas nao coincidem.",
      });
    }

    const hasAddressField = Boolean(
      data.zipCode ||
        data.street ||
        data.number ||
        data.complement ||
        data.district ||
        data.city ||
        data.state,
    );

    if (hasAddressField) {
      if (!data.zipCode) {
        ctx.addIssue({
          code: "custom",
          path: ["zipCode"],
          message: "Informe um CEP valido.",
        });
      }

      if (!data.street) {
        ctx.addIssue({
          code: "custom",
          path: ["street"],
          message: "Informe a rua.",
        });
      }

      if (!data.number) {
        ctx.addIssue({
          code: "custom",
          path: ["number"],
          message: "Informe o numero.",
        });
      }

      if (!data.district) {
        ctx.addIssue({
          code: "custom",
          path: ["district"],
          message: "Informe o bairro.",
        });
      }

      if (!data.city) {
        ctx.addIssue({
          code: "custom",
          path: ["city"],
          message: "Informe a cidade.",
        });
      }

      if (!data.state) {
        ctx.addIssue({
          code: "custom",
          path: ["state"],
          message: "Informe o estado.",
        });
      }
    }
  });

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token invalido."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "As senhas nao coincidem.",
      });
    }
  });

export const guestPlanCheckoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(120, "Nome muito longo."),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .min(8, "Informe um telefone com DDD.")
    .max(20, "Telefone muito longo."),
  cpf: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const digits = onlyDigits(value);
      return digits.length > 0 ? digits : undefined;
    },
    z
      .string()
      .length(11, "Informe um CPF com 11 digitos.")
      .refine(validateCpf, "Informe um CPF valido."),
  ),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"]),
});

export type GuestPlanCheckoutInput = z.infer<typeof guestPlanCheckoutSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResendVerificationInput = z.infer<
  typeof resendVerificationSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
