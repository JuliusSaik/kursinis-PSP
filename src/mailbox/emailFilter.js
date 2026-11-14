const EXCLUDED_LABELS = new Set(['SPAM', 'TRASH', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL']);

export function isRelevantEmail(email, mailboxAddress) {
  const labels = email.labels ?? [];
  if (!labels.includes('INBOX')) return false;
  if (labels.some((label) => EXCLUDED_LABELS.has(label))) return false;
  if (email.hasListUnsubscribe) return false;
  if (email.from.toLowerCase() === mailboxAddress.toLowerCase()) return false;
  return true;
}
