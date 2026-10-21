import { z } from "zod";

export const apiErrorSchema = z.object({
  message: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
