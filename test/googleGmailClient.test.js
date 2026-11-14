import { describe, expect, it } from 'vitest';
import { toInboxEmail } from '../src/integrations/googleGmailClient.js';
import { isRelevantEmail } from '../src/mailbox/emailFilter.js';

const encode = (text) => Buffer.from(text, 'utf8').toString('base64url');

const gmailMessage = (overrides = {}) => ({
  id: '18c2f4a1',
  threadId: '18c2e9b7',
  labelIds: ['INBOX', 'UNREAD'],
  snippet: 'Laba diena...',
  internalDate: String(Date.parse('2026-10-05T06:14:00.000Z')),
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'From', value: 'Jonas Jonaitis <Jonas@Gmail.com>' },
      { name: 'Subject', value: 'Stalviršių užsakymas' },
    ],
    parts: [
      { mimeType: 'text/html', body: { data: encode('<p>HTML versija</p>') } },
      { mimeType: 'text/plain', body: { data: encode('Norėčiau užsakyti 3 stalviršius.') } },
    ],
  },
  ...overrides,
});

describe('Gmail message mapping', () => {
  it('maps a Gmail API message to the inbox email used by the mailbox check', () => {
    expect(toInboxEmail(gmailMessage())).toEqual({
      id: '18c2f4a1',
      threadId: '18c2e9b7',
      from: 'jonas@gmail.com',
      subject: 'Stalviršių užsakymas',
      body: 'Norėčiau užsakyti 3 stalviršius.',
      receivedAt: '2026-10-05T06:14:00.000Z',
      labels: ['INBOX', 'UNREAD'],
      hasListUnsubscribe: false,
    });
  });

  it('marks newsletters so the filter drops them before the AI is called', () => {
    const newsletter = gmailMessage();
    newsletter.payload.headers.push({ name: 'List-Unsubscribe', value: '<mailto:unsubscribe@shop.test>' });

    const email = toInboxEmail(newsletter);
    expect(email.hasListUnsubscribe).toBe(true);
    expect(isRelevantEmail(email, 'owner@gmail.com')).toBe(false);
  });

  it('falls back to the snippet when the message has no text body', () => {
    const email = toInboxEmail(gmailMessage({ payload: { mimeType: 'text/plain', headers: [], body: { size: 0 } } }));
    expect(email.body).toBe('Laba diena...');
    expect(email.from).toBe('');
  });
});
