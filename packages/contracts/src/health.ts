import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok").describe("Current health status of the service."),
  service: z.string().describe("Name of the service returning this response."),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  service: z.literal("api"),
  dependencies: z.object({
    database: z.enum(["ok", "unavailable"]),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
