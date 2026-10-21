import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok").describe("Current health status of the service."),
  service: z.string().describe("Name of the service returning this response."),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
