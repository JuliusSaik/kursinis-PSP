const API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const INITIAL_LOOKBACK = 'newer_than:7d';
const MAX_MESSAGES_PER_CHECK = 25;

function header(payload, name) {
  return payload.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function emailAddress(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

function findPart(part, mimeType) {
  if (part.mimeType === mimeType && part.body?.data) {
    return part;
  }
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function messageBody(payload, snippet) {
  const part = findPart(payload, 'text/plain') ?? findPart(payload, 'text/html');
  return part ? Buffer.from(part.body.data, 'base64url').toString('utf8') : snippet;
}

export function toInboxEmail(message) {
  return {
    id: message.id,
    threadId: message.threadId,
    from: emailAddress(header(message.payload, 'From')),
    subject: header(message.payload, 'Subject'),
    body: messageBody(message.payload, message.snippet ?? ''),
    receivedAt: new Date(Number(message.internalDate)).toISOString(),
    labels: message.labelIds ?? [],
    hasListUnsubscribe: header(message.payload, 'List-Unsubscribe') !== '',
  };
}

export class GoogleGmailClient {
  constructor({ auth }) {
    this.auth = auth;
  }

  async listMessagesSince(since) {
    const query = since ? `after:${Math.floor(Date.parse(since) / 1000)}` : INITIAL_LOOKBACK;
    const { data } = await this.auth.request({
      url: API_URL,
      params: { q: query, maxResults: MAX_MESSAGES_PER_CHECK },
    });
    const ids = (data.messages ?? []).map((message) => message.id);
    return Promise.all(ids.map((id) => this.getMessage(id)));
  }

  async getMessage(messageId) {
    try {
      const { data } = await this.auth.request({ url: `${API_URL}/${messageId}`, params: { format: 'full' } });
      return toInboxEmail(data);
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }
}
