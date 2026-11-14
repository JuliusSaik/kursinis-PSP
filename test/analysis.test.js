import { describe, expect, it } from 'vitest';
import { analyzeEmail } from '../src/analysis/analyzeEmail.js';
import { AiServiceError } from '../src/analysis/errors.js';
import { calculateTaskDue, Category, priorityForScore, TaskDecision } from '../src/analysis/rules.js';
import { StubClassifier, inboxEmail } from './helpers.js';

const orderResponse = (overrides = {}) => ({
  category: 'uzsakymas',
  actionRequired: true,
  actionText: 'Patvirtinti 3 stalviršių užsakymą',
  deadline: '2026-10-20',
  confidence: 0.9,
  ...overrides,
});

const analyze = (response, options = {}) =>
  analyzeEmail(inboxEmail(), {
    classifier: new StubClassifier(() => response),
    today: '2026-10-05',
    ...options,
  });

describe('analyzeEmail', () => {
  it('creates a high priority task two business days before an order deadline', async () => {
    const { ok, result } = await analyze(orderResponse());

    expect(ok).toBe(true);
    expect(result).toMatchObject({
      category: 'uzsakymas',
      score: 50,
      priority: 'aukstas',
      taskDecision: TaskDecision.CREATE,
      taskDue: '2026-10-16',
      taskTitle: '[Aukštas] Patvirtinti 3 stalviršių užsakymą',
    });
  });

  it('updates the existing thread task and never schedules it before today', async () => {
    const { result } = await analyze(orderResponse({ deadline: '2026-10-08' }), {
      today: '2026-10-07',
      existingTaskId: 'task-1',
    });

    expect(result).toMatchObject({
      score: 90,
      priority: 'kritinis',
      taskDecision: TaskDecision.UPDATE,
      taskDue: '2026-10-07',
      taskTitle: '[Kritinis] Patvirtinti 3 stalviršių užsakymą',
    });
  });

  it('marks the email for review when the AI is not confident enough', async () => {
    const { result } = await analyze(orderResponse({ confidence: 0.59 }));

    expect(result.taskDecision).toBe(TaskDecision.REVIEW);
    expect(result.taskDue).toBeNull();
  });

  it('does not create a task for low priority emails', async () => {
    const { result } = await analyze(orderResponse({ category: 'saskaita', deadline: null }));

    expect(result).toMatchObject({ score: 30, priority: 'zemas', taskDecision: TaskDecision.NONE });
  });

  it('fails without throwing when the AI service is unavailable', async () => {
    const failing = new StubClassifier(() => {
      throw new AiServiceError('AI service responded with HTTP 401');
    });

    const outcome = await analyzeEmail(inboxEmail(), { classifier: failing, today: '2026-10-05' });

    expect(outcome).toEqual({ ok: false, error: 'AI service responded with HTTP 401' });
  });

  it.each([
    ['an unknown category', orderResponse({ category: 'spam' }), /Unknown category/],
    ['a date that does not exist', orderResponse({ deadline: '2026-02-30' }), /Invalid deadline/],
    ['confidence out of range', orderResponse({ confidence: 1.5 }), /confidence/],
    ['malformed JSON', '{"category": "uzsakymas"', /not valid JSON/],
  ])('rejects an AI response with %s', async (_, response, expectedError) => {
    const outcome = await analyze(response);

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(expectedError);
  });
});

describe('priority and task date rules', () => {
  it.each([[80, 'kritinis'], [79, 'aukstas'], [40, 'aukstas'], [39, 'zemas']])(
    'maps %i points to %s',
    (score, priority) => expect(priorityForScore(score)).toBe(priority),
  );

  it('uses the next business day when there is no deadline', () => {
    expect(calculateTaskDue({ category: Category.CALLBACK, deadline: null }, '2026-10-09')).toBe('2026-10-12');
  });

  it('skips weekends when counting business days before an order deadline', () => {
    expect(calculateTaskDue({ category: Category.ORDER, deadline: '2026-10-13' }, '2026-10-01')).toBe('2026-10-09');
  });
});
