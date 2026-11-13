export class AiServiceError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'AiServiceError';
  }
}

export class InvalidAiResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidAiResponseError';
  }
}
