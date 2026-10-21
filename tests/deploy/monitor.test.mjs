import assert from "node:assert/strict";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const monitorScript = path.join(
  repositoryRoot,
  "deploy/scripts/monitor.sh",
);
const environment = `ci-${process.pid}`;
const stateDirectory = path.join(repositoryRoot, "deploy/.state");
const stateFiles = [
  path.join(stateDirectory, `monitor-${environment}-web`),
  path.join(stateDirectory, `monitor-${environment}-api`),
];
const temporaryDirectory = path.join(
  repositoryRoot,
  "deploy/.state",
  `monitor-test-${process.pid}`,
);
const curlShim = path.join(temporaryDirectory, "curl");
const curlLog = path.join(temporaryDirectory, "requests.jsonl");
const webhookUrl = "https://webhook.example.test/incoming";

before(async () => {
  await mkdir(temporaryDirectory, { recursive: true });
  await writeFile(
    curlShim,
    `#!/usr/bin/env bash
set -euo pipefail
url=""
payload=""
while (($#)); do
  case "$1" in
    --data)
      payload="$2"
      shift 2
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done
if [[ "$url" == "\${ALERT_WEBHOOK_URL:-}" && -n "\${ALERT_WEBHOOK_URL:-}" ]]; then
  printf '%s\\n' "$payload" >>"$MOCK_CURL_LOG"
  [[ "\${MOCK_WEBHOOK_FAIL:-0}" != "1" ]]
elif [[ "$url" == */ready ]]; then
  printf '%s' "\${MOCK_API_STATUS:-200}"
else
  printf '%s' "\${MOCK_WEB_STATUS:-200}"
fi
`,
    { mode: 0o700 },
  );
  await chmod(curlShim, 0o700);
});

after(async () => {
  await Promise.all(stateFiles.map((stateFile) => rm(stateFile, { force: true })));
  await rm(temporaryDirectory, { recursive: true, force: true });
});

let lastLineCount = 0;

function runMonitor({
  webStatus = "200",
  apiStatus = "200",
  webhookFails = false,
  webhookConfigured = true,
} = {}) {
  const environmentVariables = {
    ...process.env,
    MOCK_API_STATUS: apiStatus,
    MOCK_CURL_LOG: curlLog,
    MOCK_WEBHOOK_FAIL: webhookFails ? "1" : "0",
    MOCK_WEB_STATUS: webStatus,
    PATH: `${temporaryDirectory}:${process.env.PATH}`,
  };
  if (webhookConfigured) {
    environmentVariables.ALERT_WEBHOOK_URL = webhookUrl;
  } else {
    delete environmentVariables.ALERT_WEBHOOK_URL;
  }

  const result = spawnSync(
    "bash",
    [
      monitorScript,
      environment,
      "https://shop.example.test",
      "https://api.shop.example.test",
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: environmentVariables,
    },
  );

  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

async function readNewWebhookMessages() {
  let lines = [];
  try {
    lines = (await readFile(curlLog, "utf8")).trimEnd().split("\n");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const newMessages = lines.slice(lastLineCount).map((line) => JSON.parse(line));
  lastLineCount = lines.length;
  return newMessages;
}

test("alerts on service transitions and reports webhook failures", async () => {
  const initial = runMonitor();
  assert.equal(initial.status, 0, initial.stderr);
  assert.deepEqual(await readNewWebhookMessages(), []);

  const noWebhook = runMonitor({ webStatus: "503", webhookConfigured: false });
  assert.equal(noWebhook.status, 1);
  await assert.rejects(readFile(stateFiles[0]), { code: "ENOENT" });

  const webDown = runMonitor({ webStatus: "503" });
  assert.equal(webDown.status, 1);
  assert.match(webDown.stdout, /ALERT: web is unavailable/);
  const webAlert = await readNewWebhookMessages();
  assert.equal(webAlert.length, 1);
  assert.match(webAlert[0].text, /\[ci-.*\] ALERT: web is unavailable/);
  assert.equal(await readFile(stateFiles[0], "utf8"), "down\n");

  const repeatedWebFailure = runMonitor({ webStatus: "503" });
  assert.equal(repeatedWebFailure.status, 1);
  assert.deepEqual(await readNewWebhookMessages(), []);

  const failedWebhook = runMonitor({
    webStatus: "200",
    apiStatus: "503",
    webhookFails: true,
  });
  assert.equal(failedWebhook.status, 1);
  await assert.rejects(readFile(stateFiles[1]), { code: "ENOENT" });
  const failedDelivery = await readNewWebhookMessages();
  assert.equal(failedDelivery.length, 2);
  assert.match(failedDelivery[0].text, /RECOVERED: web is responding again/);
  assert.match(failedDelivery[1].text, /ALERT: api is unavailable/);

  const apiDown = runMonitor({ apiStatus: "503" });
  assert.equal(apiDown.status, 1);
  const apiAlert = await readNewWebhookMessages();
  assert.equal(apiAlert.length, 2);
  assert.match(apiAlert[0].text, /RECOVERED: web is responding again/);
  assert.match(apiAlert[1].text, /ALERT: api is unavailable/);

  const recovered = runMonitor();
  assert.equal(recovered.status, 0, recovered.stderr);
  const recoveryAlerts = await readNewWebhookMessages();
  assert.equal(recoveryAlerts.length, 1);
  assert.match(recoveryAlerts[0].text, /RECOVERED: api is responding again/);
  assert.equal(lastLineCount, 6);
});
