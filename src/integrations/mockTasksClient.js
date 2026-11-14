import { randomUUID } from 'node:crypto';

export class TaskNotFoundError extends Error {
  constructor(taskId) {
    super(`Task ${taskId} was not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class MockTasksClient {
  constructor({ store, tenantId }) {
    this.store = store;
    this.tenantId = tenantId;
  }

  #tasks() {
    return this.store.read()[this.tenantId] ?? [];
  }

  #save(tasks) {
    const data = this.store.read();
    data[this.tenantId] = tasks;
    this.store.write(data);
  }

  async listTasks() {
    return this.#tasks();
  }

  async taskExists(taskId) {
    return this.#tasks().some((task) => task.id === taskId);
  }

  async createTask({ title, due, notes }) {
    const task = { id: `task-${randomUUID().slice(0, 8)}`, title, due, notes };
    this.#save([...this.#tasks(), task]);
    return task;
  }

  async updateTask(taskId, changes) {
    const tasks = this.#tasks();
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index === -1) {
      throw new TaskNotFoundError(taskId);
    }
    tasks[index] = { ...tasks[index], ...changes };
    this.#save(tasks);
    return tasks[index];
  }

  async deleteTask(taskId) {
    const tasks = this.#tasks();
    if (!tasks.some((task) => task.id === taskId)) {
      throw new TaskNotFoundError(taskId);
    }
    this.#save(tasks.filter((task) => task.id !== taskId));
  }
}
