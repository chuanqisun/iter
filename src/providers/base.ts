import type { ChatMessage, OpenAIChatPayload } from "./openai/chat";

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

export type ChatStreamProxy = (messages: ChatMessage[], config?: Partial<OpenAIChatPayload>, abortSignal?: AbortSignal) => AsyncGenerator<string>;
