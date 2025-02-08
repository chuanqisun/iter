import type { ChatCompletionContentPart } from "openai/resources/index.mjs";

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
  role: string;
  content: string | (ChatCompletionContentPart | CustomContentPart)[]
}

export interface CustomContentPart {
  type: 'application/pdf';
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
