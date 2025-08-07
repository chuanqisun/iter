export interface BaseCredential {
  id: string;
  type: string;
}

export interface BaseConnection {
  id: string;
  type: string;
  displayGroup: string;
  displayName: string;
}

export interface SummarizedCredential {
  title: string;
  tagLine: string;
  features: string;
}

export interface BaseProvider {
  parseNewCredentialForm(formData: FormData): BaseCredential[];
  credentialToConnections(credential: BaseCredential): BaseConnection[];
  getCredentialSummary(credential: BaseCredential): SummarizedCredential;
  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy;
  getOptions(connection: BaseConnection): GenericOptions;
}

export interface GenericOptions {
  topP?: { min: number; max: number; step: number };
  topK?: { min: number; max: number; step: number };
  temperature?: { max: number };
  reasoningEffort?: string[];
  verbosity?: string[];
  thinkingBudget?: { min?: number; max: number };
}

export interface GenericMessage {
  role: GenericMessageRole;
  content: string | CustomContentPart[];
}

export type GenericMessageRole = "system" | "user" | "assistant";

export interface CustomContentPart {
  name?: string;
  type: "text/plain" | "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/gif" | (string & {});
  url: string;
}

export interface GenericChatParams {
  messages: GenericMessage[];
  abortSignal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  reasoningEffort?: string;
  thinkingBudget?: number;
  onMetadata?: (metadata: GenericMetadata) => void;
}

export interface GenericMetadata {
  totalOutputTokens?: number;
  durationMs?: number;
}

export type ChatStreamProxy = (params: GenericChatParams) => AsyncGenerator<string>;
