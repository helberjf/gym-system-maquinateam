import { z } from "zod";

export const analyticsChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(20)
    .optional(),
});

export type AnalyticsChatRequestInput = z.infer<typeof analyticsChatSchema>;
