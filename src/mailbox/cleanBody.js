const MAX_BODY_LENGTH = 4000;
const QUOTE_HEADER = /^(On .+ wrote:|.+ rašė:)$/;

function stripHtml(text) {
  return text
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function removeQuotedHistory(text) {
  const lines = text.split('\n');
  const historyStart = lines.findIndex((line) => line.trim().startsWith('>') || QUOTE_HEADER.test(line.trim()));
  return (historyStart === -1 ? lines : lines.slice(0, historyStart)).join('\n');
}

export function cleanEmailBody(body = '') {
  return removeQuotedHistory(stripHtml(body))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BODY_LENGTH);
}
