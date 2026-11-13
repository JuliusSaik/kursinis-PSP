import { analyzeEmail } from '../analysis/analyzeEmail.js';
import { TaskDecision } from '../analysis/rules.js';
import { EmailStatus } from '../storage/emailRepository.js';
import { cleanEmailBody } from './cleanBody.js';
import { isRelevantEmail } from './emailFilter.js';

const STATUS_BY_DECISION = {
  [TaskDecision.CREATE]: EmailStatus.TASK_CREATED,
  [TaskDecision.UPDATE]: EmailStatus.TASK_UPDATED,
  [TaskDecision.REVIEW]: EmailStatus.NEEDS_REVIEW,
  [TaskDecision.NONE]: EmailStatus.NO_ACTION,
};

export class MailboxChecker {
  constructor({ emails, classifier, clock, mailClientFor, tasksClientFor }) {
    this.emails = emails;
    this.classifier = classifier;
    this.clock = clock;
    this.mailClientFor = mailClientFor;
    this.tasksClientFor = tasksClientFor;
  }

  async check(tenant) {
    const startedAt = this.clock.now().toISOString();
    const mail = this.mailClientFor(tenant);
    const tasks = this.tasksClientFor(tenant);

    const candidates = await this.#collectCandidates(tenant, mail);
    const relevant = candidates.filter((email) => isRelevantEmail(email, tenant.mailboxAddress));
    relevant.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

    const processed = [];
    for (const email of relevant) {
      processed.push(await this.#process(tenant, email, tasks));
    }

    this.emails.setLastCheckedAt(tenant.id, startedAt);
    return { fetched: candidates.length, filteredOut: candidates.length - relevant.length, processed };
  }

  async #collectCandidates(tenant, mail) {
    const newMessages = await mail.listMessagesSince(this.emails.getLastCheckedAt(tenant.id));
    const retried = await Promise.all(
      this.emails.listRetryableMessageIds(tenant.id).map((messageId) => mail.getMessage(messageId)),
    );

    const unique = new Map();
    for (const email of [...newMessages, ...retried]) {
      if (email && !this.emails.isProcessed(tenant.id, email.id)) {
        unique.set(email.id, email);
      }
    }
    return [...unique.values()];
  }

  async #process(tenant, email, tasks) {
    const linkedTaskId = this.emails.findThreadTaskId(tenant.id, email.threadId);
    const existingTaskId = linkedTaskId && (await tasks.taskExists(linkedTaskId)) ? linkedTaskId : null;

    const analysis = await analyzeEmail(
      { ...email, body: cleanEmailBody(email.body) },
      { classifier: this.classifier, today: this.clock.today(), existingTaskId },
    );

    const record = {
      messageId: email.id,
      threadId: email.threadId,
      sender: email.from,
      subject: email.subject,
      receivedAt: email.receivedAt,
      processedAt: this.clock.now().toISOString(),
    };

    if (!analysis.ok) {
      return this.#save(tenant, { ...record, status: EmailStatus.ANALYSIS_FAILED, error: analysis.error });
    }

    const { result } = analysis;
    const analysed = {
      ...record,
      category: result.category,
      actionText: result.actionText,
      deadline: result.deadline,
      confidence: result.confidence,
      score: result.score,
      priority: result.priority,
      status: STATUS_BY_DECISION[result.taskDecision],
    };

    try {
      const taskId = await this.#applyTaskDecision(tenant, email, result, existingTaskId, tasks);
      return this.#save(tenant, { ...analysed, taskId, taskDue: taskId ? result.taskDue : null });
    } catch (error) {
      return this.#save(tenant, { ...analysed, status: EmailStatus.TASK_FAILED, error: error.message });
    }
  }

  async #applyTaskDecision(tenant, email, result, existingTaskId, tasks) {
    const task = { title: result.taskTitle, due: result.taskDue };

    if (result.taskDecision === TaskDecision.UPDATE) {
      await tasks.updateTask(existingTaskId, task);
      return existingTaskId;
    }
    if (result.taskDecision === TaskDecision.CREATE) {
      const created = await tasks.createTask({ ...task, notes: `https://mail.google.com/mail/u/0/#all/${email.threadId}` });
      this.emails.linkThreadTask(tenant.id, email.threadId, created.id);
      return created.id;
    }
    return null;
  }

  #save(tenant, record) {
    this.emails.save(tenant.id, record);
    return this.emails.findByMessageId(tenant.id, record.messageId);
  }
}
