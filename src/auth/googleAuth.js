import { OAuth2Client } from 'google-auth-library';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks',
];

const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export class GoogleAuth {
  constructor({ clientId, clientSecret, redirectUri }) {
    this.options = { clientId, clientSecret, redirectUri };
  }

  get isEnabled() {
    return Boolean(this.options.clientId && this.options.clientSecret);
  }

  authUrl(state) {
    return new OAuth2Client(this.options).generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state,
    });
  }

  async exchangeCode(code) {
    const client = new OAuth2Client(this.options);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const { data } = await client.request({ url: USERINFO_URL });
    if (!data.email_verified) {
      throw new Error('Google account email is not verified');
    }
    return { email: data.email.toLowerCase(), tokens };
  }

  // Google refreshes the access token transparently; onRefresh keeps the new token in the session.
  clientFor(tokens, onRefresh) {
    const client = new OAuth2Client(this.options);
    client.setCredentials(tokens);
    client.on('tokens', (refreshed) => onRefresh({ ...tokens, ...refreshed }));
    return client;
  }
}
