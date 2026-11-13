import { isValidIsoDate } from './dates.js';
import { CATEGORIES } from './rules.js';
import { InvalidAiResponseError } from './errors.js';

const MAX_ACTION_TEXT_LENGTH = 200;

function parse(raw) {
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidAiResponseError('AI response is not valid JSON');
  }
}

export function validateAiResponse(raw) {
  const response = parse(raw);
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    throw new InvalidAiResponseError('AI response must be a JSON object');
  }

  const { category, actionRequired, actionText, deadline, confidence } = response;

  if (!CATEGORIES.includes(category)) {
    throw new InvalidAiResponseError(`Unknown category: ${JSON.stringify(category)}`);
  }
  if (typeof actionRequired !== 'boolean') {
    throw new InvalidAiResponseError('actionRequired must be a boolean');
  }
  if (typeof actionText !== 'string' || (actionRequired && actionText.trim() === '')) {
    throw new InvalidAiResponseError('actionText must be a non-empty string when an action is required');
  }
  const hasDeadline = deadline !== null && deadline !== undefined && deadline !== '';
  if (hasDeadline && !isValidIsoDate(deadline)) {
    throw new InvalidAiResponseError(`Invalid deadline: ${JSON.stringify(deadline)}`);
  }
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new InvalidAiResponseError('confidence must be a number between 0 and 1');
  }

  return {
    category,
    actionRequired,
    actionText: actionText.trim().slice(0, MAX_ACTION_TEXT_LENGTH),
    deadline: hasDeadline ? deadline : null,
    confidence,
  };
}
