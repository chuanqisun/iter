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
}

export interface GenericMessage {
  role: GenericMessageRole;
  content: string | CustomContentPart[];
}

export type GenericMessageRole = "system" | "user" | "assistant";

export interface CustomContentPart {
  name?: string;
  type: "text/plain" | "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  url: string;
}

export interface GenericChatParams {
  messages: GenericMessage[];
  abortSignal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export type ChatStreamProxy = (params: GenericChatParams) => AsyncGenerator<string>;
