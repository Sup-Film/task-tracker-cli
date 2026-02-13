import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";

const DATA_FILE = "./tasks.json";

interface Task {
  id: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  createdAt: string;
  updatedAt: string;
}

interface UpdateTaskInput {
  id: string;
  status: "todo" | "in-progress" | "done";
}

// แสดงข้อความในคอนโซล
const prompt = `\n> Enter command (add/list/done/exit): `;
process.stdout.write(prompt);

async function list() {
  if (!existsSync(DATA_FILE)) {
    console.log("No tasks found.");
    return;
  }
  const data = readFileSync(DATA_FILE, "utf-8");
  const tasks: Task[] = JSON.parse(data);
  if (tasks.length === 0) {
    console.log("No tasks found.");
    return;
  }
  console.log("Tasks");
  tasks.forEach((task) => {
    console.log(`- [${task.status}] ${task.description} (ID: ${task.id})`);
  });
}

async function loadTasks(): Promise<Task[]> {
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, "[]");
    return [];
  }
  const data = readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

function saveTasks(tasks: Task[]) {
  writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

async function add(description: string) {
  const tasks = await loadTasks();

  let newTask: Task = {
    id: randomUUID(),
    description: description,
    status: "todo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  saveTasks(tasks);
  console.log(`✅ Task added (ID: ${newTask.id})`);
}

async function update(input: UpdateTaskInput) {
  const { id, status } = input;
  const tasks = await loadTasks();

  for (let task of tasks) {
    if (task.id === id) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
      saveTasks(tasks);
      console.log(`✅ Task updated (ID: ${task.id})`);
      return;
    }
  }

  console.log(`❌ Task not found (ID: ${id})`);
}

// รับอินพุตจากคอนโซล
for await (const line of console) {
  const input = line.trim();

  if (input === "exit") {
    console.log("👋 Goodbye!");
    break;
  } else if (input === "list") {
    console.log("Listing tasks...");
    await list();
  } else if (input.startsWith("add ")) {
    await add(input.slice(4).trim());
  } else if (input.startsWith("update ")) {
    // TODO: implement update
  }

  process.stdout.write(prompt);
}
