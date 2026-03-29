/**
 * HTTP client that calls the LeadSpot backend API.
 *
 * The backend already handles Mautic OAuth, token refresh, and error mapping.
 * This client simply forwards requests with the correct auth headers.
 */

import { type Config } from "./config.js";

export class LeadSpotClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "LeadSpotClientError";
  }
}

export class LeadSpotClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: Config) {
    this.baseUrl = config.apiUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    };
  }

  async get(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<unknown> {
    const url = this.buildUrl(path, params);
    return this.request("GET", url);
  }

  async post(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const url = this.buildUrl(path);
    return this.request("POST", url, body);
  }

  async put(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const url = this.buildUrl(path);
    return this.request("PUT", url, body);
  }

  async patch(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const url = this.buildUrl(path);
    return this.request("PATCH", url, body);
  }

  async delete(path: string): Promise<unknown> {
    const url = this.buildUrl(path);
    return this.request("DELETE", url);
  }

  /**
   * Send a natural language message to the LeadSpot chat endpoint.
   * The backend runs it through Claude with Mautic tool calling.
   */
  async chat(
    message: string,
    organizationId?: string,
  ): Promise<unknown> {
    return this.post("/api/chat", {
      message,
      organization_id: organizationId,
      enable_tools: true,
    });
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request(
    method: string,
    url: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const init: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";
      throw new LeadSpotClientError(
        `Network error calling ${method} ${url}: ${message}`,
        0,
        "",
      );
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new LeadSpotClientError(
        `LeadSpot API error: ${response.status} ${response.statusText}`,
        response.status,
        responseText,
      );
    }

    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      return responseText;
    }
  }
}
