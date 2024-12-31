import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy } from "./base";
import { type ChatMessage, type OpenAIChatPayload } from "./openai/chat";

export interface AnthropicCredential extends BaseCredential {
  id: string;
  type: "anthropic";
  accountName: string;
  apiKey: string;
}

export interface AnthropicConnection extends BaseConnection {
  id: string;
  type: "anthropic";
  displayGroup: string;
  displayName: string;
  model: string;
  apiVersion: string;
  apiKey: string;
}

export class AnthropicProvider implements BaseProvider {
  static defaultModels = ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"];

  parseNewCredentialForm(formData: FormData): AnthropicCredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "anthropic",
        accountName: accountName?.length ? accountName : `anthropic-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): AnthropicConnection[] {
    if (!this.isAnthropicCredential(credential)) throw new Error("Invalid credential type");

    return AnthropicProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "anthropic",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
          apiVersion: "2023-06-01",
        } satisfies AnthropicConnection)
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isAnthropicCredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: AnthropicProvider.defaultModels.join(","),
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isAnthropicConnection(connection)) throw new Error("Invalid connection type");

    return async function* (messages: ChatMessage[], config?: Partial<OpenAIChatPayload>, abortSignal?: AbortSignal) {};
  }

  private isAnthropicCredential(credential: BaseCredential): credential is AnthropicCredential {
    return credential.type === "anthropic";
  }

  private isAnthropicConnection(connection: BaseConnection): connection is AnthropicConnection {
    return connection.type === "anthropic";
  }
}
