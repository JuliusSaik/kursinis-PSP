import { validateAiResponse } from './validateAiResponse.js';
import { buildTaskTitle, calculateScore, calculateTaskDue, decideTask, priorityForScore, TaskDecision } from './rules.js';

export async function analyzeEmail(email, { classifier, today, existingTaskId = null }) {
  let classification;
  try {
    classification = validateAiResponse(await classifier.classify(email, { today }));
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const score = calculateScore(classification, today);
  const priority = priorityForScore(score);
  const taskDecision = decideTask({ ...classification, priority }, existingTaskId);
  const createsOrUpdatesTask = taskDecision === TaskDecision.CREATE || taskDecision === TaskDecision.UPDATE;

  return {
    ok: true,
    result: {
      ...classification,
      score,
      priority,
      taskDecision,
      taskDue: createsOrUpdatesTask ? calculateTaskDue(classification, today) : null,
      taskTitle: createsOrUpdatesTask ? buildTaskTitle(priority, classification.actionText) : null,
    },
  };
}
