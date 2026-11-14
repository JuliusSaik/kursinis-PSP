import { addDays, isValidIsoDate } from '../analysis/dates.js';
import { Category } from '../analysis/rules.js';

const MONTHS_GENITIVE = [
  'sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
  'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio',
];

const CATEGORY_KEYWORDS = [
  [Category.ORDER, ['užsakym', 'užsakyti', 'užsakau', 'order']],
  [Category.CALLBACK, ['paskambin', 'perskambin', 'call me', 'call back']],
  [Category.INVOICE, ['sąskait', 'apmokėj', 'invoice']],
  [Category.CLIENT_INQUIRY, ['kain', 'kiek kainuoja', 'klausim', 'price']],
];

const CLOSING_PHRASES = ['ačiū', 'dėkoju', 'thanks', 'thank you'];

function findCategory(text) {
  const match = CATEGORY_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)));
  return match?.[0] ?? null;
}

function findDeadline(text, today) {
  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch && isValidIsoDate(isoMatch[0])) {
    return isoMatch[0];
  }

  const monthPattern = new RegExp(`(${MONTHS_GENITIVE.join('|')})\\s+(\\d{1,2})\\s*d`);
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    const month = String(MONTHS_GENITIVE.indexOf(monthMatch[1]) + 1).padStart(2, '0');
    const day = monthMatch[2].padStart(2, '0');
    const candidate = `${today.slice(0, 4)}-${month}-${day}`;
    return isValidIsoDate(candidate) ? candidate : null;
  }

  if (text.includes('šiandien')) return today;
  if (text.includes('poryt')) return addDays(today, 2);
  if (text.includes('rytoj')) return addDays(today, 1);
  return null;
}

function actionTextFor(category, email) {
  const subject = email.subject.replace(/^(re|fw|fwd):\s*/i, '');
  switch (category) {
    case Category.ORDER: return `Patvirtinti užsakymą: ${subject}`;
    case Category.CALLBACK: return `Paskambinti ${email.from}`;
    case Category.INVOICE: return `Apmokėti sąskaitą: ${subject}`;
    case Category.CLIENT_INQUIRY: return `Atsakyti ${email.from}: ${subject}`;
    default: return '';
  }
}

function isClosingMessage(body) {
  return CLOSING_PHRASES.some((phrase) => body.startsWith(phrase)) && !body.includes('?');
}

export class MockClassifier {
  async classify(email, { today }) {
    const body = email.body.toLowerCase();
    const subject = email.subject.toLowerCase();

    if (isClosingMessage(body)) {
      return { category: Category.OTHER, actionRequired: false, actionText: '', deadline: null, confidence: 0.9 };
    }

    const bodyCategory = findCategory(body);
    const category = bodyCategory ?? findCategory(subject);
    const deadline = findDeadline(body, today);

    if (category) {
      return {
        category,
        actionRequired: true,
        actionText: actionTextFor(category, email),
        deadline,
        confidence: bodyCategory ? 0.9 : 0.7,
      };
    }

    if (body.includes('?')) {
      return {
        category: Category.CLIENT_INQUIRY,
        actionRequired: true,
        actionText: actionTextFor(Category.CLIENT_INQUIRY, email),
        deadline,
        confidence: 0.5,
      };
    }

    return { category: Category.OTHER, actionRequired: false, actionText: '', deadline, confidence: 0.8 };
  }
}
