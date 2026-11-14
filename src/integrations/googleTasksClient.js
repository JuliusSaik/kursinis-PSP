import { TaskNotFoundError } from './mockTasksClient.js';

const API_URL = 'https://tasks.googleapis.com/tasks/v1';
const TASK_LIST_TITLE = 'PiEmail';

const isNotFound = (error) => error.response?.status === 404;

function toTask(task) {
  return { id: task.id, title: task.title, due: task.due?.slice(0, 10) ?? null, notes: task.notes ?? '' };
}

// Google Tasks stores only the date part of `due`, but the API expects an RFC 3339 timestamp.
const toGoogleDue = (date) => `${date}T00:00:00.000Z`;

export class GoogleTasksClient {
  constructor({ auth }) {
    this.auth = auth;
    this.taskListId = null;
  }

  async #request(path, options = {}) {
    const { data } = await this.auth.request({ url: `${API_URL}${path}`, ...options });
    return data;
  }

  // Tasks go to a separate "PiEmail" list so the owner's personal tasks are never shown or changed.
  async #listPath() {
    if (!this.taskListId) {
      const { items = [] } = await this.#request('/users/@me/lists', { params: { maxResults: 100 } });
      const existing = items.find((list) => list.title === TASK_LIST_TITLE);
      const list = existing ?? (await this.#request('/users/@me/lists', { method: 'POST', data: { title: TASK_LIST_TITLE } }));
      this.taskListId = list.id;
    }
    return `/lists/${this.taskListId}/tasks`;
  }

  async listTasks() {
    const { items = [] } = await this.#request(await this.#listPath(), {
      params: { showCompleted: false, maxResults: 100 },
    });
    return items.map(toTask);
  }

  // A completed task counts as gone, so a new request in the same thread creates a fresh task.
  async taskExists(taskId) {
    try {
      const task = await this.#request(`${await this.#listPath()}/${taskId}`);
      return !task.deleted && task.status !== 'completed';
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async createTask({ title, due, notes }) {
    const task = await this.#request(await this.#listPath(), {
      method: 'POST',
      data: { title, notes, due: toGoogleDue(due) },
    });
    return toTask(task);
  }

  async updateTask(taskId, { title, due }) {
    try {
      const task = await this.#request(`${await this.#listPath()}/${taskId}`, {
        method: 'PATCH',
        data: { title, due: toGoogleDue(due) },
      });
      return toTask(task);
    } catch (error) {
      if (isNotFound(error)) throw new TaskNotFoundError(taskId);
      throw error;
    }
  }

  async deleteTask(taskId) {
    try {
      await this.#request(`${await this.#listPath()}/${taskId}`, { method: 'DELETE' });
    } catch (error) {
      if (isNotFound(error)) throw new TaskNotFoundError(taskId);
      throw error;
    }
  }
}
