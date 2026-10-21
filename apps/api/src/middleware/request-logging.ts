import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

function requestPath(request: Request): string {
  return request.path;
}

export const requestLoggingMiddleware: RequestHandler = (
  request,
  response,
  next,
) => {
  const requestId = randomUUID();
  const startedAt = performance.now();

  response.setHeader("X-Request-Id", requestId);
  response.on("finish", () => {
    if (request.path === "/health" || request.path === "/ready") {
      return;
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "http.request",
        requestId,
        method: request.method,
        path: requestPath(request),
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });

  response.locals.requestId = requestId;
  next();
};

function redactSensitiveValues(message: string): string {
  return message
    .replace(
      /\b(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi,
      "$1[REDACTED]@",
    )
    .replace(
      /\b(password|token|secret|authorization)(\s*[:=]\s*)[^,\s]+/gi,
      "$1$2[REDACTED]",
    );
}

export function logRequestError(
  request: Request,
  response: Response,
  error: unknown,
  event = "http.error",
): void {
  const errorName =
    error instanceof Error ? error.name : "UnknownError";
  const errorMessage =
    error instanceof Error
      ? redactSensitiveValues(error.message)
      : "Non-error value was thrown";

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      requestId: response.locals.requestId,
      method: request.method,
      path: request.path,
      error: {
        name: errorName,
        message: errorMessage,
      },
    }),
  );
}
