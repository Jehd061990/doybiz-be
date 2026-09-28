import axios, { AxiosRequestConfig } from 'axios';

export type XenditPaymentStatus =
  | 'ACCEPTING_PAYMENTS'
  | 'REQUIRES_ACTION'
  | 'AUTHORIZED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'SUCCEEDED'
  | 'FAILED';

export interface IXenditPaymentRequestInput {
  amount: number;
  currency: string;
  country: string;
  paymentMethod?: string;
  referenceId: string;
  description?: string;
  metadata?: Record<string, unknown>;
  customer?: {
    givenNames?: string;
    email?: string;
  };
}

export interface IXenditPaymentRequestResponse {
  id: string;
  status: XenditPaymentStatus;
  reference_id?: string;
  metadata?: Record<string, unknown>;
  actions?: Array<{ name?: string; url?: string; method?: string }>;
}

export class XenditService {
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookToken: string;

  constructor(secretKey?: string, baseUrl?: string, webhookToken?: string) {
    this.secretKey = secretKey || process.env.XENDIT_SECRET_KEY || '';
    this.baseUrl = baseUrl || process.env.XENDIT_BASE_URL || 'https://api.xendit.co';
    this.webhookToken = webhookToken || process.env.XENDIT_WEBHOOK_TOKEN || '';
  }

  public isConfigured() {
    return Boolean(this.secretKey);
  }

  public verifyWebhookToken(headers: Record<string, any> = {}) {
    const token = headers['x-callback-token'] ?? headers['X-CALLBACK-TOKEN'] ?? headers['x-callback-token'] ?? headers['X-Callback-Token'];
    if (!this.webhookToken) throw new Error('XENDIT_WEBHOOK_TOKEN is not configured');
    if (!token) throw new Error('x-callback-token header is required');
    if (token !== this.webhookToken) throw new Error('Invalid x-callback-token');
    return true;
  }

  public async createPaymentRequest(input: IXenditPaymentRequestInput): Promise<IXenditPaymentRequestResponse> {
    if (!this.isConfigured()) {
      throw new Error('XENDIT_SECRET_KEY is not configured');
    }

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: `${this.baseUrl}/v3/payment_requests`,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        'x-api-version': '2022-07-31',
      },
      data: {
        amount: Number(input.amount),
        currency: input.currency,
        country: input.country,
        type: 'PAY',
        reference_id: input.referenceId,
        description: input.description || 'Billing payment',
        metadata: input.metadata || {},
        capture_method: 'AUTOMATIC',
        ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
      },
    };

    try {
      const response = await axios(config);
      return response.data as IXenditPaymentRequestResponse;
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Xendit payment request failed';
      throw new Error(message);
    }
  }
}

export const xenditService = new XenditService();
