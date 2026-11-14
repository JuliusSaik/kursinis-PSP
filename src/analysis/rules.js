import { addBusinessDays, daysBetween, laterOf } from './dates.js';

export const Category = Object.freeze({
  ORDER: 'uzsakymas',
  CLIENT_INQUIRY: 'kliento_uzklausa',
  CALLBACK: 'perskambinimas',
  INVOICE: 'saskaita',
  OTHER: 'kita',
});

export const Priority = Object.freeze({
  CRITICAL: 'kritinis',
  HIGH: 'aukstas',
  LOW: 'zemas',
});

export const TaskDecision = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  REVIEW: 'review',
  NONE: 'none',
});

export const MIN_CONFIDENCE_FOR_TASK = 0.6;
const ORDER_PREPARATION_BUSINESS_DAYS = 2;

const CATEGORY_SCORES = {
  [Category.ORDER]: 50,
  [Category.CLIENT_INQUIRY]: 40,
  [Category.CALLBACK]: 40,
  [Category.INVOICE]: 30,
  [Category.OTHER]: 0,
};

const TITLE_TAGS = {
  [Priority.CRITICAL]: '[Kritinis]',
  [Priority.HIGH]: '[Aukštas]',
};

export const CATEGORIES = Object.freeze(Object.values(Category));

function deadlineScore(deadline, today) {
  if (!deadline) {
    return 0;
  }
  const daysLeft = daysBetween(today, deadline);
  if (daysLeft <= 1) return 40;
  if (daysLeft <= 3) return 25;
  if (daysLeft <= 7) return 10;
  return 0;
}

export function calculateScore({ category, deadline }, today) {
  return CATEGORY_SCORES[category] + deadlineScore(deadline, today);
}

export function priorityForScore(score) {
  if (score >= 80) return Priority.CRITICAL;
  if (score >= 40) return Priority.HIGH;
  return Priority.LOW;
}

export function calculateTaskDue({ category, deadline }, today) {
  if (!deadline) {
    return addBusinessDays(today, 1);
  }
  const due = category === Category.ORDER
    ? addBusinessDays(deadline, -ORDER_PREPARATION_BUSINESS_DAYS)
    : deadline;
  return laterOf(due, today);
}

export function decideTask({ actionRequired, priority, confidence }, existingTaskId) {
  if (!actionRequired || priority === Priority.LOW) {
    return TaskDecision.NONE;
  }
  if (confidence < MIN_CONFIDENCE_FOR_TASK) {
    return TaskDecision.REVIEW;
  }
  return existingTaskId ? TaskDecision.UPDATE : TaskDecision.CREATE;
}

export function buildTaskTitle(priority, actionText) {
  return `${TITLE_TAGS[priority]} ${actionText}`;
}
