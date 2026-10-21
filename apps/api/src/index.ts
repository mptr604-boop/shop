import { app } from "./app.js";
import { closeDatabase } from "./db/client.js";
import { startOrderExpiryWorker } from "./modules/orders/order-expiry.worker.js";

const port = Number(process.env.PORT ?? 4000);
const stopOrderExpiryWorker = startOrderExpiryWorker();

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; closing API server`);
  await stopOrderExpiryWorker();
  server.close((error) => {
    if (error) {
      console.error("Failed to close API server cleanly", error);
      process.exitCode = 1;
    }

    void closeDatabase().catch((databaseError: unknown) => {
      console.error("Failed to close database connection pool", databaseError);
      process.exitCode = 1;
    });
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
