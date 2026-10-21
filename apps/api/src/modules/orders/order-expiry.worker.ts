import {
  expirePendingOrders,
  expiryBatchSize,
} from "./orders.repository.js";

const expiryCheckIntervalMs = 30_000;

export function startOrderExpiryWorker() {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let activeRun: Promise<void> | undefined;

  const run = () => {
    activeRun = (async () => {
      let expiredCount = 0;
      let batchCount: number;
      do {
        batchCount = await expirePendingOrders();
        expiredCount += batchCount;
      } while (batchCount === expiryBatchSize);

      if (expiredCount > 0) {
        console.info(`Expired ${expiredCount} pending order(s).`);
      }
    })()
      .catch((error: unknown) => {
        console.error("Failed to expire pending orders.", error);
      })
      .finally(() => {
        if (!stopped) {
          timer = setTimeout(run, expiryCheckIntervalMs);
        }
      });

    return activeRun;
  };

  void run();

  return async () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
    }
    await activeRun;
  };
}
