export interface SmsClassificationResult {
  kind: 'express_pickup' | 'other' | 'unknown';
  pickupCode?: string | null;
  address?: string | null;
  confidence: number;
}

export interface SmsJob {
  content: string;
  sender?: string;
  receivedAt?: string;
  device?: string;
  fingerprint: string;
}

export interface SmsHandler {
  /**
   * Whether this handler can process the given classification result.
   */
  canHandle(classified: SmsClassificationResult): boolean;

  /**
   * Process the SMS given the classification result.
   */
  handle(job: SmsJob, classified: SmsClassificationResult): Promise<void>;
}

/**
 * DI token for multi-provider SMS handlers.
 * Providers are registered with `{ provide: SMS_HANDLER, useClass: ..., multi: true }`.
 */
export const SMS_HANDLER = 'SMS_HANDLER';
