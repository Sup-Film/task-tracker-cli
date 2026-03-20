import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();

function createSandbox() {
  const directory = mkdtempSync(join(tmpdir(), "task-tracker-cli-"));
  return {
    directory,
    dataFile: join(directory, "tasks.json"),
  };
}

function runCli(args, options = {}) {
  return spawnSync(
    process.execPath,
    [join(repoRoot, "dist/index.js"), ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        TASK_TRACKER_DATA_FILE: options.dataFile,
      },
      timeout: 1000,
      killSignal: "SIGKILL",
    },
  );
}

test("adds a task with required default fields", async () => {
  const sandbox = createSandbox();

  try {
    const result = runCli(["add", "Buy groceries"], { dataFile: sandbox.dataFile });

    assert.equal(result.status, 0);

    const tasks = JSON.parse(readFileSync(sandbox.dataFile, "utf8"));
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, "1");
    assert.equal(tasks[0].description, "Buy groceries");
    assert.equal(tasks[0].status, "todo");
    assert.ok(tasks[0].createdAt);
    assert.equal(tasks[0].createdAt, tasks[0].updatedAt);
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("updates only the description when using update", async () => {
  const sandbox = createSandbox();
  writeFileSync(
    sandbox.dataFile,
    JSON.stringify(
      [
        {
          id: "1",
          description: "Buy groceries",
          status: "todo",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      null,
      2,
    ),
  );

  try {
    const result = runCli(["update", "1", "Buy groceries and cook dinner"], {
      dataFile: sandbox.dataFile,
    });

    assert.equal(result.status, 0);

    const tasks = JSON.parse(readFileSync(sandbox.dataFile, "utf8"));
    assert.equal(tasks[0].description, "Buy groceries and cook dinner");
    assert.equal(tasks[0].status, "todo");
    assert.notEqual(tasks[0].updatedAt, "2026-03-20T00:00:00.000Z");
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("lists only tasks for a requested status", async () => {
  const sandbox = createSandbox();
  writeFileSync(
    sandbox.dataFile,
    JSON.stringify(
      [
        {
          id: "1",
          description: "Todo task",
          status: "todo",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
        {
          id: "2",
          description: "Doing task",
          status: "in-progress",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
        {
          id: "3",
          description: "Done task",
          status: "done",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      null,
      2,
    ),
  );

  try {
    const result = runCli(["list", "done"], { dataFile: sandbox.dataFile });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Done task/);
    assert.doesNotMatch(result.stdout, /Todo task/);
    assert.doesNotMatch(result.stdout, /Doing task/);
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("returns a clean error when the task id does not exist", async () => {
  const sandbox = createSandbox();
  writeFileSync(sandbox.dataFile, "[]");

  try {
    const result = runCli(["mark-done", "99"], { dataFile: sandbox.dataFile });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Task not found/);
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});

test("returns a clean error when the JSON data file is malformed", async () => {
  const sandbox = createSandbox();
  writeFileSync(sandbox.dataFile, "{ not valid json");

  try {
    const result = runCli(["list"], { dataFile: sandbox.dataFile });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Failed to read task data/i);
  } finally {
    await rm(sandbox.directory, { recursive: true, force: true });
  }
});
