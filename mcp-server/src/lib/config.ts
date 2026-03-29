/**
 * Configuration loaded from environment variables.
 *
 * LEADSPOT_API_URL - Base URL of the LeadSpot backend (default: http://localhost:8000)
 * LEADSPOT_API_KEY - API key for authenticating with the backend
 * LEADSPOT_ORG_ID  - Default organization ID for Mautic operations
 */

export interface Config {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly organizationId: string;
}

export function loadConfig(): Config {
  const apiUrl = process.env["LEADSPOT_API_URL"] ?? "http://localhost:8000";
  const apiKey = process.env["LEADSPOT_API_KEY"] ?? "";
  const organizationId = process.env["LEADSPOT_ORG_ID"] ?? "";

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apiKey,
    organizationId,
  };
}
