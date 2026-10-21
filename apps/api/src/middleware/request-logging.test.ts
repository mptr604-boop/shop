import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import {
  logRequestError,
  requestLoggingMiddleware,
} from "./request-logging.js";

const app = express();
app.use(requestLoggingMiddleware);
app.get("/items", (_request, response) => {
  response.status(201).json({ ok: true });
});
app.get("/fail", (_request, _response, next) => {
  next(new Error("password=private postgres://shop:private@database/shop"));
});
app.use(
  (
    error: unknown,
    request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    logRequestError(request, response, error);
    response.status(500).json({ ok: false });
  },
);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const accessLogs: string[] = [];
const errorLogs: string[] = [];
const originalLog = console.log;
const originalError = console.error;

describe("API request logging", () => {
  before(async () => {
    console.log = (message?: unknown) => {
      accessLogs.push(String(message));
    };
    console.error = (message?: unknown) => {
      errorLogs.push(String(message));
    };
    server = app.listen(0);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine the logging test server port.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    console.log = originalLog;
    console.error = originalError;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns a request ID and logs the path without query parameters", async () => {
    const response = await fetch(`${baseUrl}/items?token=private`);

    assert.equal(response.status, 201);
    const requestId = response.headers.get("x-request-id");
    assert.match(requestId ?? "", /^[0-9a-f-]{36}$/);

    const log = JSON.parse(accessLogs[0]) as {
      event: string;
      requestId: string;
      path: string;
      statusCode: number;
    };
    assert.equal(log.event, "http.request");
    assert.equal(log.requestId, requestId);
    assert.equal(log.path, "/items");
    assert.equal(log.statusCode, 201);
    assert.doesNotMatch(accessLogs[0], /private/);
  });

  it("logs unexpected errors with the request ID and redacts secrets", async () => {
    const response = await fetch(`${baseUrl}/fail?secret=query-secret`);
    assert.equal(response.status, 500);

    const requestId = response.headers.get("x-request-id");
    const errorLog = JSON.parse(errorLogs[0]) as {
      requestId: string;
      error: { message: string };
    };
    const accessLog = JSON.parse(accessLogs[1]) as {
      requestId: string;
      path: string;
    };

    assert.equal(errorLog.requestId, requestId);
    assert.equal(accessLog.requestId, requestId);
    assert.equal(accessLog.path, "/fail");
    assert.match(errorLog.error.message, /password=\[REDACTED\]/);
    assert.match(errorLog.error.message, /postgres:\/\/shop:\[REDACTED\]@database/);
    assert.doesNotMatch(
      `${accessLogs[1]}${errorLogs[0]}`,
      /private|query-secret/,
    );
  });
});
