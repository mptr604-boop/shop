import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing API server`);
  server.close((error) => {
    if (error) {
      console.error("Failed to close API server cleanly", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
