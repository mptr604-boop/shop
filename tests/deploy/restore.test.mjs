import assert from "node:assert/strict";
import {
  chmod,
  access,
  mkdir,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const restoreScript = path.join(repositoryRoot, "deploy/scripts/restore.sh");
const environment = `ci-${process.pid}`;
const backupDirectory = path.join(
  repositoryRoot,
  "deploy/backups",
  "staging",
);
const backupName = `${environment}.dump`;
const backupFile = path.join(backupDirectory, backupName);
const environmentFile = path.join(repositoryRoot, "deploy/.env.staging");
const temporaryDirectory = path.join(
  repositoryRoot,
  "deploy/.state",
  `restore-test-${process.pid}`,
);
const dockerShim = path.join(temporaryDirectory, "docker");
const dateShim = path.join(temporaryDirectory, "date");
const dockerLog = path.join(temporaryDirectory, "docker.log");
let createdEnvironmentFile = false;
const testRunId = `${process.pid}${Date.now()}`;
const generatedBackup = path.join(
  backupDirectory,
  `20990101T${testRunId}Z.dump`,
);

before(async () => {
  await mkdir(temporaryDirectory, { recursive: true });
  await mkdir(backupDirectory, { recursive: true });
  try {
    await access(environmentFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(environmentFile, "test-only deployment settings\n");
    createdEnvironmentFile = true;
  }
  await writeFile(
    dockerShim,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"$MOCK_DOCKER_LOG"
if [[ "$*" == *"ps --status running"* ]]; then
  printf 'database caddy\\n'
fi
if [[ "$*" == *"pg_dump --format=custom"* ]]; then
  printf 'mock PostgreSQL archive'
fi
if [[ "$*" == *"pg_restore --list"* && "\${MOCK_ARCHIVE_INVALID:-0}" == "1" ]]; then
  exit 1
fi
`,
    { mode: 0o700 },
  );
  await writeFile(
    dateShim,
    `#!/usr/bin/env bash
case "$*" in
  *%Y%m%dT%H%M%SZ*) printf '20990101T${testRunId}Z\\n' ;;
  *%Y%m%d%H%M%S*) printf '20990101${testRunId}\\n' ;;
  *) exit 1 ;;
esac
`,
    { mode: 0o700 },
  );
  await chmod(dockerShim, 0o700);
  await chmod(dateShim, 0o700);
  await writeFile(backupFile, "mock PostgreSQL archive");
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  await utimes(backupFile, oldDate, oldDate);
  const checksum = createHash("sha256")
    .update(await readFile(backupFile))
    .digest("hex");
  await writeFile(`${backupFile}.sha256`, `${checksum}  ${backupFile}\n`);
  await utimes(`${backupFile}.sha256`, oldDate, oldDate);
});

after(async () => {
  await rm(backupFile, { force: true });
  await rm(`${backupFile}.sha256`, { force: true });
  await rm(generatedBackup, { force: true });
  await rm(`${generatedBackup}.sha256`, { force: true });
  if (createdEnvironmentFile) {
    await rm(environmentFile, { force: true });
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
});

function runRestore({
  args = ["staging", backupName],
  confirmation = "",
  archiveInvalid = false,
} = {}) {
  const environmentVariables = {
    ...process.env,
    MOCK_ARCHIVE_INVALID: archiveInvalid ? "1" : "0",
    MOCK_DOCKER_LOG: dockerLog,
    PATH: `${temporaryDirectory}:${process.env.PATH}`,
  };
  const result = spawnSync("bash", [restoreScript, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environmentVariables,
    input: confirmation,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

test("rejects unsafe or unverifiable restore requests before Docker changes", async () => {
  const invalidArguments = runRestore({ args: ["production", "../backup.dump"] });
  assert.equal(invalidArguments.status, 2);

  const beforeMissingChecksum = await readFile(`${backupFile}.sha256`, "utf8");
  await rm(`${backupFile}.sha256`);
  const missingChecksum = runRestore();
  assert.equal(missingChecksum.status, 1);
  assert.match(missingChecksum.stderr, /checksum file is missing/);
  await writeFile(`${backupFile}.sha256`, beforeMissingChecksum);

  const checksum = createHash("sha256")
    .update("tampered archive")
    .digest("hex");
  await writeFile(`${backupFile}.sha256`, `${checksum}  ${backupFile}\n`);
  const mismatch = runRestore();
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /checksum does not match/);
});

test("validates archive and requires explicit interactive confirmation", async () => {
  const checksum = createHash("sha256")
    .update(await readFile(backupFile))
    .digest("hex");
  await writeFile(`${backupFile}.sha256`, `${checksum}  ${backupFile}\n`);

  const invalidArchive = runRestore({ archiveInvalid: true });
  assert.equal(invalidArchive.status, 1);
  assert.match(invalidArchive.stderr, /archive validation failed/);

  const notConfirmed = runRestore();
  assert.equal(notConfirmed.status, 1);
  assert.match(notConfirmed.stderr, /interactive terminal/);
});

test("restores from a verified copy even when backup retention prunes the source", async () => {
  const command = `bash '${restoreScript}' staging '${backupName}'`;
  const result = spawnSync(
    "script",
    ["-q", "-e", "-c", command, "/dev/null"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        MOCK_DOCKER_LOG: dockerLog,
        PATH: `${temporaryDirectory}:${process.env.PATH}`,
      },
      input: "RESTORE staging\n",
    },
  );

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Database restored for staging/);
  assert.match(result.stdout, /Previous database retained as shop_before_restore_/);

  const dockerCalls = await readFile(dockerLog, "utf8");
  assert.match(dockerCalls, /CREATE DATABASE :"restore_db"/);
  assert.match(dockerCalls, /pg_restore --clean --if-exists --exit-on-error/);
  assert.match(dockerCalls, /ALTER DATABASE :"target_db" RENAME TO :"old_db"/);
  assert.match(dockerCalls, /stop api web caddy/);
  assert.match(dockerCalls, /fetch\('http:\/\/127\.0\.0\.1:4000\/ready'\)/);
  await assert.rejects(readFile(backupFile), { code: "ENOENT" });
  await access(generatedBackup);
});
