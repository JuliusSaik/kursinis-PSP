import { randomUUID } from 'node:crypto';

export class MockGmailClient {
  constructor({ store, tenantId, now = () => new Date() }) {
    this.store = store;
    this.tenantId = tenantId;
    this.now = now;
  }

  #messages() {
    return this.store.read()[this.tenantId] ?? [];
  }

  async listMessagesSince(since) {
    const messages = this.#messages();
    return since ? messages.filter((message) => message.receivedAt > since) : messages;
  }

  async getMessage(messageId) {
    return this.#messages().find((message) => message.id === messageId) ?? null;
  }

  deliver({ from, subject, body, threadId, labels = ['INBOX'], hasListUnsubscribe = false }) {
    const message = {
      id: `msg-${randomUUID().slice(0, 8)}`,
      threadId: threadId || `thread-${randomUUID().slice(0, 8)}`,
      from,
      subject,
      body,
      receivedAt: this.now().toISOString(),
      labels,
      hasListUnsubscribe,
    };
    const data = this.store.read();
    data[this.tenantId] = [...(data[this.tenantId] ?? []), message];
    this.store.write(data);
    return message;
  }
}
