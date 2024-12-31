import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy } from "./base";
import { getChatStream, type ChatMessage, type OpenAIChatPayload } from "./openai/chat";

export interface OpenAICredential extends BaseCredential {
  id: string;
  type: "openai";
  accountName: string;
  apiKey: string;
}

export interface OpenAIConnection extends BaseConnection {
  id: string;
  type: "openai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export class OpenAIProvider implements BaseProvider {
  static type = "openai";
  static defaultModels = ["gpt-4o", "gpt-4o-mini", "o1-mini"];

  parseNewCredentialForm(formData: FormData): OpenAICredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "openai",
        accountName: accountName?.length ? accountName : `openai-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): OpenAIConnection[] {
    if (!this.isOpenAICredential(credential)) throw new Error("Invalid credential type");

    return OpenAIProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "openai",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
        } satisfies OpenAIConnection)
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isOpenAICredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: OpenAIProvider.defaultModels.join(","),
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isOpenAIConnection(connection)) throw new Error("Invalid connection type");

    return async function* (messages: ChatMessage[], config?: Partial<OpenAIChatPayload>, abortSignal?: AbortSignal) {
      const supportsMaxToken = !connection.model.startsWith("o1");
      const supportsTemperature = !connection.model.startsWith("o1");
      const finalConfig: Partial<OpenAIChatPayload> = {
        temperature: supportsTemperature ? config?.temperature : undefined,
        max_tokens: supportsMaxToken ? config?.max_tokens : undefined,
        model: connection.model,
      };

      const innerStream = getChatStream(connection.apiKey, "https://api.openai.com/v1/chat/completions", messages, finalConfig, abortSignal);

      for await (const chunk of innerStream) {
        const content = chunk.choices[0]?.delta?.content ?? "";
        if (content) yield content;
      }
    };
  }

  private isOpenAICredential(credential: BaseCredential): credential is OpenAICredential {
    return credential.type === "openai";
  }

  private isOpenAIConnection(connection: BaseConnection): connection is OpenAIConnection {
    return connection.type === "openai";
  }
}
