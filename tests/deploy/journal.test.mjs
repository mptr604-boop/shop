import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
let sandbox;
let journalFile;

// Kopia skryptów w katalogu tymczasowym, z atrapą dockera, która zawsze kończy się sukcesem.
before(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "shop-journal-"));
  await mkdir(path.join(sandbox, "deploy/.state"), { recursive: true });
  await mkdir(path.join(sandbox, "bin"));
  await cp(
    path.join(repositoryRoot, "deploy/scripts"),
    path.join(sandbox, "deploy/scripts"),
    { recursive: true },
  );
  await writeFile(path.join(sandbox, "deploy/compose.yml"), "services: {}\n");
  await writeFile(path.join(sandbox, "deploy/.env.staging"), "X=1\n");
  await writeFile(path.join(sandbox, "deploy/.state/staging.current"), "bbb\n");
  await writeFile(path.join(sandbox, "deploy/.state/staging.previous"), "aaa\n");
  const docker = path.join(sandbox, "bin/docker");
  await writeFile(
    docker,
    '#!/usr/bin/env bash\n[[ " $* " == *" ps "* ]] && echo "api web caddy"\nexit 0\n',
  );
  await chmod(docker, 0o755);
  journalFile = path.join(sandbox, "deploy/.state/journal.jsonl");
});

after(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

function run(script, args) {
  return spawnSync("bash", [path.join(sandbox, "deploy/scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${path.join(sandbox, "bin")}:${process.env.PATH}` },
  });
}

async function entries() {
  const text = await readFile(journalFile, "utf8");
  return text.trim().split("\n").map((line) => JSON.parse(line));
}

test("rollback records the reason and states the database was not rolled back", async () => {
  const result = run("rollback.sh", ["staging", 'bug "X" po 2 dniach']);
  assert.equal(result.status, 0, result.stderr);
  const last = (await entries()).at(-1);
  assert.equal(last.action, "rollback");
  assert.equal(last.result, "ok");
  assert.equal(last.environment, "staging");
  assert.equal(last.version, "aaa");
  assert.match(last.note, /bug "X" po 2 dniach/);
  assert.match(last.note, /database was NOT rolled back/);
});

test("a failed rollback is journaled as failed", async () => {
  await rm(path.join(sandbox, "deploy/.state/staging.previous"));
  const result = run("rollback.sh", ["staging"]);
  assert.notEqual(result.status, 0);
  const last = (await entries()).at(-1);
  assert.equal(last.action, "rollback");
  assert.equal(last.result, "failed");
});
