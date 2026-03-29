/**
 * Mautic OAuth 2.0 API Client
 *
 * Handles authentication and API requests to a Mautic instance.
 * Uses Authorization Code flow with token refresh.
 */

interface MauticTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface MauticContact {
  id: number;
  fields: {
    all: {
      email?: string;
      firstname?: string;
      lastname?: string;
      phone?: string;
      [key: string]: string | undefined;
    };
  };
  dateAdded: string;
  dateModified: string;
  points: number;
}

interface MauticCampaign {
  id: number;
  name: string;
  description: string;
  isPublished: boolean;
  dateAdded: string;
  dateModified: string;
}

interface MauticEmail {
  id: number;
  name: string;
  subject: string;
  isPublished: boolean;
  readCount: number;
  sentCount: number;
}

interface MauticStats {
  contacts: { total: number; identified: number; anonymous: number };
  emails: { sent: number; read: number; clicked: number; bounced: number };
  campaigns: { active: number; total: number };
}

interface MauticSegment {
  id: number;
  name: string;
  alias: string;
  description: string;
  isPublished: boolean;
  isGlobal: boolean;
  dateAdded: string;
  dateModified: string;
  leadCount?: number;
}

interface MauticForm {
  id: number;
  name: string;
  alias: string;
  description: string;
  isPublished: boolean;
  dateAdded: string;
  dateModified: string;
  submissionCount?: number;
}

export class MauticClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private tokens: MauticTokens | null = null;

  constructor(config: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      ...(state && { state }),
    });
    return `${this.baseUrl}/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<MauticTokens> {
    const response = await fetch(`${this.baseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.tokens;
  }

  /**
   * Set tokens directly (e.g., from stored session)
   */
  setTokens(tokens: MauticTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens
   */
  getTokens(): MauticTokens | null {
    return this.tokens;
  }

  /**
   * Refresh access token if expired
   */
  private async refreshIfNeeded(): Promise<void> {
    if (!this.tokens) {
      throw new Error('No tokens set. Please authenticate first.');
    }

    // Refresh if expires within 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    if (this.tokens.expiresAt.getTime() - Date.now() < fiveMinutes) {
      const response = await fetch(`${this.baseUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed. Please re-authenticate.');
      }

      const data = await response.json();
      this.tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.refreshIfNeeded();

    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.tokens!.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  // ============ Contact Methods ============

  async getContacts(params?: {
    search?: string;
    limit?: number;
    start?: number;
    orderBy?: string;
    orderByDir?: 'asc' | 'desc';
  }): Promise<{ contacts: MauticContact[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.start) query.set('start', params.start.toString());
    if (params?.orderBy) query.set('orderBy', params.orderBy);
    if (params?.orderByDir) query.set('orderByDir', params.orderByDir);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await this.apiRequest<{ contacts: Record<string, MauticContact>; total: number }>(
      `/contacts${queryString}`
    );

    return {
      contacts: Object.values(data.contacts),
      total: data.total,
    };
  }

  async getContact(id: number): Promise<MauticContact> {
    const data = await this.apiRequest<{ contact: MauticContact }>(`/contacts/${id}`);
    return data.contact;
  }

  async createContact(fields: Record<string, string>): Promise<MauticContact> {
    const data = await this.apiRequest<{ contact: MauticContact }>('/contacts/new', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
    return data.contact;
  }

  async updateContact(id: number, fields: Record<string, string>): Promise<MauticContact> {
    const data = await this.apiRequest<{ contact: MauticContact }>(`/contacts/${id}/edit`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return data.contact;
  }

  async deleteContact(id: string | number): Promise<void> {
    await this.apiRequest(`/contacts/${id}/delete`, {
      method: 'DELETE',
    });
  }

  // ============ Campaign Methods ============

  async getCampaigns(params?: {
    search?: string;
    limit?: number;
    published?: boolean;
  }): Promise<{ campaigns: MauticCampaign[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.published !== undefined) {
      query.set('where[0][col]', 'isPublished');
      query.set('where[0][expr]', 'eq');
      query.set('where[0][val]', params.published ? '1' : '0');
    }

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await this.apiRequest<{ campaigns: Record<string, MauticCampaign>; total: number }>(
      `/campaigns${queryString}`
    );

    return {
      campaigns: Object.values(data.campaigns),
      total: data.total,
    };
  }

  async getCampaign(id: number): Promise<MauticCampaign> {
    const data = await this.apiRequest<{ campaign: MauticCampaign }>(`/campaigns/${id}`);
    return data.campaign;
  }

  // ============ Email Methods ============

  async getEmails(params?: {
    search?: string;
    limit?: number;
    published?: boolean;
  }): Promise<{ emails: MauticEmail[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.published !== undefined) {
      query.set('where[0][col]', 'isPublished');
      query.set('where[0][expr]', 'eq');
      query.set('where[0][val]', params.published ? '1' : '0');
    }

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await this.apiRequest<{ emails: Record<string, MauticEmail>; total: number }>(
      `/emails${queryString}`
    );

    return {
      emails: Object.values(data.emails),
      total: data.total,
    };
  }

  async sendEmail(emailId: number, contactId: number): Promise<void> {
    await this.apiRequest(`/emails/${emailId}/contact/${contactId}/send`, {
      method: 'POST',
    });
  }

  // ============ Segment Methods ============

  async getSegments(params?: {
    search?: string;
    limit?: number;
  }): Promise<{ segments: MauticSegment[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await this.apiRequest<{ lists: Record<string, MauticSegment>; total: number }>(
      `/segments${queryString}`
    );

    return {
      segments: Object.values(data.lists || {}),
      total: data.total || 0,
    };
  }

  // ============ Form Methods ============

  async getForms(params?: {
    search?: string;
    limit?: number;
  }): Promise<{ forms: MauticForm[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await this.apiRequest<{ forms: Record<string, MauticForm>; total: number }>(
      `/forms${queryString}`
    );

    return {
      forms: Object.values(data.forms || {}),
      total: data.total || 0,
    };
  }

  // ============ Stats Methods ============

  async getStats(): Promise<MauticStats> {
    // Mautic doesn't have a single stats endpoint, so we aggregate
    // Note: limit=1 instead of limit=0 because Mautic returns 500 for limit=0
    const [contacts, emails, campaigns] = await Promise.all([
      this.apiRequest<{ total: number; contacts: Record<string, unknown> }>('/contacts?limit=1'),
      this.apiRequest<{ emails: Record<string, MauticEmail>; total: number }>('/emails?limit=100'),
      this.apiRequest<{ campaigns: Record<string, MauticCampaign>; total: number }>('/campaigns?limit=100'),
    ]);

    const emailList = Object.values(emails.emails || {});
    const campaignList = Object.values(campaigns.campaigns || {});

    return {
      contacts: {
        total: parseInt(String(contacts.total)) || 0,
        identified: parseInt(String(contacts.total)) || 0,
        anonymous: 0,
      },
      emails: {
        sent: emailList.reduce((acc, e) => acc + (e.sentCount || 0), 0),
        read: emailList.reduce((acc, e) => acc + (e.readCount || 0), 0),
        clicked: 0, // Would need separate stats call
        bounced: 0, // Would need separate stats call
      },
      campaigns: {
        active: campaignList.filter((c) => c.isPublished).length,
        total: campaignList.length,
      },
    };
  }
}

/**
 * Create a Mautic client for a specific tenant
 */
export function createMauticClient(tenant: {
  mauticUrl: string;
  clientId: string;
  clientSecret: string;
}): MauticClient {
  return new MauticClient({
    baseUrl: tenant.mauticUrl,
    clientId: tenant.clientId,
    clientSecret: tenant.clientSecret,
  });
}
