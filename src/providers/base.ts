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

export interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  verbosity?: string;
  thinkingBudget?: number;
  serviceTier?: string;
  sort?: string;
  costTier?: string;
  minCodingScore?: number;
}

export const MODEL_PARAM_KEYS = [
  "temperature",
  "maxTokens",
  "reasoningEffort",
  "verbosity",
  "thinkingBudget",
  "serviceTier",
  "sort",
  "costTier",
  "minCodingScore",
] as const satisfies readonly (keyof ModelParams)[];

export type ChatParamKey = (typeof MODEL_PARAM_KEYS)[number];

// Compile-time assertion
type ExpectTrue<T extends true> = T;
export type VerifyAllChatParametersKeysCovered = ExpectTrue<
  Exclude<keyof ModelParams, ChatParamKey> extends never ? true : false
>;

export interface BaseProvider {
  parseNewCredentialForm(formData: FormData): BaseCredential[];
  credentialToConnections(credential: BaseCredential): BaseConnection[];
  getCredentialSummary(credential: BaseCredential): SummarizedCredential;
  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy;
  getOptions(connection: BaseConnection): ModelParamOptions;
}

export interface ModelParamOptions {
  temperature?: { min?: number; max: number };
  maxTokens?: { min?: number; max: number };
  reasoningEffort?: string[];
  verbosity?: string[];
  thinkingBudget?: { min?: number; max: number };
  serviceTier?: string;
  sort?: string[];
  costTier?: string[];
  minCodingScore?: { min: number; max: number; step: number };
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

export interface RuntimeChatParams extends ModelParams {
  messages: GenericMessage[];
  abortSignal?: AbortSignal;
  search?: boolean;
  fetch?: boolean;
  onMetadata?: (metadata: GenericMetadata) => void;
}

export interface GenericMetadata {
  totalOutputTokens?: number;
  cachedInputTokens?: number;
  durationMs?: number;
  latencyMs?: number;
}

export type ChatStreamProxy = (params: RuntimeChatParams) => AsyncGenerator<string>;
