import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    z.string().trim().max(max).optional(),
  );

export const brandConfigSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slogan: optionalTrimmed(200),
  instructor: optionalTrimmed(200),
  contact: z
    .object({
      phone: optionalTrimmed(40),
      whatsapp: optionalTrimmed(40),
      email: z.preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.string().trim().email().max(200).optional(),
      ),
      instagram: optionalTrimmed(80),
      instagramUrl: optionalTrimmed(300),
      whatsappUrl: optionalTrimmed(500),
    })
    .partial()
    .optional(),
  address: z
    .object({
      street: optionalTrimmed(200),
      city: optionalTrimmed(120),
      cep: optionalTrimmed(15),
      full: optionalTrimmed(300),
    })
    .partial()
    .optional(),
  hours: z
    .object({
      weekdays: optionalTrimmed(80),
      weekend: optionalTrimmed(80),
      label: optionalTrimmed(120),
    })
    .partial()
    .optional(),
  cancellationPolicy: optionalTrimmed(2000),
});

export const updateBrandConfigSchema = brandConfigSchema;

export type BrandConfigInput = z.infer<typeof brandConfigSchema>;
