import type {
  BaseConnection,
  BaseCredential,
  BaseProvider,
  ChatStreamProxy,
  ModelParamOptions,
  RuntimeChatParams,
  SummarizedCredential,
} from "./base";

export class UnknownProvider implements BaseProvider {
  constructor(private readonly type: string) {
    console.log(`Unknown provider type: ${type}`);
  }

  parseNewCredentialForm(_formData: FormData): BaseCredential[] {
    return [];
  }

  credentialToConnections(_credential: BaseCredential): BaseConnection[] {
    return [];
  }

  getCredentialSummary(credential: BaseCredential): SummarizedCredential {
    return {
      title: credential.id || "Unknown",
      tagLine: this.type,
      features: "Unknown or deprecated provider",
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    const type = this.type;
    return async function* (_params: RuntimeChatParams) {
      throw new Error(`Cannot run chat stream for unknown provider type: ${type} (connection: ${connection.id})`);
    };
  }

  getOptions(_connection: BaseConnection): ModelParamOptions {
    return {};
  }
}
