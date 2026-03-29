// Voice AI Agent Configuration Types
// Matches LiveKit Cloud Agent Builder features

export interface HttpToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

export interface HttpTool {
  id: string;
  name: string;
  description: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  bodyTemplate: string;
  parameters: HttpToolParameter[];
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  authType: 'none' | 'api_key' | 'oauth';
  authConfig: Record<string, string>;
}

export interface CustomVariable {
  key: string;
  value: string;
}

export interface AgentConfig {
  // Basic Info
  name: string;
  type: string;
  phoneNumber: string;

  // Instructions Tab
  systemPrompt: string;
  welcomeMessage: string;
  allowInterruption: boolean;
  customVariables: CustomVariable[];

  // Models & Voice Tab
  voiceId: string;

  // Actions Tab
  httpTools: HttpTool[];
  mcpServers: McpServer[];
}

// Built-in variables available for insertion
export const BUILT_IN_VARIABLES = [
  { key: 'caller_name', label: 'Caller Name', description: 'Name collected from the caller' },
  { key: 'caller_phone', label: 'Caller Phone', description: 'Phone number of the caller' },
  { key: 'caller_email', label: 'Caller Email', description: 'Email collected from the caller' },
  { key: 'company_name', label: 'Company Name', description: 'Your company name from settings' },
  { key: 'agent_name', label: 'Agent Name', description: 'Name of this voice agent' },
  { key: 'current_date', label: 'Current Date', description: "Today's date" },
  { key: 'current_time', label: 'Current Time', description: 'Current time' },
];

// Default empty config
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: '',
  type: 'lead_qualification',
  phoneNumber: '',
  systemPrompt: '',
  welcomeMessage: '',
  allowInterruption: true,
  customVariables: [],
  voiceId: 'rachel',
  httpTools: [],
  mcpServers: [],
};
