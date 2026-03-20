import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type TaskStatus = "todo" | "in-progress" | "done";

interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

const VALID_STATUSES: TaskStatus[] = ["todo", "in-progress", "done"];
const DATA_FILE = resolve(process.env.TASK_TRACKER_DATA_FILE ?? "tasks.json");

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

function ensureDataFileExists(): void {
  if (existsSync(DATA_FILE)) {
    return;
  }

  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, "[]\n", "utf8");
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" && VALID_STATUSES.includes(value as TaskStatus)
  );
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const task = value as Record<string, unknown>;

  return (
    typeof task.id === "string" &&
    typeof task.description === "string" &&
    isTaskStatus(task.status) &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

function loadTasks(): Task[] {
  ensureDataFileExists();

  let rawData = "";

  try {
    rawData = readFileSync(DATA_FILE, "utf8").trim();
  } catch (error) {
    throw new CliError(`Failed to read task data: ${(error as Error).message}`);
  }

  if (rawData === "") {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawData);
  } catch {
    throw new CliError(
      `Failed to read task data: ${DATA_FILE} contains invalid JSON.`,
    );
  }

  if (!Array.isArray(parsed) || !parsed.every(isTask)) {
    throw new CliError(
      `Failed to read task data: ${DATA_FILE} must contain an array of tasks.`,
    );
  }

  return parsed;
}

function saveTasks(tasks: Task[]): void {
  try {
    writeFileSync(DATA_FILE, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  } catch (error) {
    throw new CliError(`Failed to save task data: ${(error as Error).message}`);
  }
}

function createTask(description: string): Task {
  const tasks = loadTasks();
  const nextId =
    tasks.reduce((maxId, task) => {
      const numericId = Number.parseInt(task.id, 10);
      return Number.isNaN(numericId) ? maxId : Math.max(maxId, numericId);
    }, 0) + 1;
  const timestamp = new Date().toISOString();

  const task: Task = {
    id: String(nextId),
    description,
    status: "todo",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  tasks.push(task);
  saveTasks(tasks);
  console.log(`Task added successfully (ID: ${task.id})`);
  return task;
}

function findTask(tasks: Task[], id: string): Task {
  const task = tasks.find((item) => item.id === id);

  if (!task) {
    throw new CliError(`Task not found: ${id}`);
  }

  return task;
}

function updateTaskDescription(id: string, description: string): void {
  const tasks = loadTasks();
  const task = findTask(tasks, id);

  task.description = description;
  task.updatedAt = new Date().toISOString();

  saveTasks(tasks);
  console.log(`Task updated successfully (ID: ${task.id})`);
}

function deleteTask(id: string): void {
  const tasks = loadTasks();
  const taskIndex = tasks.findIndex((task) => task.id === id);

  if (taskIndex === -1) {
    throw new CliError(`Task not found: ${id}`);
  }

  tasks.splice(taskIndex, 1);
  saveTasks(tasks);
  console.log(`Task deleted successfully (ID: ${id})`);
}

function updateTaskStatus(id: string, status: TaskStatus): void {
  const tasks = loadTasks();
  const task = findTask(tasks, id);

  task.status = status;
  task.updatedAt = new Date().toISOString();

  saveTasks(tasks);
  console.log(`Task marked as ${status} (ID: ${task.id})`);
}

function formatTask(task: Task): string {
  return `[${task.id}] ${task.description} (${task.status})`;
}

function listTasks(status?: TaskStatus): void {
  const tasks = loadTasks();
  const filteredTasks = status
    ? tasks.filter((task) => task.status === status)
    : tasks;

  if (filteredTasks.length === 0) {
    console.log("No tasks found.");
    return;
  }

  for (const task of filteredTasks) {
    console.log(formatTask(task));
  }
}

function requireArgument(value: string | undefined, message: string): string {
  if (!value || value.trim() === "") {
    throw new CliError(message);
  }

  return value.trim();
}

function printUsage(): void {
  console.log(`Usage:
  task-cli add "<description>"
  task-cli update <id> "<description>"
  task-cli delete <id>
  task-cli mark-todo <id>
  task-cli mark-in-progress <id>
  task-cli mark-done <id>
  task-cli list [todo|in-progress|done]`);
}

function run(argv: string[]): void {
  const [command, ...rest] = argv;

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    printUsage();
    return;
  }

  switch (command) {
    case "add": {
      createTask(requireArgument(rest.join(" "), "Missing task description."));
      return;
    }
    case "update": {
      const id = requireArgument(rest[0], "Missing task id.");
      const description = requireArgument(
        rest.slice(1).join(" "),
        "Missing task description.",
      );

      updateTaskDescription(id, description);
      return;
    }
    case "delete": {
      deleteTask(requireArgument(rest[0], "Missing task id."));
      return;
    }
    case "mark-todo": {
      updateTaskStatus(requireArgument(rest[0], "Missing task id."), "todo");
      return;
    }
    case "mark-in-progress": {
      updateTaskStatus(
        requireArgument(rest[0], "Missing task id."),
        "in-progress",
      );
      return;
    }
    case "mark-done": {
      updateTaskStatus(requireArgument(rest[0], "Missing task id."), "done");
      return;
    }
    case "list": {
      const status = rest[0];

      if (status === undefined) {
        listTasks();
        return;
      }

      if (!isTaskStatus(status)) {
        throw new CliError(
          `Invalid status: ${status}. Use todo, in-progress, or done.`,
        );
      }

      listTasks(status);
      return;
    }
    default:
      throw new CliError(`Unknown command: ${command}`);
  }
}

try {
  run(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof CliError ? error.message : (error as Error).message;

  console.error(message);
  process.exitCode = 1;
}
